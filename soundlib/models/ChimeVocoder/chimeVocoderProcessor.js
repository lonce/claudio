import { SeededRandom } from '../../utilities/SeededRandom.js';
import { EnergyAccumulator } from '../../utilities/EnergyAccumulator.js';
import { StochasticCollisionGenerator } from '../../utilities/StochasticCollisionGenerator.js';
import { NoiseBurstExciter } from '../../utilities/NoiseBurstExciter.js';
import { ResonatorBank } from '../../utilities/ResonatorBank.js';
import { OutputConditioner } from '../../utilities/OutputConditioner.js';
import { EnvelopeFollowerBank } from '../../utilities/EnvelopeFollowerBank.js';
import { bandwidthFromDecay } from '../../utilities/decayMath.js';
import { BAMBOO_CHIME_CONFIG, BAMBOO_TUBE_FREQUENCIES, NUMBER_OF_TUBES, CHIME_VOCODER_CONFIG } from './chimeVocoderConfig.js';

const INVERSE_SQRT_NUMBER_OF_TUBES = 1 / Math.sqrt(NUMBER_OF_TUBES);

/**
 * Cross-synthesis / vocoder worklet: BambooChimes' own PhISEM engine
 * (bambooChimeProcessor.js, reused verbatim in structure) runs hidden --
 * its own resonator output never reaches the output, only its per-tube
 * .y1[i] values (envelope-followed) are read as 7 control signals. A
 * second ResonatorBank, tuned identically, is excited every sample by an
 * external carrier signal (inputs[0][0] -- e.g. a GrannyInteractive
 * instance's output, connected in from the model side) with ALL 7 modes
 * excited together (a true parallel filterbank), not one-at-a-time like
 * the hidden chime engine. Each carrier band is multiplied by its
 * matching chime-tube envelope and summed. See docs/MODEL_PATTERNS.md's
 * cross-synthesis/vocoder archetype.
 */
class ChimeVocoderProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'active', defaultValue: 0, minValue: 0, maxValue: 1 },
            { name: 'shakeEnergy', defaultValue: 0, minValue: 0, maxValue: 1 },
            { name: 'systemDecay', defaultValue: BAMBOO_CHIME_CONFIG.systemDecayDefault, minValue: 0.01, maxValue: 2.0 },
            { name: 'collisionDensity', defaultValue: BAMBOO_CHIME_CONFIG.collisionDensityDefault, minValue: 0.01, maxValue: 64 },
            {
                name: 'resonanceBandwidth',
                defaultValue: bandwidthFromDecay(BAMBOO_CHIME_CONFIG.tubeModeDecaySeconds),
                minValue: 2,
                maxValue: 100
            },
            { name: 'frequencyScale', defaultValue: 1.0, minValue: 0.25, maxValue: 4.0 },
            {
                name: 'collisionDecaySeconds',
                defaultValue: BAMBOO_CHIME_CONFIG.collisionDecaySeconds,
                minValue: 0.0001,
                maxValue: 0.01
            },
            {
                name: 'collisionRateScale',
                defaultValue: BAMBOO_CHIME_CONFIG.collisionRateScaleDefault,
                minValue: 0.5,
                maxValue: 64
            },
            {
                name: 'envelopeSmoothing',
                defaultValue: CHIME_VOCODER_CONFIG.envelopeSmoothingDefault,
                minValue: CHIME_VOCODER_CONFIG.envelopeSmoothingMin,
                maxValue: CHIME_VOCODER_CONFIG.envelopeSmoothingMax
            }
        ];
    }

    constructor(options) {
        super();
        const processorOptions = options.processorOptions ?? {};
        this.processorSampleRate = processorOptions.sampleRate ?? sampleRate;
        const seed = processorOptions.seed ?? 1;

        this.random = new SeededRandom(seed);

        this.energy = new EnergyAccumulator(this.processorSampleRate, {
            maxEnergy: BAMBOO_CHIME_CONFIG.energyMax,
            driveScale: BAMBOO_CHIME_CONFIG.driveScale
        });

        this.collisions = new StochasticCollisionGenerator(this.processorSampleRate, {
            rateScale: BAMBOO_CHIME_CONFIG.collisionRateScaleDefault,
            amplitudeScale: BAMBOO_CHIME_CONFIG.collisionAmplitudeScale,
            random: this.random
        });

        this.exciter = new NoiseBurstExciter(this.processorSampleRate, { random: this.random });
        this.exciter.setDecaySeconds(BAMBOO_CHIME_CONFIG.collisionDecaySeconds);

        // Hidden chime engine -- its own summed tick() return is never
        // used, only its per-mode .y1[i] values are read.
        this.resonators = new ResonatorBank(this.processorSampleRate, NUMBER_OF_TUBES);
        // Carrier filterbank -- all 7 modes excited by the same external
        // sample every tick, tuned identically to the hidden chime engine.
        this.carrierResonators = new ResonatorBank(this.processorSampleRate, NUMBER_OF_TUBES);
        BAMBOO_TUBE_FREQUENCIES.forEach((freq, i) => {
            this.resonators.setMode(i, freq, BAMBOO_CHIME_CONFIG.tubeModeDecaySeconds, BAMBOO_CHIME_CONFIG.modeGain);
            this.carrierResonators.setMode(i, freq, BAMBOO_CHIME_CONFIG.tubeModeDecaySeconds, BAMBOO_CHIME_CONFIG.modeGain);
        });

        this.envelopes = new EnvelopeFollowerBank(this.processorSampleRate, NUMBER_OF_TUBES);
        this.envelopes.setTimeConstant(CHIME_VOCODER_CONFIG.envelopeSmoothingDefault);

        this.output = new OutputConditioner({ outputGain: CHIME_VOCODER_CONFIG.outputGain });

        // Which tube is currently receiving the hidden chime engine's
        // shared exciter output -- only reassigned on a new collision.
        this.currentTubeIndex = 0;

        this.pendingCommands = [];
        this.port.onmessage = ({ data }) => {
            if (data?.type === 'strike' || data?.type === 'reset') {
                this.pendingCommands.push(data);
            }
        };
    }

    _applyPendingCommands() {
        for (const command of this.pendingCommands) {
            if (command.type === 'strike') {
                this.energy.setEnergy(BAMBOO_CHIME_CONFIG.strikeImpulseScale * (command.amount ?? 1));
            } else if (command.type === 'reset') {
                this.energy.reset();
                this.exciter.reset();
                this.resonators.reset();
                this.carrierResonators.reset();
                this.envelopes.reset();
                this.output.reset();
                this.currentTubeIndex = 0;
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

        // k-rate parameters, recomputed once per block.
        this.energy.setDecaySeconds(parameters.systemDecay[0]);
        const tubeModeDecaySeconds = bandwidthFromDecay(parameters.resonanceBandwidth[0]);
        const frequencyScale = parameters.frequencyScale[0];
        BAMBOO_TUBE_FREQUENCIES.forEach((freq, i) => {
            const f = freq * frequencyScale;
            // Tied tuning: the carrier is shaped at the same pitches the
            // hidden chime engine actually rings at.
            this.resonators.setMode(i, f, tubeModeDecaySeconds, BAMBOO_CHIME_CONFIG.modeGain);
            this.carrierResonators.setMode(i, f, tubeModeDecaySeconds, BAMBOO_CHIME_CONFIG.modeGain);
        });
        this.exciter.setDecaySeconds(parameters.collisionDecaySeconds[0]);
        this.collisions.setRateScale(parameters.collisionRateScale[0]);
        this.envelopes.setTimeConstant(parameters.envelopeSmoothing[0]);
        const driveLevel = parameters.shakeEnergy[0];
        const collisionDensity = parameters.collisionDensity[0];

        const inputChannel = inputs[0]?.[0]; // undefined until something is connected in

        for (let i = 0; i < channel.length; i++) {
            // ---- hidden chime engine: never summed into output ----
            const energyLevel = this.energy.tick(driveLevel);
            const collisionAmplitude = this.collisions.tick(energyLevel, collisionDensity);
            if (collisionAmplitude !== 0) {
                this.currentTubeIndex = Math.floor(this.random.unipolar() * NUMBER_OF_TUBES);
            }
            const excitation = this.exciter.tick(collisionAmplitude);
            this.resonators.excite(this.currentTubeIndex, excitation);
            this.resonators.tick(); // summed return discarded -- only .y1[] used below

            // ---- carrier filterbank: all 7 modes excited by the same sample ----
            const carrierSample = inputChannel ? (inputChannel[i] ?? 0) : 0;
            for (let j = 0; j < NUMBER_OF_TUBES; j++) {
                this.carrierResonators.excite(j, carrierSample);
            }
            this.carrierResonators.tick(); // summed return discarded -- only .y1[] used below

            // ---- per-band envelope-follow, multiply, sum ----
            let mixed = 0;
            for (let j = 0; j < NUMBER_OF_TUBES; j++) {
                const envelope = this.envelopes.tick(j, this.resonators.y1[j]);
                mixed += this.carrierResonators.y1[j] * envelope;
            }

            // All 7 carrier bands are driven by the same input sample
            // through high-Q resonators, so they're strongly correlated,
            // not independent -- summing them without normalizing grows
            // roughly linearly with tube count and clips hard in practice
            // (confirmed empirically: peak hit the OutputConditioner clamp
            // even at outputGain=0.1 with a plain white-noise carrier,
            // before this normalization). Same 1/sqrt(filterCount)
            // principle docs/MODEL_PATTERNS.md's archetype 2 already
            // documents for BellStrike's noise-bank summing.
            channel[i] = this.output.tick(mixed * INVERSE_SQRT_NUMBER_OF_TUBES);
        }

        return true;
    }
}

registerProcessor('chimeVocoderProcessor', ChimeVocoderProcessor);
