// Node-side mirror of chimeVocoderProcessor.js's DSP composition -- same
// rationale as maracaPipelineCore.js/bambooChimePipelineCore.js: a
// hand-maintained mirror (AudioWorkletProcessor requires a browser),
// extracted so soundlib/utilities/test/chimeVocoderPipeline.test.js has
// one shared copy to exercise rather than a second hand-maintained one.
// Must be kept in sync BY HAND with chimeVocoderProcessor.js's actual
// process() loop.

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

export function buildChimeVocoderPipeline(sampleRate, seed, settings = {}) {
    const {
        systemDecay = BAMBOO_CHIME_CONFIG.systemDecayDefault,
        resonanceBandwidth, // Hz; if omitted, BAMBOO_CHIME_CONFIG.tubeModeDecaySeconds is used directly
        frequencyScale = 1.0,
        collisionRateScale = BAMBOO_CHIME_CONFIG.collisionRateScaleDefault,
        collisionDecaySeconds = BAMBOO_CHIME_CONFIG.collisionDecaySeconds,
        envelopeSmoothing = CHIME_VOCODER_CONFIG.envelopeSmoothingDefault
    } = settings;

    const random = new SeededRandom(seed);
    const energy = new EnergyAccumulator(sampleRate, {
        maxEnergy: BAMBOO_CHIME_CONFIG.energyMax,
        driveScale: BAMBOO_CHIME_CONFIG.driveScale
    });
    energy.setDecaySeconds(systemDecay);
    const collisions = new StochasticCollisionGenerator(sampleRate, {
        rateScale: collisionRateScale,
        amplitudeScale: BAMBOO_CHIME_CONFIG.collisionAmplitudeScale,
        random
    });
    const exciter = new NoiseBurstExciter(sampleRate, { random });
    exciter.setDecaySeconds(collisionDecaySeconds);

    const resonators = new ResonatorBank(sampleRate, NUMBER_OF_TUBES);
    const carrierResonators = new ResonatorBank(sampleRate, NUMBER_OF_TUBES);
    const tubeModeDecaySeconds = resonanceBandwidth !== undefined
        ? bandwidthFromDecay(resonanceBandwidth)
        : BAMBOO_CHIME_CONFIG.tubeModeDecaySeconds;
    BAMBOO_TUBE_FREQUENCIES.forEach((freq, i) => {
        const f = freq * frequencyScale;
        resonators.setMode(i, f, tubeModeDecaySeconds, BAMBOO_CHIME_CONFIG.modeGain);
        carrierResonators.setMode(i, f, tubeModeDecaySeconds, BAMBOO_CHIME_CONFIG.modeGain);
    });

    const envelopes = new EnvelopeFollowerBank(sampleRate, NUMBER_OF_TUBES);
    envelopes.setTimeConstant(envelopeSmoothing);

    const output = new OutputConditioner({ outputGain: CHIME_VOCODER_CONFIG.outputGain });

    return { random, energy, collisions, exciter, resonators, carrierResonators, envelopes, output };
}

// options.strike: inject one energy impulse into the hidden chime engine
// at t=0, same role as BambooChimes' strike().
// options.driveLevel: continuous shakeEnergy-equivalent drive (0 by
// default -- most tests only care about a discrete strike).
// options.carrierFn: (sampleIndex) => carrier sample; defaults to silence
// (no carrier connected).
export function renderChimeVocoder(sampleRate, seed, settings, collisionDensity, seconds, options = {}) {
    const pipeline = buildChimeVocoderPipeline(sampleRate, seed, settings);
    if (options.strike) {
        pipeline.energy.injectImpulse(BAMBOO_CHIME_CONFIG.strikeImpulseScale);
    }

    const frameCount = Math.round(sampleRate * seconds);
    const samples = new Float64Array(frameCount);
    let currentTubeIndex = 0;
    const driveLevel = options.driveLevel ?? 0;
    const carrierFn = options.carrierFn ?? (() => 0);

    for (let i = 0; i < frameCount; i++) {
        const energyLevel = pipeline.energy.tick(driveLevel);
        const collisionAmplitude = pipeline.collisions.tick(energyLevel, collisionDensity);
        if (collisionAmplitude !== 0) {
            currentTubeIndex = Math.floor(pipeline.random.unipolar() * NUMBER_OF_TUBES);
        }
        const excitation = pipeline.exciter.tick(collisionAmplitude);
        pipeline.resonators.excite(currentTubeIndex, excitation);
        pipeline.resonators.tick();

        const carrierSample = carrierFn(i);
        for (let j = 0; j < NUMBER_OF_TUBES; j++) {
            pipeline.carrierResonators.excite(j, carrierSample);
        }
        pipeline.carrierResonators.tick();

        let mixed = 0;
        for (let j = 0; j < NUMBER_OF_TUBES; j++) {
            const envelope = pipeline.envelopes.tick(j, pipeline.resonators.y1[j]);
            mixed += pipeline.carrierResonators.y1[j] * envelope;
        }

        samples[i] = pipeline.output.tick(mixed * INVERSE_SQRT_NUMBER_OF_TUBES);
    }

    return samples;
}
