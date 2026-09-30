import { FractionalDelayWaveguide } from '../../utilities/FractionalDelayWaveguide.js';
import { LoopLossFilter } from '../../utilities/LoopLossFilter.js';
import { RigidTermination } from '../../utilities/RigidTermination.js';
import { InitialConditionExciter } from '../../utilities/InitialConditionExciter.js';
import { OutputConditioner } from '../../utilities/OutputConditioner.js';
import { createInterpolator, DEFAULT_INTERPOLATION_MODE } from '../../utilities/createInterpolator.js';
import { WG1_CONFIG } from './wg1Config.js';

/**
 * WaveguideResonator v1, Phase A ("canonical stable loop" -- see
 * scratch/WaveguideResonator-v1-Specification-and-Reasoning-Model.md):
 *
 *   InitialConditionExciter -> FractionalDelayWaveguide (feedback loop)
 *     -> RigidTermination -> LoopLossFilter -> OutputConditioner
 *
 * A single delay loop representing one full round trip, not yet a true
 * bidirectional two-rail waveguide with independently addressable spatial
 * positions -- see FractionalDelayWaveguide.js's own comment. Excitation/
 * pickup position, dispersion, and bridge filtering are later phases.
 *
 * `frequency` is read every block and fed straight into the waveguide's
 * delay length, so retuning is continuous/"stable" (spec section 8.3) by
 * construction -- there is no separate discrete "retrigger" mode in
 * Phase A.
 */
class WG1Processor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'active', defaultValue: 0, minValue: 0, maxValue: 1 },
            {
                name: 'frequency',
                defaultValue: WG1_CONFIG.frequencyDefaultHz,
                minValue: WG1_CONFIG.frequencyMinHz,
                maxValue: WG1_CONFIG.frequencyMaxHz
            },
            { name: 'energy', defaultValue: WG1_CONFIG.energyDefault, minValue: 0, maxValue: 1 },
            {
                name: 'decayTime',
                defaultValue: WG1_CONFIG.decayTimeDefaultSeconds,
                minValue: WG1_CONFIG.decayTimeMinSeconds,
                maxValue: WG1_CONFIG.decayTimeMaxSeconds
            }
        ];
    }

    constructor(options) {
        super();
        const processorOptions = options.processorOptions ?? {};
        this.processorSampleRate = processorOptions.sampleRate ?? sampleRate;
        const seed = processorOptions.seed ?? 1;
        // Construction-time/developer choice, not a user-facing Parameter
        // -- see createInterpolator.js for why lagrange3 is the default.
        // One instance for WG1's single self-feedback tap (unlike WG2's
        // BidirectionalWaveguide, which needs two).
        this.interpolator = createInterpolator(processorOptions.interpolationMode ?? DEFAULT_INTERPOLATION_MODE);

        const maxDelaySamples = Math.ceil(this.processorSampleRate / WG1_CONFIG.frequencyMinHz) + 4;
        this.waveguide = new FractionalDelayWaveguide(maxDelaySamples);
        this.waveguide.setDelaySamples(this.processorSampleRate / WG1_CONFIG.frequencyDefaultHz);
        this.lossFilter = new LoopLossFilter(
            WG1_CONFIG.decayTimeDefaultSeconds,
            this.processorSampleRate,
            this.waveguide.delaySamples
        );
        this.termination = new RigidTermination(WG1_CONFIG.terminationReflection);
        this.exciter = new InitialConditionExciter(seed);
        this.output = new OutputConditioner({ outputGain: WG1_CONFIG.outputGain });

        this.excitationType = WG1_CONFIG.excitationTypeDefault;

        this.pendingCommands = [];
        this.port.onmessage = ({ data }) => {
            if (data?.type === 'pluck' || data?.type === 'reset' || data?.type === 'set-excitation-type') {
                this.pendingCommands.push(data);
            }
        };
    }

    process(inputs, outputs, parameters) {
        const channel = outputs[0]?.[0];
        if (!channel) return true;

        // Read every block, unconditionally -- this is what makes
        // retuning continuous ("stable" mode) rather than needing an
        // explicit rebuild command.
        const frequency = Math.max(
            WG1_CONFIG.frequencyMinHz,
            Math.min(parameters.frequency[0], WG1_CONFIG.frequencyMaxHz)
        );
        this.waveguide.setDelaySamples(this.processorSampleRate / frequency);
        this.lossFilter.setDecayTime(parameters.decayTime[0], this.processorSampleRate, this.waveguide.delaySamples);

        // Drained once per block, same pattern as maracaProcessor.js/
        // bambooChimeProcessor.js -- keeps discrete triggers entirely off
        // the message port's per-sample granularity. A pluck reads the
        // delay length/energy already computed above for this block, so
        // it always excites the loop at the frequency actually in effect
        // right now, not a stale one from whenever the message was sent.
        for (const command of this.pendingCommands) {
            if (command.type === 'reset') {
                this.waveguide.reset();
                this.output.reset();
                this.interpolator.reset();
            } else if (command.type === 'set-excitation-type') {
                this.excitationType = command.excitationType;
            } else if (command.type === 'pluck') {
                this.exciter.excite(this.waveguide, this.waveguide.delaySamples, this.excitationType, parameters.energy[0]);
            }
        }
        this.pendingCommands.length = 0;

        if (parameters.active[0] < 0.5) {
            channel.fill(0);
            return true;
        }

        for (let i = 0; i < channel.length; i++) {
            const delayed = this.waveguide.read(this.interpolator);
            const reflected = this.termination.reflect(delayed);
            const filtered = this.lossFilter.process(reflected);
            this.waveguide.write(filtered);
            channel[i] = this.output.tick(filtered);
        }

        return true;
    }
}

registerProcessor('wg1Processor', WG1Processor);
