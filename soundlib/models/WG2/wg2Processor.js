import { BidirectionalWaveguide } from '../../utilities/BidirectionalWaveguide.js';
import { LoopLossFilter } from '../../utilities/LoopLossFilter.js';
import { RigidTermination } from '../../utilities/RigidTermination.js';
import { InitialConditionExciter } from '../../utilities/InitialConditionExciter.js';
import { PointPickup } from '../../utilities/PointPickup.js';
import { OutputConditioner } from '../../utilities/OutputConditioner.js';
import { DispersionFilter } from '../../utilities/DispersionFilter.js';
import { WG2_CONFIG } from './wg2Config.js';

/**
 * WaveguideResonator v1, Phase B ("spatial meaning" -- see
 * scratch/WaveguideResonator-v1-Specification-and-Reasoning-Model.md):
 *
 *   InitialConditionExciter.exciteAtPosition() -> BidirectionalWaveguide
 *     (two rails + boundary reflections via RigidTermination/LoopLossFilter)
 *     -> PointPickup -> OutputConditioner
 *
 * A true bidirectional two-rail waveguide, unlike WG1's single lumped
 * loop -- this is what makes excitationPosition/pickupPosition/pickupType
 * physically meaningful (see BidirectionalWaveguide.js's own comment).
 * Not a WG1 subclass at the DSP level despite sharing most components --
 * a genuinely different propagation structure.
 */
// Exported (not just module-private) so WG3's own worklet processor can
// subclass it directly -- see soundlib/models/WG3/wg3Processor.js. Zero
// behavior change for WG2 itself from this export alone.
export class WG2Processor extends AudioWorkletProcessor {
    // Message types this.port.onmessage accepts, as a static field (not a
    // hardcoded check inline) so a subclass (WG3Processor) can extend the
    // accepted set via its own static field without restating this list --
    // same this.constructor.X polymorphic-static pattern already used for
    // PROCESSOR_NAME on WG2.js/WG3.js.
    static ACCEPTED_MESSAGE_TYPES = ['pluck', 'reset', 'set-excitation-type', 'set-pickup-type'];

    static get parameterDescriptors() {
        return [
            { name: 'active', defaultValue: 0, minValue: 0, maxValue: 1 },
            {
                name: 'frequency',
                defaultValue: WG2_CONFIG.frequencyDefaultHz,
                minValue: WG2_CONFIG.frequencyMinHz,
                maxValue: WG2_CONFIG.frequencyMaxHz
            },
            { name: 'energy', defaultValue: WG2_CONFIG.energyDefault, minValue: 0, maxValue: 1 },
            {
                name: 'decayTime',
                defaultValue: WG2_CONFIG.decayTimeDefaultSeconds,
                minValue: WG2_CONFIG.decayTimeMinSeconds,
                maxValue: WG2_CONFIG.decayTimeMaxSeconds
            },
            {
                name: 'excitationPosition',
                defaultValue: WG2_CONFIG.excitationPositionDefault,
                minValue: WG2_CONFIG.excitationPositionMin,
                maxValue: WG2_CONFIG.excitationPositionMax
            },
            {
                name: 'pickupPosition',
                defaultValue: WG2_CONFIG.pickupPositionDefault,
                minValue: WG2_CONFIG.pickupPositionMin,
                maxValue: WG2_CONFIG.pickupPositionMax
            },
            {
                name: 'stiffness',
                defaultValue: WG2_CONFIG.stiffnessDefault,
                minValue: WG2_CONFIG.stiffnessMin,
                maxValue: WG2_CONFIG.stiffnessMax
            },
            {
                name: 'dispersionPivot',
                defaultValue: WG2_CONFIG.dispersionPivotDefault,
                minValue: WG2_CONFIG.dispersionPivotMin,
                maxValue: WG2_CONFIG.dispersionPivotMax
            },
            {
                name: 'dispersionSlope',
                defaultValue: WG2_CONFIG.dispersionSlopeDefault,
                minValue: WG2_CONFIG.dispersionSlopeMin,
                maxValue: WG2_CONFIG.dispersionSlopeMax
            }
        ];
    }

