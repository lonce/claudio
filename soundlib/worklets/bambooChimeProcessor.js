import { SeededRandom } from '../utilities/SeededRandom.js';
import { EnergyAccumulator } from '../utilities/EnergyAccumulator.js';
import { StochasticCollisionGenerator } from '../utilities/StochasticCollisionGenerator.js';
import { NoiseBurstExciter } from '../utilities/NoiseBurstExciter.js';
import { ResonatorBank } from '../utilities/ResonatorBank.js';
import { OutputConditioner } from '../utilities/OutputConditioner.js';
import { bandwidthFromDecay } from '../utilities/decayMath.js';
import { BAMBOO_CHIME_CONFIG, BAMBOO_TUBE_FREQUENCIES, NUMBER_OF_TUBES } from './bambooChimeConfig.js';

/**
 * Worklet-native PhISEM (Cook/STK "Tuned Bamboo Chimes", type 22 --
 * ANGKLUNG_* in STK's own source) bamboo chime cluster: mechanical energy
 * accumulation and stochastic collision generation exactly as
 * maracaProcessor.js, but each collision excites ONE randomly-chosen tube
 * (of NUMBER_OF_TUBES) rather than a single shared body resonance -- the
 * other tubes keep ringing/decaying on their own persistent filter state.
 * See docs/MODEL_PATTERNS.md archetype 5.1's Phase G note and
 * soundlib/utilities/ResonatorBank.js's excite()/tick() API this relies on.
 */
class BambooChimeProcessor extends AudioWorkletProcessor {
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

        this.resonators = new ResonatorBank(this.processorSampleRate, NUMBER_OF_TUBES);
        BAMBOO_TUBE_FREQUENCIES.forEach((freq, i) => {
            this.resonators.setMode(i, freq, BAMBOO_CHIME_CONFIG.tubeModeDecaySeconds, BAMBOO_CHIME_CONFIG.modeGain);
        });

        this.output = new OutputConditioner({ outputGain: BAMBOO_CHIME_CONFIG.outputGain });

        // Which tube is currently receiving the shared exciter's ongoing
        // output -- only reassigned on a new collision (see process()).
        this.currentTubeIndex = 0;

        this.pendingCommands = [];
        this.port.onmessage = ({ data }) => {
            if (data?.type === 'strike' || data?.type === 'reset') {
                this.pendingCommands.push(data);
            }
        };
    }

    // Applied unconditionally, even while `active` is 0 -- same reasoning
    // as maracaProcessor.js: a 'reset' must always take effect promptly,
    // and this keeps strike/reset messages from silently queuing while
    // inactive and all firing at once on reactivation.
    _applyPendingCommands() {
        for (const command of this.pendingCommands) {
            if (command.type === 'strike') {
                this.energy.setEnergy(BAMBOO_CHIME_CONFIG.strikeImpulseScale * (command.amount ?? 1));
            } else if (command.type === 'reset') {
                this.energy.reset();
                this.exciter.reset();
                this.resonators.reset();
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

        // k-rate parameters: recomputed once per block, matching every
        // other worklet in this codebase.
        this.energy.setDecaySeconds(parameters.systemDecay[0]);
        const tubeModeDecaySeconds = bandwidthFromDecay(parameters.resonanceBandwidth[0]);
        const frequencyScale = parameters.frequencyScale[0];
        BAMBOO_TUBE_FREQUENCIES.forEach((freq, i) => {
            this.resonators.setMode(i, freq * frequencyScale, tubeModeDecaySeconds, BAMBOO_CHIME_CONFIG.modeGain);
        });
        this.exciter.setDecaySeconds(parameters.collisionDecaySeconds[0]);
        this.collisions.setRateScale(parameters.collisionRateScale[0]);
        const driveLevel = parameters.shakeEnergy[0];
        const collisionDensity = parameters.collisionDensity[0];

        for (let i = 0; i < channel.length; i++) {
            const energyLevel = this.energy.tick(driveLevel);
            const collisionAmplitude = this.collisions.tick(energyLevel, collisionDensity);

            // The struck tube only changes when a NEW collision happens
            // (matching STK's own angklung tick(): `iTube` is reassigned on
            // a collision, not every sample). Between collisions, the
            // shared exciter's own ongoing decay (collisionDecaySeconds)
            // keeps feeding whichever tube was most recently struck, every
            // sample -- not just the single sample the collision occurred
            // on. Previously the exciter's output was only ever routed to
            // a resonator on the exact collision sample, and discarded
            // every other sample, which is why collisionDecaySeconds had
            // no audible effect regardless of its value.
            if (collisionAmplitude !== 0) {
                this.currentTubeIndex = Math.floor(this.random.unipolar() * NUMBER_OF_TUBES);
            }
            const excitation = this.exciter.tick(collisionAmplitude);
            this.resonators.excite(this.currentTubeIndex, excitation);

            channel[i] = this.output.tick(this.resonators.tick());
        }

        return true;
    }
}

registerProcessor('bambooChimeProcessor', BambooChimeProcessor);
