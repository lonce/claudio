// Node-side mirror of maracaProcessor.js's DSP composition -- exists
// because AudioWorkletProcessor/registerProcessor require a browser and
// can't run under `node --test` or a plain Node script. This is a HAND-
// MAINTAINED mirror, not shared code with the actual worklet: if
// maracaProcessor.js's process() loop changes, this must be updated to
// match by hand.
//
// Used by soundlib/utilities/test/maracaPipeline.test.js and
// scripts/checkParameterSanity.js -- extracted here specifically so those
// two don't each hand-maintain their own copy (this codebase already
// learned that lesson the hard way: a collision-routing bug in
// bambooChimeProcessor.js existed in two duplicated copies at once and had
// to be fixed in both).

import { SeededRandom } from '../../utilities/SeededRandom.js';
import { EnergyAccumulator } from '../../utilities/EnergyAccumulator.js';
import { StochasticCollisionGenerator } from '../../utilities/StochasticCollisionGenerator.js';
import { NoiseBurstExciter } from '../../utilities/NoiseBurstExciter.js';
import { ResonatorBank } from '../../utilities/ResonatorBank.js';
import { OutputConditioner } from '../../utilities/OutputConditioner.js';
import { bandwidthFromDecay } from '../../utilities/decayMath.js';
import { MARACA_CONFIG } from '../maracaConfig.js';

const MAX_MODES = 4; // matches maracaProcessor.js's own preallocated capacity

// `settings` covers everything a caller might want to vary per model
// (Maraca vs. Cabasa share this exact pipeline with different defaults/
// ranges -- see soundlib/models/Cabasa.js). Anything omitted falls back to
// maracaPipeline.test.js's original scenario values, so existing tests
// calling this with no overrides behave identically to before extraction.
export function buildMaracaPipeline(sampleRate, seed, settings = {}) {
    const {
        systemDecay = 0.35,
        resonanceFrequency = 3200,
        resonanceBandwidth, // Hz; if omitted, MARACA_CONFIG.modeDecaySeconds is used directly
        collisionRateScale = MARACA_CONFIG.collisionRateScale,
        collisionDecaySeconds = MARACA_CONFIG.collisionDecaySeconds
    } = settings;

    const random = new SeededRandom(seed);
    const energy = new EnergyAccumulator(sampleRate, {
        maxEnergy: MARACA_CONFIG.energyMax,
        driveScale: MARACA_CONFIG.driveScale
    });
    energy.setDecaySeconds(systemDecay);
    const collisions = new StochasticCollisionGenerator(sampleRate, {
        rateScale: collisionRateScale,
        amplitudeScale: MARACA_CONFIG.collisionAmplitudeScale,
        random
    });
    const exciter = new NoiseBurstExciter(sampleRate, { random });
    exciter.setDecaySeconds(collisionDecaySeconds);
    const resonators = new ResonatorBank(sampleRate, MAX_MODES);
    const modeDecaySeconds = resonanceBandwidth !== undefined
        ? bandwidthFromDecay(resonanceBandwidth)
        : MARACA_CONFIG.modeDecaySeconds;
    resonators.setMode(0, resonanceFrequency, modeDecaySeconds, MARACA_CONFIG.modeGain);
    const output = new OutputConditioner({ outputGain: MARACA_CONFIG.outputGain });
    return { random, energy, collisions, exciter, resonators, output };
}

// Renders `seconds` of audio, injecting one shake at t=0. Returns the
// sample buffer and the per-sample collision amplitude trace (0 = no
// collision that sample).
export function renderMaracaStrike(sampleRate, seed, settings, numberOfObjects, seconds) {
    const pipeline = buildMaracaPipeline(sampleRate, seed, settings);
    pipeline.energy.injectImpulse(MARACA_CONFIG.shakeImpulseScale);

    const frameCount = Math.round(sampleRate * seconds);
    const samples = new Float64Array(frameCount);
    const collisionTrace = new Float64Array(frameCount);

    for (let i = 0; i < frameCount; i++) {
        const energyLevel = pipeline.energy.tick(0);
        const collisionAmplitude = pipeline.collisions.tick(energyLevel, numberOfObjects);
        collisionTrace[i] = collisionAmplitude;
        const excitation = pipeline.exciter.tick(collisionAmplitude);
        pipeline.resonators.excite(0, excitation);
        const resonated = pipeline.resonators.tick();
        samples[i] = pipeline.output.tick(resonated);
    }

    return { samples, collisionTrace };
}

// Renders `seconds` of audio with shakeEnergy held at `driveLevel`
// continuously and no discrete strike -- approximates holding the X/Y pad
// (a sustained continuous-parameter drive), a scenario no current test
// covers.
export function renderMaracaSustained(sampleRate, seed, settings, numberOfObjects, driveLevel, seconds) {
    const pipeline = buildMaracaPipeline(sampleRate, seed, settings);

    const frameCount = Math.round(sampleRate * seconds);
    const samples = new Float64Array(frameCount);

    for (let i = 0; i < frameCount; i++) {
        const energyLevel = pipeline.energy.tick(driveLevel);
        const collisionAmplitude = pipeline.collisions.tick(energyLevel, numberOfObjects);
        const excitation = pipeline.exciter.tick(collisionAmplitude);
        pipeline.resonators.excite(0, excitation);
        const resonated = pipeline.resonators.tick();
        samples[i] = pipeline.output.tick(resonated);
    }

    return samples;
}