    constructor(options) {
        super();
        const processorOptions = options.processorOptions ?? {};
        this.processorSampleRate = processorOptions.sampleRate ?? sampleRate;
        const seed = processorOptions.seed ?? 1;

        // Rail length is half the full loop length -- buffer sized for
        // the lowest supported frequency's rail, same margin as WG1.
        // interpolationMode is a construction-time/developer choice, not
        // a user-facing Parameter -- see createInterpolator.js for why
        // lagrange3 is the default (BidirectionalWaveguide's own default
        // when processorOptions.interpolationMode is undefined).
        const maxRailSamples = Math.ceil(this.processorSampleRate / (2 * WG2_CONFIG.frequencyMinHz)) + 4;
        this.waveguide = new BidirectionalWaveguide(maxRailSamples, processorOptions.interpolationMode);
        this.waveguide.setRailLength(this.processorSampleRate / (2 * WG2_CONFIG.frequencyDefaultHz));

        this.nutTermination = new RigidTermination(WG2_CONFIG.terminationReflection);
        this.bridgeTermination = new RigidTermination(WG2_CONFIG.terminationReflection);
        // One shared loss filter -- its coefficient only depends on
        // decayTime/sampleRate/railLength, identical at both boundaries.
        this.lossFilter = new LoopLossFilter(
            WG2_CONFIG.decayTimeDefaultSeconds,
            this.processorSampleRate,
            this.waveguide.railLength
        );
        this.exciter = new InitialConditionExciter(seed);
        this.pickup = new PointPickup();
        this.output = new OutputConditioner({ outputGain: WG2_CONFIG.outputGain });
        // Phase C dispersion -- see DispersionFilter.js. Bypassed
        // (stiffness=0) by default, so construction alone adds no
        // behavior change.
        this.dispersionFilter = new DispersionFilter(
            WG2_CONFIG.dispersionSectionCount,
            WG2_CONFIG.dispersionPivotDefault,
            WG2_CONFIG.dispersionSlopeDefault,
            WG2_CONFIG.dispersionAmountMaxCents,
            WG2_CONFIG.dispersionStiffnessCurveExponent,
            WG2_CONFIG.dispersionBSafeMax,
            WG2_CONFIG.dispersionSmoothingSeconds
        );

        this.excitationType = WG2_CONFIG.excitationTypeDefault;
        this.pickupType = WG2_CONFIG.pickupTypeDefault;

        this.pendingCommands = [];
        this.port.onmessage = ({ data }) => {
            if (this.constructor.ACCEPTED_MESSAGE_TYPES.includes(data?.type)) {
                this.pendingCommands.push(data);
            }
        };
    }

    process(inputs, outputs, parameters) {
        const channel = outputs[0]?.[0];
        if (!channel) return true;

        const frequency = Math.max(
            WG2_CONFIG.frequencyMinHz,
            Math.min(parameters.frequency[0], WG2_CONFIG.frequencyMaxHz)
        );

        // Phase C, pitchLocked (the only mode implemented so far): the
        // dispersion filter's own group delay at the fundamental is
        // subtracted from the geometric rail length, so the fundamental
        // stays in tune as stiffness changes -- this per-block computation
        // IS the entirety of pitchLocked behavior for v1 (see
        // DispersionFilter.js's own comment). A future lengthLocked mode
        // would just skip the subtraction here, touching nothing else.
        this.dispersionFilter.update(
            parameters.stiffness[0],
            parameters.dispersionPivot[0],
            parameters.dispersionSlope[0],
            frequency,
            this.processorSampleRate
        );
        const compensationSamples = this.dispersionFilter.groupDelaySamplesAt(frequency, this.processorSampleRate);
        // Floor raised from 1 to WG2_CONFIG.dispersionMinSafeRailLengthSamples
        // (2) as a safety fix for a real, measured instability -- see that
        // constant's own comment in wg2Config.js for the full investigation.
        const railLength = Math.max(WG2_CONFIG.dispersionMinSafeRailLengthSamples, (this.processorSampleRate / frequency - compensationSamples) / 2);
        this.waveguide.setRailLength(railLength);
        this.lossFilter.setDecayTime(parameters.decayTime[0], this.processorSampleRate, this.waveguide.railLength);

        const excitationPosition = parameters.excitationPosition[0];
        const pickupPosition = parameters.pickupPosition[0];

        for (const command of this.pendingCommands) {
            if (command.type === 'reset') {
                this.waveguide.reset();
                this.output.reset();
                this.dispersionFilter.reset();
                this._onReset();
            } else if (command.type === 'set-excitation-type') {
                this.excitationType = command.excitationType;
            } else if (command.type === 'set-pickup-type') {
                this.pickupType = command.pickupType;
            } else if (command.type === 'pluck') {
                this.exciter.exciteAtPosition(
                    this.waveguide.rightGoing,
                    this.waveguide.leftGoing,
                    this.waveguide.railLength,
                    excitationPosition,
                    this.excitationType,
                    parameters.energy[0]
                );
            } else {
                this._handleUnknownCommand(command);
            }
        }
        this.pendingCommands.length = 0;

        if (parameters.active[0] < 0.5) {
            channel.fill(0);
            return true;
        }

        for (let i = 0; i < channel.length; i++) {
            this.waveguide.tick(this.nutTermination, this.bridgeTermination, this.lossFilter, this.dispersionFilter);
            const observed = this.pickup.observe(this.waveguide, pickupPosition, this.pickupType);
            channel[i] = this._finalizeSample(observed);
        }

        return true;
    }

    // Extracted so a subclass (WG3Processor) can mix in extra signal (e.g.
    // a transmission-port monitor tap) before output conditioning, without
    // restating this whole process() loop. Default behavior is identical
    // to the inline code this replaced.
    _finalizeSample(observed) {
        return this.output.tick(observed);
    }

    // Extracted so a subclass (WG3Processor) can reset extra stateful
    // components (e.g. a filtered bridge termination's internal filter
    // state) on every fresh note, matching this project's established
    // "reset every startSound(), not just at construction" convention. A
    // no-op by default -- WG2 has nothing extra to reset here.
    _onReset() {}

    // Dispatched for any pendingCommand whose type this class doesn't
    // itself recognize (paired with ACCEPTED_MESSAGE_TYPES above, which
    // controls what even reaches pendingCommands in the first place). A
    // no-op by default -- lets a subclass (WG3Processor's own
    // 'set-body-preset') add new command types without restating this
    // whole dispatch loop.
    _handleUnknownCommand(command) {}
}

registerProcessor('wg2Processor', WG2Processor);
