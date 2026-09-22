// Node-side mirror of windProcessor.js's DSP composition -- same rationale
// as every other pipeline-core file: AudioWorkletProcessor requires a
// browser and can't run under `node --test` or a plain Node script. Must
// be kept in sync BY HAND with windProcessor.js's actual process() loop.

import { SeededRandom } from '../../utilities/SeededRandom.js';
import { SimplexNoise } from '../../utilities/SimplexNoise.js';
import { ResonatorBank } from '../../utilities/ResonatorBank.js';
import { OutputConditioner } from '../../utilities/OutputConditioner.js';
import { decaySecondsFromQ } from '../../utilities/decayMath.js';
import { WIND_CONFIG } from './windConfig.js';

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

// Must stay in sync BY HAND with windProcessor.js's lowpassMagnitudeAt().
function lowpassMagnitudeAt(frequencyHz, sampleRate, cutoffHz, stages) {
    const a = 1 - Math.exp(-2 * Math.PI * cutoffHz / sampleRate);
    const w = 2 * Math.PI * frequencyHz / sampleRate;
    const oneStageMagnitude = a / Math.sqrt(1 - 2 * (1 - a) * Math.cos(w) + (1 - a) * (1 - a));
    return oneStageMagnitude ** stages;
}

export function buildWindPipeline(sampleRate, seed) {
    const random = new SeededRandom(seed);
    const simplex = new SimplexNoise(seed);
    const fixedY = SimplexNoise.deriveFixedY(seed);
    const lowpass = new CascadedLowpass(sampleRate, WIND_CONFIG.lowpassCutoffHz, WIND_CONFIG.lowpassStages);
    const resonators = new ResonatorBank(sampleRate, 1);
    const output = new OutputConditioner({ outputGain: WIND_CONFIG.outputGain });
    return { random, simplex, fixedY, lowpass, resonators, output, noiseTime: 0 };
}

// settings: { strength, deviation, gustiness, howliness }, all optional,
// defaulting from WIND_CONFIG. blockSize matches the worklet's own
// per-block k-rate recompute granularity (128 samples, the standard Web
// Audio render quantum).
export function renderWind(sampleRate, seed, settings = {}, seconds, blockSize = 128) {
    const {
        strength = WIND_CONFIG.strengthDefault,
        deviation = WIND_CONFIG.deviationDefault,
        gustiness = WIND_CONFIG.gustinessDefault,
        howliness = WIND_CONFIG.howlinessDefault
    } = settings;

    const pipeline = buildWindPipeline(sampleRate, seed);
    const frameCount = Math.round(sampleRate * seconds);
    const samples = new Float64Array(frameCount);

    let i = 0;
    while (i < frameCount) {
        const blockLength = Math.min(blockSize, frameCount - i);
        const blockDuration = blockLength / sampleRate;

        const motionFreq = WIND_CONFIG.motionFreqScale * gustiness;
        pipeline.noiseTime += motionFreq * blockDuration;
        const simplexValue = pipeline.simplex.noise1DMultiOctave(pipeline.noiseTime, WIND_CONFIG.octaveWeights, pipeline.fixedY);

        const avgCf = WIND_CONFIG.cfBaseHz + WIND_CONFIG.cfStrengthScale * strength;
        const cf = avgCf * 2 ** (WIND_CONFIG.cfDeviationOctaveScale * deviation * simplexValue);
        const gainRaw = WIND_CONFIG.gainFloor + deviation * WIND_CONFIG.gainDeviationScale * (1 + simplexValue) / 2;
        const q = WIND_CONFIG.qScale * howliness + WIND_CONFIG.qFloor;

        const qCompensation = q ** -WIND_CONFIG.qCompensationExponent;
        const lowpassMagnitude = lowpassMagnitudeAt(cf, sampleRate, WIND_CONFIG.lowpassCutoffHz, WIND_CONFIG.lowpassStages);
        const lowpassCompensation = Math.max(lowpassMagnitude, WIND_CONFIG.lowpassCompensationFloor) ** -WIND_CONFIG.lowpassCompensationExponent;
        const resonatorGain = gainRaw * qCompensation * lowpassCompensation;

        const decaySeconds = decaySecondsFromQ(cf, q);
        pipeline.resonators.setMode(0, cf, decaySeconds, resonatorGain);

        for (let j = 0; j < blockLength; j++) {
            const noiseSample = pipeline.random.bipolar();
            const filtered = pipeline.lowpass.tick(noiseSample);
            pipeline.resonators.excite(0, filtered);
            samples[i + j] = pipeline.output.tick(pipeline.resonators.tick());
        }

        i += blockLength;
    }

    return samples;
}
