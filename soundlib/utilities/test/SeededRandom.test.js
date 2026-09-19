import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRandom } from '../SeededRandom.js';

test('same seed reproduces the same sequence', () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    for (let i = 0; i < 100; i++) {
        assert.equal(a.unipolar(), b.unipolar());
    }
});

test('different seeds diverge', () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    const sequenceA = Array.from({ length: 10 }, () => a.unipolar());
    const sequenceB = Array.from({ length: 10 }, () => b.unipolar());
    assert.notDeepEqual(sequenceA, sequenceB);
});

test('unipolar stays in [0, 1), bipolar stays in [-1, 1)', () => {
    const random = new SeededRandom(7);
    for (let i = 0; i < 5000; i++) {
        const u = random.unipolar();
        assert.ok(u >= 0 && u < 1, `unipolar out of range: ${u}`);
        const b = random.bipolar();
        assert.ok(b >= -1 && b < 1, `bipolar out of range: ${b}`);
    }
});

test('reset() replays the same sequence from the start', () => {
    const random = new SeededRandom(99);
    const first = Array.from({ length: 20 }, () => random.unipolar());
    random.reset();
    const second = Array.from({ length: 20 }, () => random.unipolar());
    assert.deepEqual(first, second);
});
