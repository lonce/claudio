// End-to-end test of the ChimeVocoder DSP pipeline exactly as
// soundlib/models/ChimeVocoder/chimeVocoderProcessor.js composes it,
// minus the AudioWorkletProcessor/registerProcessor plumbing (which
// requires a browser), mirroring maracaPipeline.test.js/
// bambooChimePipeline.test.js's own rigor and pattern. Covers what the
// DSP composition can actually prove in isolation -- the model's real
// lifecycle through a live AudioContext (GrannyInteractive child
// play()/stop()/destroy(), the .connect() edge itself, actual channel
// downmixing) is NOT exercised here; see docs/MODEL_PATTERNS.md's
// cross-synthesis/vocoder archetype for what needs manual/browser
// verification instead and why.

import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRandom } from '../SeededRandom.js';
import { renderChimeVocoder } from '../../models/ChimeVocoder/chimeVocoderPipelineCore.js';

const SAMPLE_RATE = 44100;

function whiteNoiseCarrier(seed, amplitude) {
    const random = new SeededRandom(seed);
    return () => random.bipolar() * amplitude;
}

function rms(samples) {
    let sum = 0;
    for (const s of samples) sum += s * s;
    return Math.sqrt(sum / samples.length);
}

test('silence with no strike and no carrier connected', () => {
    const samples = renderChimeVocoder(SAMPLE_RATE, 1, {}, 1.2, 0.5, {});
    for (const s of samples) assert.equal(s, 0);
});

test('silence with a carrier connected but the hidden chime engine never struck -- nothing to shape it with', () => {
    const samples = renderChimeVocoder(SAMPLE_RATE, 1, {}, 1.2, 0.5, { carrierFn: whiteNoiseCarrier(2, 0.3) });
    for (const s of samples) assert.equal(s, 0);
});

test('silence when struck but no carrier is connected -- nothing for the envelope to shape', () => {
    const samples = renderChimeVocoder(SAMPLE_RATE, 1, {}, 1.2, 1, { strike: true });
    for (const s of samples) assert.equal(s, 0);
});

test('a strike plus a carrier produces audible, finite, non-clipping output', () => {
    const samples = renderChimeVocoder(SAMPLE_RATE, 42, {}, 1.2, 3, {
        strike: true,
        carrierFn: whiteNoiseCarrier(7, 0.3)
    });
    let peak = 0;
    for (const s of samples) {
        assert.ok(Number.isFinite(s), `expected finite output, got ${s}`);
        const a = Math.abs(s);
        if (a > peak) peak = a;
    }
    assert.ok(peak > 0.001, `expected audible output, peak was ${peak}`);
    assert.ok(peak < 4, `expected output to stay under the OutputConditioner hard clamp, peak was ${peak}`);
});

test('same seed and same carrier render identically', () => {
    const a = renderChimeVocoder(SAMPLE_RATE, 4, {}, 1.2, 1, { strike: true, carrierFn: whiteNoiseCarrier(9, 0.3) });
    const b = renderChimeVocoder(SAMPLE_RATE, 4, {}, 1.2, 1, { strike: true, carrierFn: whiteNoiseCarrier(9, 0.3) });
    assert.deepEqual(Array.from(a), Array.from(b));
});

test('different seeds diverge', () => {
    const a = renderChimeVocoder(SAMPLE_RATE, 5, {}, 1.2, 1, { strike: true, carrierFn: whiteNoiseCarrier(9, 0.3) });
    const b = renderChimeVocoder(SAMPLE_RATE, 6, {}, 1.2, 1, { strike: true, carrierFn: whiteNoiseCarrier(9, 0.3) });
    assert.notDeepEqual(Array.from(a), Array.from(b));
});

test('no NaN or Infinity across a full render at extreme parameter settings', () => {
    for (const envelopeSmoothing of [0.001, 0.25]) {
        for (const frequencyScale of [0.5, 4.0]) {
            const samples = renderChimeVocoder(
                SAMPLE_RATE, 7, { envelopeSmoothing, frequencyScale }, 1.2, 1,
                { strike: true, carrierFn: whiteNoiseCarrier(11, 0.3) }
            );
            for (const s of samples) {
                assert.ok(Number.isFinite(s), `expected finite output, got ${s}`);
            }
        }
    }
});

// Confirms parameter changes actually reach the render, not just that
// nothing crashes -- the same class of bug this whole test infrastructure
// exists to catch (see BambooChimes' collisionDecaySeconds routing bug).
test('envelopeSmoothing measurably changes the output', () => {
    const fast = renderChimeVocoder(SAMPLE_RATE, 42, { envelopeSmoothing: 0.001 }, 1.2, 2, {
        strike: true,
        carrierFn: whiteNoiseCarrier(7, 0.3)
    });
    const slow = renderChimeVocoder(SAMPLE_RATE, 42, { envelopeSmoothing: 0.25 }, 1.2, 2, {
        strike: true,
        carrierFn: whiteNoiseCarrier(7, 0.3)
    });
    const ratio = Math.max(rms(fast), rms(slow)) / Math.max(1e-9, Math.min(rms(fast), rms(slow)));
    assert.ok(ratio > 1.05, `expected envelopeSmoothing to measurably change the output, RMS ratio was ${ratio}`);
});
