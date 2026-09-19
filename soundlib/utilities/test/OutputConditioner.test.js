import test from 'node:test';
import assert from 'node:assert/strict';
import { OutputConditioner } from '../OutputConditioner.js';

test('blocks a sustained DC input toward zero', () => {
    const conditioner = new OutputConditioner({ outputGain: 1 });
    let last = conditioner.tick(1);
    for (let i = 0; i < 5000; i++) last = conditioner.tick(1);
    assert.ok(Math.abs(last) < 0.01, `expected DC to be blocked, got ${last}`);
});

test('output is clamped even for a huge input spike', () => {
    const conditioner = new OutputConditioner({ outputGain: 1 });
    const out = conditioner.tick(1e12);
    assert.ok(Number.isFinite(out));
    assert.ok(Math.abs(out) <= 4);
});

test('non-finite input never produces non-finite output', () => {
    const conditioner = new OutputConditioner({ outputGain: 1 });
    const out = conditioner.tick(Infinity);
    assert.ok(Number.isFinite(out));
});

test('reset() clears state', () => {
    const conditioner = new OutputConditioner({ outputGain: 1 });
    conditioner.tick(1);
    conditioner.reset();
    assert.equal(conditioner.previousInput, 0);
    assert.equal(conditioner.previousOutput, 0);
});
