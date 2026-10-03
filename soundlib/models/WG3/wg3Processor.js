import { WG2Processor } from '../WG2/wg2Processor.js';
import { WG2_CONFIG } from '../WG2/wg2Config.js';
import { BridgeTermination } from '../../utilities/BridgeTermination.js';
import { BodyModeBank } from '../../utilities/BodyModeBank.js';
import { BODY_PRESETS } from './bodyConfig.js';
import { WG3_CONFIG } from './wg3Config.js';
import { bridgeDecayValToSeconds, computeBridgeReflectionCoefficient } from './bridgeDecayMath.js';

/**
 * WaveguideResonator v1, Phase C (continued) -- `WG3` swaps WG2's rigid
 * bridge boundary for a filtered, transmitting one (see
 * soundlib/utilities/FilteredTermination.js/BridgeTermination.js) and
 * exposes a transmission-port monitor mix, so the new bridge can actually
 * be heard. See docs/MODEL_PATTERNS.md's digital-waveguide archetype.
 *
 * Pre-C.5.3 reparameterization: `bridgeDecayVal` ([0,1], dimensionless)
 * and `bodyCouplingEfficiency` ([0,1]) replace the earlier raw
 * `reflection`/`terminationDamping` controls -- a raw per-round-trip
 * amplitude coefficient's musically useful region is compressed into a
 * tiny sliver near 1 at any playable frequency. `bridgeDecayVal` is
 * mapped onto an actual bridge-only T60 in seconds (see
 * bridgeDecayMath.js), geometrically, entirely in this model's own code
 * -- Parameter.js itself is untouched. `getBridgeDiagnostics()` exposes
 * the mapped seconds value and the computed low-level `reflection`
 * coefficient for inspection, since the primary knob's own value doesn't
 * show them.
 *
 * Phase C.5.1 adds a one-way downstream body (see
 * soundlib/utilities/BodyModeBank.js / soundlib/models/WG3/bodyConfig.js):
 * the termination's own transmittedSignal drives a small, fixed bank of
 * resonant modes, with its own independent listening-only monitor gain.
 * The body is ALWAYS driven whenever anything is transmitted -- its
 * monitor gain controls only whether/how much of its OWN output you hear,
 * never whether it's excited (physical signal flow is not gated by an
 * output gain). Nothing about the body ever feeds back into the
 * waveguide -- strictly one-way.
 *
 * Subclasses WG2Processor directly rather than restating its process()
 * loop -- every other piece (propagation, dispersion, pickup, output
 * conditioning, the nut's own RigidTermination) is reused completely
 * unchanged. Only genuinely new content lives here: the 5 new parameters,
 * swapping this.bridgeTermination to a BridgeTermination instance, the
 * body mode bank, and mixing both the transmission port and the body's
 * own radiation into the output via the _finalizeSample() hook
 * WG2Processor exposes for exactly this purpose.
 */
class WG3Processor extends WG2Processor {
    // Extends WG2Processor's own accepted set rather than restating it --
    // see wg2Processor.js's own ACCEPTED_MESSAGE_TYPES comment.
    static ACCEPTED_MESSAGE_TYPES = [...WG2Processor.ACCEPTED_MESSAGE_TYPES, 'set-body-preset'];

    static get parameterDescriptors() {
        return [
            ...WG2Processor.parameterDescriptors,
            {
                name: 'bridgeDecayVal',
                defaultValue: WG3_CONFIG.bridgeDecayValDefault,
                minValue: WG3_CONFIG.bridgeDecayValMin,
                maxValue: WG3_CONFIG.bridgeDecayValMax
            },
            {
                name: 'reflectionTilt',
                defaultValue: WG3_CONFIG.terminationReflectionTiltDefault,
                minValue: WG3_CONFIG.terminationReflectionTiltMin,
                maxValue: WG3_CONFIG.terminationReflectionTiltMax
            },
            {
                name: 'bodyCouplingEfficiency',
                defaultValue: WG3_CONFIG.bodyCouplingEfficiencyDefault,
                minValue: WG3_CONFIG.bodyCouplingEfficiencyMin,
                maxValue: WG3_CONFIG.bodyCouplingEfficiencyMax
            },
            {
                name: 'pickupGain',
                defaultValue: WG3_CONFIG.pickupGainDefault,
                minValue: WG3_CONFIG.pickupGainMin,
                maxValue: WG3_CONFIG.pickupGainMax
            },
            {
                name: 'transmissionGain',
                defaultValue: WG3_CONFIG.transmissionGainDefault,
                minValue: WG3_CONFIG.transmissionGainMin,
                maxValue: WG3_CONFIG.transmissionGainMax
            },
            {
                name: 'bodyRadiationGain',
                defaultValue: WG3_CONFIG.bodyRadiationGainDefault,
                minValue: WG3_CONFIG.bodyRadiationGainMin,
                maxValue: WG3_CONFIG.bodyRadiationGainMax
            }
        ];
    }

