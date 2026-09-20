import test from 'node:test';
import assert from 'node:assert/strict';
import { ResonatorBank } from '../ResonatorBank.js';

const SAMPLE_RATE = 48000;

function impulseResponse(bank, length, modeIndex = 0) {
    const out = new Float64Array(length);
    bank.excite(modeIndex, 1);
    out[0] = bank.tick();
    for (let i = 1; i < length; i++) out[i] = bank.tick();
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
    bank.excite(0, 1);
    bank.tick();
    bank.tick();
    bank.reset();
    assert.equal(bank.y1[0], 0);
    assert.equal(bank.y2[0], 0);
});

test('only configured modes contribute -- an untouched bank is silent', () => {
    const bank = new ResonatorBank(SAMPLE_RATE, 4);
    bank.excite(0, 1);
    assert.equal(bank.tick(), 0);
    assert.equal(bank.activeModes, 0);
});

test('excite() targets one mode only -- an unexcited mode stays completely untouched that sample', () => {
    const bank = new ResonatorBank(SAMPLE_RATE, 4);
    bank.setMode(0, 1000, 0.05, 1);
    bank.setMode(1, 2000, 0.05, 1);
    bank.excite(0, 1); // mode 1 receives nothing
    bank.tick();
    assert.equal(bank.y1[1], 0);
    assert.equal(bank.y2[1], 0);
    assert.notEqual(bank.y1[0], 0);
});

test('a mode excited once keeps ringing/decaying across later ticks with no further excite() calls', () => {
    const decaySeconds = 0.05;
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
    const late = rms(response, response.length - windowLength, windowLength);
    assert.ok(early > 0, 'expected a nonzero response right after excitation');
    assert.ok(
        late < early * 0.5,
        `expected the response to have decayed substantially by the end of the window (early RMS ${early}, late RMS ${late})`
    );
});

test('two modes excited at different times ring down independently of each other', () => {
    const bank = new ResonatorBank(SAMPLE_RATE, 4);
    bank.setMode(0, 1000, 0.05, 1);
    bank.setMode(1, 3000, 0.05, 1);

    bank.excite(0, 1);
    bank.tick();
    for (let i = 0; i < 50; i++) bank.tick(); // let mode 0 ring/decay a while, mode 1 untouched

    const mode1StateBeforeItsOwnExcitation = bank.y1[1];
    assert.equal(mode1StateBeforeItsOwnExcitation, 0, 'mode 1 should be untouched by mode 0\'s excitation');

    bank.excite(1, 1); // now excite mode 1; mode 0 should keep decaying on its own, unaffected
    const mode0Y1Before = bank.y1[0];
    const mode0Y2Before = bank.y2[0];
    bank.tick();
    // Mode 0 continues its own decay (a1/a2 recurrence), not reset or altered
    // by mode 1's new excitation.
    const expectedMode0 = bank.a1[0] * mode0Y1Before + bank.a2[0] * mode0Y2Before;
    assert.ok(
        Math.abs(bank.y1[0] - expectedMode0) < 1e-9,
        'mode 0 should evolve purely from its own prior state, unaffected by mode 1 being excited'
    );
    assert.notEqual(bank.y1[1], 0, 'mode 1 should now be excited');
});
