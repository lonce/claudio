import { SeededRandom } from '../utilities/SeededRandom.js';
import { EnergyAccumulator } from '../utilities/EnergyAccumulator.js';
import { StochasticCollisionGenerator } from '../utilities/StochasticCollisionGenerator.js';
import { NoiseBurstExciter } from '../utilities/NoiseBurstExciter.js';
import { ResonatorBank } from '../utilities/ResonatorBank.js';
import { OutputConditioner } from '../utilities/OutputConditioner.js';
import { MARACA_CONFIG } from './maracaConfig.js';

const MAX_MODES = 4; // preallocated capacity; only mode 0 is configured/active in this first pass

/**
 * Worklet-native PhISEM (Cook) maraca: mechanical energy accumulation,
 * stochastic collision generation, accumulated noise-burst excitation, and
 * one resonant body mode -- all inside process(), sample by sample. The
 * worklet owns every collision-level detail; the SoundModel (Maraca.js)
 * only ever sees "shake" as a public action. See
 * docs/MODEL_PATTERNS.md archetype 5 and
 * fromChat/energy/Claudio-PhISEM-Architecture-and-Maraca-First-Pass.md.
 */
class MaracaProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'active', defaultValue: 0, minValue: 0, maxValue: 1 },
            { name: 'shakeEnergy', defaultValue: 0, minValue: 0, maxValue: 1 },
            { name: 'systemDecay', defaultValue: 0.35, minValue: 0.05, maxValue: 2.0 },
            { name: 'numberOfObjects', defaultValue: 64, minValue: 1, maxValue: 256 },
            { name: 'resonanceFrequency', defaultValue: 3200, minValue: 20, maxValue: 20000 }
        ];
    }

    constructor(options) {
        super();
        const processorOptions = options.processorOptions ?? {};
        this.processorSampleRate = processorOptions.sampleRate ?? sampleRate;
        const seed = processorOptions.seed ?? 1;

        this.random = new SeededRandom(seed);

        this.energy = new EnergyAccumulator(this.processorSampleRate, {
            maxEnergy: MARACA_CONFIG.energyMax,
            driveScale: MARACA_CONFIG.driveScale
        });

        this.collisions = new StochasticCollisionGenerator(this.processorSampleRate, {
            rateScale: MARACA_CONFIG.collisionRateScale,
            amplitudeScale: MARACA_CONFIG.collisionAmplitudeScale,
            random: this.random
        });

        this.exciter = new NoiseBurstExciter(this.processorSampleRate, { random: this.random });
        this.exciter.setDecaySeconds(MARACA_CONFIG.collisionDecaySeconds);

        this.resonators = new ResonatorBank(this.processorSampleRate, MAX_MODES);
        this.resonators.setMode(
            0,
            3200, // overwritten every block by the resonanceFrequency AudioParam below
            MARACA_CONFIG.modeDecaySeconds,
            MARACA_CONFIG.modeGain
        );

        this.output = new OutputConditioner({ outputGain: MARACA_CONFIG.outputGain });

        this.pendingCommands = [];
        this.port.onmessage = ({ data }) => {
            if (data?.type === 'shake' || data?.type === 'reset') {
                this.pendingCommands.push(data);
            }
        };
    }

    // Applied unconditionally, even while `active` is 0 -- a 'reset' must
    // always take effect promptly (Maraca.startSound() sends one on every
    // play, so stale energy/resonator/DC-blocker state never survives a
    // stop-then-replay), and this keeps shake/reset messages from silently
    // queuing up while inactive and all firing at once on reactivation.
    _applyPendingCommands() {
        for (const command of this.pendingCommands) {
            if (command.type === 'shake') {
                this.energy.setEnergy(MARACA_CONFIG.shakeImpulseScale * (command.amount ?? 1));
            } else if (command.type === 'reset') {
                this.energy.reset();
                this.exciter.reset();
                this.resonators.reset();
                this.output.reset();
            }
        }
        this.pendingCommands.length = 0;
    }

    process(inputs, outputs, parameters) {
        this._applyPendingCommands();

        const channel = outputs[0]?.[0];
        if (!channel) return true;

        if (parameters.active[0] < 0.5) {
            channel.fill(0);
            return true;
        }

        // k-rate parameters: recomputed once per block, not per sample --
        // cheap here (a handful of trig calls), and matches every other
        // worklet in this codebase's own per-block parameter reads.
        this.energy.setDecaySeconds(parameters.systemDecay[0]);
        this.resonators.setMode(
            0,
            parameters.resonanceFrequency[0],
            MARACA_CONFIG.modeDecaySeconds,
            MARACA_CONFIG.modeGain
        );
        const driveLevel = parameters.shakeEnergy[0];
        const numberOfObjects = parameters.numberOfObjects[0];

        for (let i = 0; i < channel.length; i++) {
            const energyLevel = this.energy.tick(driveLevel);
            const collisionAmplitude = this.collisions.tick(energyLevel, numberOfObjects);
            const excitation = this.exciter.tick(collisionAmplitude);
            const resonated = this.resonators.tick(excitation);
            channel[i] = this.output.tick(resonated);
        }

        return true;
    }
}

registerProcessor('maracaProcessor', MaracaProcessor);
