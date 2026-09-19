import test from 'node:test';
import assert from 'node:assert/strict';
import { ResonatorBank } from '../ResonatorBank.js';

const SAMPLE_RATE = 48000;

function impulseResponse(bank, length) {
    const out = new Float64Array(length);
    out[0] = bank.tick(1);
    for (let i = 1; i < length; i++) out[i] = bank.tick(0);
    return out;
}

function estimateFrequencyHz(samples, sampleRate) {
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) {
        if (samples[i - 1] < 0 && samples[i] >= 0) crossings++;
    }
    const seconds = samples.length / sampleRate;
    return crossings / seconds;
}

test('a single mode rings at approximately its configured frequency', () => {
    const bank = new ResonatorBank(SAMPLE_RATE, 4);
    bank.setMode(0, 1000, 0.05, 1);
    const response = impulseResponse(bank, 4800); // 0.1s
    const estimated = estimateFrequencyHz(response, SAMPLE_RATE);
    assert.ok(
        Math.abs(estimated - 1000) / 1000 < 0.05,
        `expected ~1000 Hz, estimated ${estimated} Hz`
    );
});

test('a single mode decays at approximately its configured rate', () => {
    const decaySeconds = 0.02;
    const bank = new ResonatorBank(SAMPLE_RATE, 4);
    bank.setMode(0, 1000, decaySeconds, 1);
    const response = impulseResponse(bank, Math.round(decaySeconds * SAMPLE_RATE * 3));

    function rms(samples, start, length) {
        let sum = 0;
        for (let i = start; i < start + length; i++) sum += samples[i] * samples[i];
        return Math.sqrt(sum / length);
    }

    const windowLength = Math.round(decaySeconds * SAMPLE_RATE * 0.2);
    const early = rms(response, windowLength, windowLength);
    const oneTauLater = rms(response, windowLength + Math.round(decaySeconds * SAMPLE_RATE), windowLength);
    const ratio = oneTauLater / early;
    assert.ok(
        Math.abs(ratio - 1 / Math.E) < 0.15,
        `expected RMS to fall by ~1/e over one decay time constant, ratio was ${ratio}`
    );
});

test('frequencies at or above Nyquist are clamped, not left to produce non-finite output', () => {
    const bank = new ResonatorBank(SAMPLE_RATE, 4);
    bank.setMode(0, SAMPLE_RATE, 0.02, 1); // way above Nyquist
    const response = impulseResponse(bank, 1000);
    for (const sample of response) {
        assert.ok(Number.isFinite(sample), `expected finite output, got ${sample}`);
    }
});

test('reset() clears filter memory', () => {
    const bank = new ResonatorBank(SAMPLE_RATE, 4);
    bank.setMode(0, 1000, 0.05, 1);
    bank.tick(1);
    bank.tick(0);
    bank.reset();
    assert.equal(bank.y1[0], 0);
    assert.equal(bank.y2[0], 0);
});

test('only configured modes contribute -- an untouched bank is silent', () => {
    const bank = new ResonatorBank(SAMPLE_RATE, 4);
    assert.equal(bank.tick(1), 0);
    assert.equal(bank.activeModes, 0);
});