    constructor(options) {
        super(options);
        // Replace the rigid bridge boundary with a filtered, transmitting
        // one -- the nut stays RigidTermination, inherited unchanged from
        // WG2Processor's own constructor, matching the spec's framing that
        // only the bridge normally couples outward.
        this.bridgeTermination = new BridgeTermination(this.processorSampleRate, WG3_CONFIG.bridgeShelfCornerHz);
        this.pickupGain = WG3_CONFIG.pickupGainDefault;
        this.transmissionGain = WG3_CONFIG.transmissionGainDefault;
        // Phase C.5.1/C.5.2: a small, fixed downstream body, driven
        // one-way by the termination's own transmittedSignal -- see
        // BodyModeBank.js/bodyConfig.js. Which NAMED preset is active is
        // plain processor state (this.bodyPresetName), the same shape as
        // excitationType/pickupType above -- not an AudioParam, switched
        // live via postMessage (see _handleUnknownCommand below).
        this.bodyPresetName = WG3_CONFIG.bodyPresetDefault;
        this.bodyModeBank = new BodyModeBank(this.processorSampleRate, BODY_PRESETS[this.bodyPresetName].modes);
        this.bodyRadiationGain = WG3_CONFIG.bodyRadiationGainDefault;
        // Diagnostic-only state (see getBridgeDiagnostics()) -- never
        // read by process() itself, purely for inspection/tests/the
        // "what does bridgeDecayVal currently mean in seconds" question
        // the primary [0,1] knob's own display doesn't answer.
        this.lastBridgeDecayTimeSeconds = 0;
    }

    process(inputs, outputs, parameters) {
        // Recomputed here (matching WG2Processor's own clamp exactly)
        // because bridgeDecayVal -> seconds -> r depends on the
        // fundamental frequency, and that clamped value is local to
        // super.process()'s own scope, not stored on `this`.
        const frequency = Math.max(
            WG2_CONFIG.frequencyMinHz,
            Math.min(parameters.frequency[0], WG2_CONFIG.frequencyMaxHz)
        );
        const bridgeDecayTimeSeconds = bridgeDecayValToSeconds(
            parameters.bridgeDecayVal[0],
            WG3_CONFIG.bridgeDecayTimeMinSeconds,
            WG3_CONFIG.bridgeDecayTimeMaxSeconds
        );
        this.lastBridgeDecayTimeSeconds = bridgeDecayTimeSeconds;
        this.bridgeTermination.reflection = computeBridgeReflectionCoefficient(bridgeDecayTimeSeconds, frequency);
        this.bridgeTermination.reflectionTilt = parameters.reflectionTilt[0];
        this.bridgeTermination.couplingEfficiency = parameters.bodyCouplingEfficiency[0];
        this.pickupGain = parameters.pickupGain[0];
        this.transmissionGain = parameters.transmissionGain[0];
        this.bodyRadiationGain = parameters.bodyRadiationGain[0];
        return super.process(inputs, outputs, parameters);
    }

    // Mirrors DispersionFilter.getTargetDescription()'s precedent: the
    // low-level computed reflection coefficient, the mapped seconds
    // value, and the last transmitted/dissipated split, all kept
    // available for diagnostics/advanced inspection without requiring
    // the primary bridgeDecayVal/bodyCouplingEfficiency knobs themselves
    // to display anything beyond their own plain [0,1] values.
    getBridgeDiagnostics() {
        return {
            bridgeDecayTimeSeconds: this.lastBridgeDecayTimeSeconds,
            reflection: this.bridgeTermination.reflection,
            couplingEfficiency: this.bridgeTermination.couplingEfficiency,
            lastTransmitted: this.bridgeTermination.lastTransmitted,
            lastDissipated: this.bridgeTermination.lastDissipated
        };
    }

    // Mixed in BEFORE output.tick(), so OutputConditioner's hard clamp
    // protects the combined signal too -- purely additive at the output
    // stage, can never feed back into waveguide state. The body is
    // excited UNCONDITIONALLY every sample (physical signal flow is not
    // gated by bodyRadiationGain -- only whether you hear its output is).
    // pickupGain is the third tap in this same mix, on the one signal
    // (observed, the plain string pickup) that was always unconditionally
    // present -- its default of 1 (not 0, unlike the other two) is what
    // keeps this a pure rename/addition with zero behavior change at
    // defaults.
    _finalizeSample(observed) {
        const transmitted = this.waveguide.lastTransmittedSignal;
        this.bodyModeBank.excite(transmitted);
        const bodyRadiation = this.bodyModeBank.tick();
        const mixed = this.pickupGain * observed
            + this.transmissionGain * transmitted
            + this.bodyRadiationGain * bodyRadiation;
        return this.output.tick(mixed);
    }

    // A fresh note should start with no stale internal filter state from a
    // previous note's bridge reflection, or the body's own previous ring-
    // down -- same reasoning as DispersionFilter's own reset() (see
    // docs/MODEL_PATTERNS.md's pitch-glide regression note for why this
    // class of bug is worth guarding against explicitly).
    _onReset() {
        super._onReset();
        this.bridgeTermination.reset();
        this.bodyModeBank.reset();
    }

    // A fresh BodyModeBank instance (not in-place reconfiguration) on
    // preset switch -- cheap (a handful of Float64Arrays), and naturally
    // clears any stale ringing from the previous preset for free, same
    // "fresh state on change" discipline as _onReset() above. A discrete,
    // infrequent, user-triggered allocation inside process(), the same
    // category as the exciter.exciteAtPosition()/waveguide.reset() calls
    // already made there for pluck/reset.
    _handleUnknownCommand(command) {
        if (command.type === 'set-body-preset' && BODY_PRESETS[command.bodyPreset]) {
            this.bodyPresetName = command.bodyPreset;
            this.bodyModeBank = new BodyModeBank(this.processorSampleRate, BODY_PRESETS[this.bodyPresetName].modes);
        }
    }
}

registerProcessor('wg3Processor', WG3Processor);
