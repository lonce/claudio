// End-to-end test of the bamboo-chime DSP pipeline exactly as
// soundlib/worklets/bambooChimeProcessor.js composes it, minus the
// AudioWorkletProcessor/registerProcessor plumbing (which requires a
// browser), mirroring soundlib/utilities/test/maracaPipeline.test.js's own
// rigor and pattern. This deliberately does NOT attempt to spectrally
// prove "7 distinct pitches" or "cross-tube overlap" -- that's a listening
// judgment (see docs/MODEL_PATTERNS.md archetype 5.1's Phase G note), not
// a unit-test claim. The actual per-mode-independence capability this
// model relies on is proven directly and deterministically in
// ResonatorBank.test.js instead.

import test from 'node:test';
import assert from 'node:assert/strict';
import { BAMBOO_CHIME_CONFIG } from '../../worklets/bambooChimeConfig.js';
import { buildBambooChimePipeline, renderBambooStrike } from '../../worklets/test-support/bambooChimePipelineCore.js';

const SAMPLE_RATE = 48000;

// Thin wrappers preserving this file's original local names/signatures --
// the actual pipeline composition now lives in bambooChimePipelineCore.js
// (shared with scripts/checkParameterSanity.js) to avoid a second
// hand-maintained copy of bambooChimeProcessor.js's logic.
function buildPipeline(seed) {
    return buildBambooChimePipeline(SAMPLE_RATE, seed);
}

function renderStrike(seed, collisionDensity, seconds) {
    return renderBambooStrike(SAMPLE_RATE, seed, {}, collisionDensity, seconds);
}

test('silence before any strike', () => {
    const pipeline = buildPipeline(1);
    for (let i = 0; i < 1000; i++) {
        const energyLevel = pipeline.energy.tick(0);
        const collisionAmplitude = pipeline.collisions.tick(energyLevel, BAMBOO_CHIME_CONFIG.collisionDensityDefault);
        pipeline.exciter.tick(collisionAmplitude); // collisionAmplitude is always 0 here (no energy)
        assert.equal(pipeline.output.tick(pipeline.resonators.tick()), 0);
    }
});

test('energy decays to silence with no further drive after a strike', () => {
    const samples = renderStrike(3, BAMBOO_CHIME_CONFIG.collisionDensityDefault, 3);
    const lastTenthSecond = samples.slice(-Math.round(SAMPLE_RATE * 0.1));
    const rms = Math.sqrt(
        lastTenthSecond.reduce((sum, v) => sum + v * v, 0) / lastTenthSecond.length
    );
    assert.ok(rms < 1e-3, `expected near-silence after decay, RMS was ${rms}`);
});

test('same seed and same strike sequence render identically', () => {
    const a = renderStrike(4, BAMBOO_CHIME_CONFIG.collisionDensityDefault, 1);
    const b = renderStrike(4, BAMBOO_CHIME_CONFIG.collisionDensityDefault, 1);
    assert.deepEqual(Array.from(a), Array.from(b));
});

test('different seeds diverge', () => {
    const a = renderStrike(5, BAMBOO_CHIME_CONFIG.collisionDensityDefault, 1);
    const b = renderStrike(6, BAMBOO_CHIME_CONFIG.collisionDensityDefault, 1);
    assert.notDeepEqual(Array.from(a), Array.from(b));
});

test('no NaN or Infinity across a full render, at low and high collision density', () => {
    for (const collisionDensity of [0.1, BAMBOO_CHIME_CONFIG.collisionDensityDefault, 20]) {
        const samples = renderStrike(7, collisionDensity, 2);
        for (const sample of samples) {
            assert.ok(Number.isFinite(sample), `expected finite output, got ${sample}`);
        }
    }
});
