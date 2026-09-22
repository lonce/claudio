import test from 'node:test';
import assert from 'node:assert/strict';
import { SimplexNoise } from '../SimplexNoise.js';

test('noise1DMultiOctave with a single unit weight reduces to noise2D itself', () => {
    const simplex = new SimplexNoise(1);
    const fixedY = SimplexNoise.deriveFixedY(1);
    for (const t of [0, 0.37, 1.5, 12.3]) {
        assert.equal(simplex.noise1DMultiOctave(t, [1], fixedY), simplex.noise2D(t, fixedY));
    }
});

test('noise1DMultiOctave matches a hand-computed weighted average for a known multi-weight case', () => {
    const simplex = new SimplexNoise(42);
    const fixedY = SimplexNoise.deriveFixedY(42);
    const t = 2.5;
    const weights = [0.6, 0.25, 0.15];
    const expected = Math.max(-1, Math.min(1,
        (weights[0] * simplex.noise2D(t, fixedY)
            + weights[1] * simplex.noise2D(t * 2, fixedY)
            + weights[2] * simplex.noise2D(t * 4, fixedY))
        / (weights[0] + weights[1] + weights[2])
    ));
    assert.equal(simplex.noise1DMultiOctave(t, weights, fixedY), expected);
});

test('output is always clamped to [-1,1] across a range of seeds, weights, and t', () => {
    for (const seed of [1, 7, 42, 999]) {
        const simplex = new SimplexNoise(seed);
        const fixedY = SimplexNoise.deriveFixedY(seed);
        for (const weights of [[1], [0.6, 0.25, 0.15], [1, 1, 1, 1], [0.05, 0.95]]) {
            for (let t = 0; t < 20; t += 0.9) {
                const value = simplex.noise1DMultiOctave(t, weights, fixedY);
                assert.ok(value >= -1 && value <= 1, `expected value in [-1,1], got ${value}`);
            }
        }
    }
});

test('weights that already sum to something other than 1 are normalized', () => {
    const simplex = new SimplexNoise(5);
    const fixedY = SimplexNoise.deriveFixedY(5);
    const t = 3.14;
    // [2, 2] should give the same result as [1, 1] since both normalize to equal 0.5/0.5 shares.
    assert.equal(
        simplex.noise1DMultiOctave(t, [2, 2], fixedY),
        simplex.noise1DMultiOctave(t, [1, 1], fixedY)
    );
});
