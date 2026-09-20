// Node-side mirror of bambooChimeProcessor.js's DSP composition -- same
// rationale as maracaPipelineCore.js in this directory: a hand-maintained
// mirror (AudioWorkletProcessor requires a browser), extracted so
// soundlib/utilities/test/bambooChimePipeline.test.js and
// scripts/checkParameterSanity.js share one copy instead of two. Must be
// kept in sync BY HAND with bambooChimeProcessor.js's actual process()
// loop -- in particular the routing rule: the struck tube only changes on
// a new collision; the shared exciter's ongoing decay keeps feeding
// whichever tube was last struck every sample in between (this was a real,
// fixed bug -- getting this wrong is exactly what
// scripts/checkParameterSanity.js exists to catch).

import { SeededRandom } from '../../utilities/SeededRandom.js';
import { EnergyAccumulator } from '../../utilities/EnergyAccumulator.js';
import { StochasticCollisionGenerator } from '../../utilities/StochasticCollisionGenerator.js';
import { NoiseBurstExciter } from '../../utilities/NoiseBurstExciter.js';
import { ResonatorBank } from '../../utilities/ResonatorBank.js';
import { OutputConditioner } from '../../utilities/OutputConditioner.js';
import { bandwidthFromDecay } from '../../utilities/decayMath.js';
import { BAMBOO_CHIME_CONFIG, BAMBOO_TUBE_FREQUENCIES, NUMBER_OF_TUBES } from '../bambooChimeConfig.js';

export function buildBambooChimePipeline(sampleRate, seed, settings = {}) {
    const {
        systemDecay = BAMBOO_CHIME_CONFIG.systemDecayDefault,
        resonanceBandwidth, // Hz; if omitted, BAMBOO_CHIME_CONFIG.tubeModeDecaySeconds is used directly
        frequencyScale = 1.0,
        collisionRateScale = BAMBOO_CHIME_CONFIG.collisionRateScaleDefault,
        collisionDecaySeconds = BAMBOO_CHIME_CONFIG.collisionDecaySeconds
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
    const tubeModeDecaySeconds = resonanceBandwidth !== undefined
        ? bandwidthFromDecay(resonanceBandwidth)
        : BAMBOO_CHIME_CONFIG.tubeModeDecaySeconds;
    BAMBOO_TUBE_FREQUENCIES.forEach((freq, i) => {
        resonators.setMode(i, freq * frequencyScale, tubeModeDecaySeconds, BAMBOO_CHIME_CONFIG.modeGain);
    });
    const output = new OutputConditioner({ outputGain: BAMBOO_CHIME_CONFIG.outputGain });
    return { random, energy, collisions, exciter, resonators, output };
}

export function renderBambooStrike(sampleRate, seed, settings, collisionDensity, seconds) {
    const pipeline = buildBambooChimePipeline(sampleRate, seed, settings);
    pipeline.energy.injectImpulse(BAMBOO_CHIME_CONFIG.strikeImpulseScale);

    const frameCount = Math.round(sampleRate * seconds);
    const samples = new Float64Array(frameCount);
    let currentTubeIndex = 0;

    for (let i = 0; i < frameCount; i++) {
        const energyLevel = pipeline.energy.tick(0);
        const collisionAmplitude = pipeline.collisions.tick(energyLevel, collisionDensity);

        if (collisionAmplitude !== 0) {
            currentTubeIndex = Math.floor(pipeline.random.unipolar() * NUMBER_OF_TUBES);
        }
        const excitation = pipeline.exciter.tick(collisionAmplitude);
        pipeline.resonators.excite(currentTubeIndex, excitation);

        samples[i] = pipeline.output.tick(pipeline.resonators.tick());
    }

    return samples;
}

// Approximates holding the X/Y pad: collisionDensity + driveLevel held
// steady, no discrete strike. Not covered by any current test.
export function renderBambooSustained(sampleRate, seed, settings, collisionDensity, driveLevel, seconds) {
    const pipeline = buildBambooChimePipeline(sampleRate, seed, settings);

    const frameCount = Math.round(sampleRate * seconds);
    const samples = new Float64Array(frameCount);
    let currentTubeIndex = 0;

    for (let i = 0; i < frameCount; i++) {
        const energyLevel = pipeline.energy.tick(driveLevel);
        const collisionAmplitude = pipeline.collisions.tick(energyLevel, collisionDensity);

        if (collisionAmplitude !== 0) {
            currentTubeIndex = Math.floor(pipeline.random.unipolar() * NUMBER_OF_TUBES);
        }
        const excitation = pipeline.exciter.tick(collisionAmplitude);
        pipeline.resonators.excite(currentTubeIndex, excitation);

        samples[i] = pipeline.output.tick(pipeline.resonators.tick());
    }

    return samples;
}
