// End-to-end test of the Wind DSP pipeline exactly as
// soundlib/models/Wind/windProcessor.js composes it, minus the
// AudioWorkletProcessor/registerProcessor plumbing (which requires a
// browser and can't run under `node --test`), mirroring
// chimeVocoderPipeline.test.js/maracaPipeline.test.js's own pattern.

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWind } from '../../models/Wind/windPipelineCore.js';

const SAMPLE_RATE = 44100;

function rms(samples) {
    let sum = 0;
    for (const s of samples) sum += s * s;
    return Math.sqrt(sum / samples.length);
}

function peak(samples) {
    let p = 0;
    for (const s of samples) {
        const a = Math.abs(s);
        if (a > p) p = a;
    }
    return p;
}

test('same seed renders identically', () => {
    const a = renderWind(SAMPLE_RATE, 4, {}, 1.5);
    const b = renderWind(SAMPLE_RATE, 4, {}, 1.5);
    assert.deepEqual(Array.from(a), Array.from(b));
});

test('different seeds diverge', () => {
    const a = renderWind(SAMPLE_RATE, 5, {}, 1.5);
    const b = renderWind(SAMPLE_RATE, 6, {}, 1.5);
    assert.notDeepEqual(Array.from(a), Array.from(b));
});

test('no NaN or Infinity across the full parameter grid, including corners', () => {
    const vals = [0, 0.5, 1];
    for (const strength of vals) {
        for (const deviation of vals) {
            for (const gustiness of vals) {
                for (const howliness of vals) {
                    const samples = renderWind(SAMPLE_RATE, 7, { strength, deviation, gustiness, howliness }, 1.5);
                    for (const s of samples) {
                        assert.ok(
                            Number.isFinite(s),
                            `expected finite output at strength=${strength} deviation=${deviation} gustiness=${gustiness} howliness=${howliness}, got ${s}`
                        );
                    }
                }
            }
        }
    }
});

test('peak stays under the OutputConditioner hard clamp with margin across the full parameter grid', () => {
    const vals = [0, 0.5, 1];
    let worstPeak = 0;
    let worstParams = null;
    for (const strength of vals) {
        for (const deviation of vals) {
            for (const gustiness of vals) {
                for (const howliness of vals) {
                    const samples = renderWind(SAMPLE_RATE, 7, { strength, deviation, gustiness, howliness }, 4);
                    const p = peak(samples);
                    if (p > worstPeak) {
                        worstPeak = p;
                        worstParams = { strength, deviation, gustiness, howliness };
                    }
                }
            }
        }
    }
    // A high-Q resonator driven by broadband noise is a narrowband
    // stochastic process whose true peak has no finite bound over
    // unbounded listening time (see windConfig.js's OUTPUT_GAIN comment) --
    // this only checks that a representative render stays comfortably
    // under the clamp (4.0), not that clipping can never occur.
    assert.ok(
        worstPeak < 3.5,
        `expected worst-case peak comfortably under the clamp (4.0), got ${worstPeak} at ${JSON.stringify(worstParams)}`
    );
});

test('howliness alone does not cause runaway loudness growth (Q-compensation regression check)', () => {
    const settings = { strength: 0.5, deviation: 0.3, gustiness: 0.3 };
    const low = renderWind(SAMPLE_RATE, 42, { ...settings, howliness: 0 }, 3);
    const high = renderWind(SAMPLE_RATE, 42, { ...settings, howliness: 1 }, 3);
    const ratio = rms(high) / rms(low);
    // Uncompensated, this ratio would be close to sqrt(40.5/0.5) ~= 9x.
    assert.ok(ratio < 5, `expected Q-compensation to keep the howliness=0..1 RMS ratio well under the uncompensated ~9x, got ${ratio}`);
});

test('strength measurably changes the render', () => {
    const low = renderWind(SAMPLE_RATE, 42, { strength: 0, deviation: 0.3, gustiness: 0.3, howliness: 0.3 }, 2);
    const high = renderWind(SAMPLE_RATE, 42, { strength: 1, deviation: 0.3, gustiness: 0.3, howliness: 0.3 }, 2);
    assert.notDeepEqual(Array.from(low), Array.from(high));
});

test('gustiness measurably changes the render', () => {
    const low = renderWind(SAMPLE_RATE, 42, { strength: 0.5, deviation: 0.3, gustiness: 0, howliness: 0.3 }, 2);
    const high = renderWind(SAMPLE_RATE, 42, { strength: 0.5, deviation: 0.3, gustiness: 1, howliness: 0.3 }, 2);
    assert.notDeepEqual(Array.from(low), Array.from(high));
});

test('deviation measurably changes the render', () => {
    const low = renderWind(SAMPLE_RATE, 42, { strength: 0.5, deviation: 0, gustiness: 0.3, howliness: 0.3 }, 2);
    const high = renderWind(SAMPLE_RATE, 42, { strength: 0.5, deviation: 1, gustiness: 0.3, howliness: 0.3 }, 2);
    assert.notDeepEqual(Array.from(low), Array.from(high));
});
