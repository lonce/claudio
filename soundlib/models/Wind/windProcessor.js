import { SeededRandom } from '../../utilities/SeededRandom.js';
import { SimplexNoise } from '../../utilities/SimplexNoise.js';
import { ResonatorBank } from '../../utilities/ResonatorBank.js';
import { OutputConditioner } from '../../utilities/OutputConditioner.js';
import { decaySecondsFromQ } from '../../utilities/decayMath.js';
import { WIND_CONFIG } from './windConfig.js';

// One-pole lowpass cascade approximating DSWind.py's order-5 Butterworth
// noise pre-filter -- an informed approximation, not an exact match (see
// windConfig.js's LOWPASS_STAGES comment). Kept inline here rather than
// extracted to soundlib/utilities/, since Wind is currently its only
// consumer -- this codebase extracts a shared utility once a second real
// consumer exists (see docs/MODEL_PATTERNS.md archetype 5.2).
class CascadedLowpass {
    constructor(sampleRate, cutoffHz, stages) {
        this.a = 1 - Math.exp(-2 * Math.PI * cutoffHz / sampleRate);
        this.state = new Float64Array(stages);
    }

    reset() {
        this.state.fill(0);
    }

    tick(x) {
        let y = x;
        for (let i = 0; i < this.state.length; i++) {
            this.state[i] += this.a * (y - this.state[i]);
            y = this.state[i];
        }
        return y;
    }
}

// Analytical magnitude response of CascadedLowpass at frequency f -- exact,
// since the lowpass is a fixed, known filter (not adaptive/measured). Used
// to compensate the resonator's gain for how much energy the noise source
// actually has left at whatever frequency the resonator currently sits at
// (a resonator near 180Hz, deep in the lowpass passband, otherwise gets far
// louder than one near 620Hz, close to/above the 400Hz cutoff). See
// windConfig.js's LOWPASS_COMPENSATION_EXPONENT comment.
function lowpassMagnitudeAt(frequencyHz, sampleRate, cutoffHz, stages) {
    const a = 1 - Math.exp(-2 * Math.PI * cutoffHz / sampleRate);
    const w = 2 * Math.PI * frequencyHz / sampleRate;
    const oneStageMagnitude = a / Math.sqrt(1 - 2 * (1 - a) * Math.cos(w) + (1 - a) * (1 - a));
    return oneStageMagnitude ** stages;
}

/**
 * Continuous noise-excited, simplex-modulated resonant filter -- ported
 * from scratch/DS_Wind_1.1/DSWind.py (a non-real-time Python prototype).
 * Broadband noise, lowpass-filtered, excites a single time-varying
 * resonant mode (ResonatorBank, one mode) whose center frequency AND gain
 * are both driven, every block, by the SAME multi-octave simplex
 * trajectory (SimplexNoise.noise1DMultiOctave) -- one shared "gustiness"
 * motion reads as a coherent shift in both pitch and loudness together,
 * not two independently-flickering parameters. Q is set independently
 * (from `howliness`), with a derived compensation factor keeping loudness
 * roughly Q-invariant, replacing the Python's own global peak-
 * normalization (impossible in a continuous real-time stream). See
 * docs/MODEL_PATTERNS.md archetype 5.2.
 *
 * No discrete trigger, no energy accumulator, unlike the PhISEM family
 * (archetype 5.1) -- this is a continuously-playing texture from the
 * moment `active` goes high.
 */
class WindProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'active', defaultValue: 0, minValue: 0, maxValue: 1 },
            { name: 'strength', defaultValue: WIND_CONFIG.strengthDefault, minValue: 0, maxValue: 1 },
            { name: 'deviation', defaultValue: WIND_CONFIG.deviationDefault, minValue: 0, maxValue: 1 },
            { name: 'gustiness', defaultValue: WIND_CONFIG.gustinessDefault, minValue: 0, maxValue: 1 },
            { name: 'howliness', defaultValue: WIND_CONFIG.howlinessDefault, minValue: 0, maxValue: 1 }
        ];
    }

    constructor(options) {
        super();
        const processorOptions = options.processorOptions ?? {};
        this.processorSampleRate = processorOptions.sampleRate ?? sampleRate;
        const seed = processorOptions.seed ?? 1;

        this.random = new SeededRandom(seed);
        this.simplex = new SimplexNoise(seed);
        this.fixedY = SimplexNoise.deriveFixedY(seed);
        this.noiseTime = 0;

        this.lowpass = new CascadedLowpass(this.processorSampleRate, WIND_CONFIG.lowpassCutoffHz, WIND_CONFIG.lowpassStages);
        this.resonators = new ResonatorBank(this.processorSampleRate, 1);
        this.output = new OutputConditioner({ outputGain: WIND_CONFIG.outputGain });

        this.pendingReset = false;
        this.port.onmessage = ({ data }) => {
            if (data?.type === 'reset') this.pendingReset = true;
        };
    }

    process(inputs, outputs, parameters) {
        // Applied unconditionally, even while `active` is 0 -- same
        // reasoning as bambooChimeProcessor.js: a reset posted right
        // before `active` flips to 1 must not be silently skipped.
        if (this.pendingReset) {
            this.resonators.reset();
            this.lowpass.reset();
            this.output.reset();
            this.noiseTime = 0;
            this.pendingReset = false;
        }

        const channel = outputs[0]?.[0];
        if (!channel) return true;

        if (parameters.active[0] < 0.5) {
            channel.fill(0);
            return true;
        }

        const strength = parameters.strength[0];
        const deviation = parameters.deviation[0];
        const gustiness = parameters.gustiness[0];
        const howliness = parameters.howliness[0];

        // k-rate: recomputed once per block, matching every other worklet
        // in this codebase -- NOT per-sample as DSWind.py's offline
        // tvBPfilter() does. motionFreq tops out at 3Hz (gustiness=1), so
        // a ~2.9ms block quantization (128 samples @44.1kHz) of the
        // simplex trajectory is far below anything perceptible; mirrors
        // noiseControlProcessor.js's own block-rate noiseTime advance.
        const blockDuration = channel.length / this.processorSampleRate;
        const motionFreq = WIND_CONFIG.motionFreqScale * gustiness;
        this.noiseTime += motionFreq * blockDuration;
        const simplexValue = this.simplex.noise1DMultiOctave(this.noiseTime, WIND_CONFIG.octaveWeights, this.fixedY);

        const avgCf = WIND_CONFIG.cfBaseHz + WIND_CONFIG.cfStrengthScale * strength;
        const cf = avgCf * 2 ** (WIND_CONFIG.cfDeviationOctaveScale * deviation * simplexValue);
        const gainRaw = WIND_CONFIG.gainFloor + deviation * WIND_CONFIG.gainDeviationScale * (1 + simplexValue) / 2;
        const q = WIND_CONFIG.qScale * howliness + WIND_CONFIG.qFloor;

        // Q-compensation and lowpass-position compensation together keep
        // RMS far more consistent across the full parameter grid than
        // either alone, replacing the lost global peak-normalization --
        // see windConfig.js.
        const qCompensation = q ** -WIND_CONFIG.qCompensationExponent;
        const lowpassMagnitude = lowpassMagnitudeAt(cf, this.processorSampleRate, WIND_CONFIG.lowpassCutoffHz, WIND_CONFIG.lowpassStages);
        const lowpassCompensation = Math.max(lowpassMagnitude, WIND_CONFIG.lowpassCompensationFloor) ** -WIND_CONFIG.lowpassCompensationExponent;
        const resonatorGain = gainRaw * qCompensation * lowpassCompensation;

        // cf changes every block even when howliness (-> q) doesn't, so
        // this must be recomputed every block, not cached.
        const decaySeconds = decaySecondsFromQ(cf, q);
        this.resonators.setMode(0, cf, decaySeconds, resonatorGain);

        for (let i = 0; i < channel.length; i++) {
            const noiseSample = this.random.bipolar();
            const filtered = this.lowpass.tick(noiseSample);
            this.resonators.excite(0, filtered);
            channel[i] = this.output.tick(this.resonators.tick());
        }

        return true;
    }
}

registerProcessor('windProcessor', WindProcessor);
