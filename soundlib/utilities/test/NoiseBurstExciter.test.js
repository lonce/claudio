import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRandom } from '../SeededRandom.js';
import { NoiseBurstExciter } from '../NoiseBurstExciter.js';

const SAMPLE_RATE = 48000;

test('no collisions -> soundLevel stays at zero', () => {
    const exciter = new NoiseBurstExciter(SAMPLE_RATE, { random: new SeededRandom(1) });
    exciter.setDecaySeconds(0.004);
    for (let i = 0; i < 1000; i++) {
        // === (not assert.equal, which uses Object.is and treats -0 !== 0)
        // -- soundLevel * a negative bipolar draw can legitimately be -0.
        assert.ok(exciter.tick(0) === 0);
    }
});

test('a single collision decays exponentially at the configured rate', () => {
    const decaySeconds = 0.01;
    const random = { bipolar: () => 1 }; // isolate the decay law from noise sign/magnitude
    const exciter = new NoiseBurstExciter(SAMPLE_RATE, { random });
    exciter.setDecaySeconds(decaySeconds);

    // The exciter applies decay on the very same sample as the collision
    // it just accumulated, so the first returned value is decayPerSample,
    // not exactly 1 -- use that as the baseline for the one-tau check below
    // rather than assuming an untouched 1.
    const decayPerSample = Math.exp(-1 / (decaySeconds * SAMPLE_RATE));
    const afterCollision = exciter.tick(1);
    assert.ok(Math.abs(afterCollision - decayPerSample) < 1e-9);

    for (let i = 0; i < Math.round(decaySeconds * SAMPLE_RATE); i++) exciter.tick(0);
    const afterOneTau = exciter.tick(0);
    const ratio = afterOneTau / afterCollision;
    assert.ok(
        Math.abs(ratio - 1 / Math.E) < 0.01,
        `expected ~1/e after one further time constant, ratio was ${ratio}`
    );
});

test('output is always finite even with non-finite collision input', () => {
    const exciter = new NoiseBurstExciter(SAMPLE_RATE, { random: new SeededRandom(1) });
    exciter.setDecaySeconds(0.004);
    exciter.tick(Infinity);
    assert.ok(Number.isFinite(exciter.soundLevel));
    assert.ok(Number.isFinite(exciter.tick(0)));
});

test('reset() clears soundLevel', () => {
    const exciter = new NoiseBurstExciter(SAMPLE_RATE, { random: new SeededRandom(1) });
    exciter.setDecaySeconds(0.004);
    exciter.tick(1);
    exciter.reset();
    assert.equal(exciter.soundLevel, 0);
});
