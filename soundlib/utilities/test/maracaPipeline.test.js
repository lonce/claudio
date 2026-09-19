// End-to-end test of the maraca DSP pipeline exactly as
// soundlib/worklets/maracaProcessor.js composes it, minus the
// AudioWorkletProcessor/registerProcessor plumbing (which requires a
// browser and can't run under `node --test`). Exercises the acceptance
// checks from fromChat/energy/Claudio-PhISEM-Architecture-and-Maraca-
// First-Pass.md section 12.2/12.3: seeded determinism, no NaN/Infinity,
// silence before energy, and -- the point raised during review -- that a
// single shake produces a decaying *cloud* of many micro-collisions, not
// one fixed burst.

import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRandom } from '../SeededRandom.js';
import { EnergyAccumulator } from '../EnergyAccumulator.js';
import { StochasticCollisionGenerator } from '../StochasticCollisionGenerator.js';
import { NoiseBurstExciter } from '../NoiseBurstExciter.js';
import { ResonatorBank } from '../ResonatorBank.js';
import { OutputConditioner } from '../OutputConditioner.js';
import { MARACA_CONFIG } from '../../worklets/maracaConfig.js';

const SAMPLE_RATE = 48000;

function buildPipeline(seed) {
    const random = new SeededRandom(seed);
    const energy = new EnergyAccumulator(SAMPLE_RATE, {
        maxEnergy: MARACA_CONFIG.energyMax,
        driveScale: MARACA_CONFIG.driveScale
    });
    energy.setDecaySeconds(0.35);
    const collisions = new StochasticCollisionGenerator(SAMPLE_RATE, {
        rateScale: MARACA_CONFIG.collisionRateScale,
        amplitudeScale: MARACA_CONFIG.collisionAmplitudeScale,
        random
    });
    const exciter = new NoiseBurstExciter(SAMPLE_RATE, { random });
    exciter.setDecaySeconds(MARACA_CONFIG.collisionDecaySeconds);
    const resonators = new ResonatorBank(SAMPLE_RATE, 4);
    resonators.setMode(0, 3200, MARACA_CONFIG.modeDecaySeconds, MARACA_CONFIG.modeGain);
    const output = new OutputConditioner({ outputGain: MARACA_CONFIG.outputGain });
    return { random, energy, collisions, exciter, resonators, output };
}

// Renders `seconds` of audio, injecting one shake at t=0. Returns the
// sample buffer and the per-sample collision amplitude trace (0 = no
// collision that sample) so tests can inspect collision timing directly.
function renderShake(seed, numberOfObjects, seconds) {
    const pipeline = buildPipeline(seed);
    pipeline.energy.injectImpulse(MARACA_CONFIG.shakeImpulseScale);

    const frameCount = Math.round(SAMPLE_RATE * seconds);
    const samples = new Float64Array(frameCount);
    const collisionTrace = new Float64Array(frameCount);

    for (let i = 0; i < frameCount; i++) {
        const energyLevel = pipeline.energy.tick(0);
        const collisionAmplitude = pipeline.collisions.tick(energyLevel, numberOfObjects);
        collisionTrace[i] = collisionAmplitude;
        const excitation = pipeline.exciter.tick(collisionAmplitude);
        const resonated = pipeline.resonators.tick(excitation);
        samples[i] = pipeline.output.tick(resonated);
    }

    return { samples, collisionTrace };
}

test('silence before any shake', () => {
    const pipeline = buildPipeline(1);
    for (let i = 0; i < 1000; i++) {
        const energyLevel = pipeline.energy.tick(0);
        const collisionAmplitude = pipeline.collisions.tick(energyLevel, 64);
        const excitation = pipeline.exciter.tick(collisionAmplitude);
        const resonated = pipeline.resonators.tick(excitation);
        assert.equal(pipeline.output.tick(resonated), 0);
    }
});

test('one shake produces a decaying cloud of many micro-collisions, not a single burst', () => {
    const { collisionTrace } = renderShake(2, 64, 1.5);
    const collisionCount = collisionTrace.reduce((count, v) => count + (v !== 0 ? 1 : 0), 0);
    assert.ok(
        collisionCount > 20,
        `expected many discrete collisions from one shake, got ${collisionCount}`
    );

    // And it should actually be a cloud spread over time, not all in one
    // sample block: collisions should still be occurring well after the
    // first one, not all crammed into the first millisecond.
    const firstCollisionIndex = collisionTrace.findIndex((v) => v !== 0);
    const lastCollisionIndex = collisionTrace.length - 1 - [...collisionTrace].reverse().findIndex((v) => v !== 0);
    const spreadSeconds = (lastCollisionIndex - firstCollisionIndex) / SAMPLE_RATE;
    assert.ok(
        spreadSeconds > 0.05,
        `expected collisions spread over a meaningful decay window, got ${spreadSeconds}s`
    );
});

test('energy decays to silence with no further drive after a shake', () => {
    const { samples } = renderShake(3, 64, 3);
    const lastTenthSecond = samples.slice(-Math.round(SAMPLE_RATE * 0.1));
    const rms = Math.sqrt(
        lastTenthSecond.reduce((sum, v) => sum + v * v, 0) / lastTenthSecond.length
    );
    assert.ok(rms < 1e-3, `expected near-silence after decay, RMS was ${rms}`);
});

test('same seed and same shake sequence render identically', () => {
    const a = renderShake(4, 64, 0.5);
    const b = renderShake(4, 64, 0.5);
    assert.deepEqual(Array.from(a.samples), Array.from(b.samples));
});

test('different seeds diverge', () => {
    const a = renderShake(5, 64, 0.5);
    const b = renderShake(6, 64, 0.5);
    assert.notDeepEqual(Array.from(a.samples), Array.from(b.samples));
});

test('no NaN or Infinity across a full render, at low and high object counts', () => {
    for (const numberOfObjects of [4, 256]) {
        const { samples } = renderShake(7, numberOfObjects, 2);
        for (const sample of samples) {
            assert.ok(Number.isFinite(sample), `expected finite output, got ${sample}`);
        }
    }
});
