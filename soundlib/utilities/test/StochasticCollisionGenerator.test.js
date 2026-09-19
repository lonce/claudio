import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRandom } from '../SeededRandom.js';
import { StochasticCollisionGenerator } from '../StochasticCollisionGenerator.js';

const SAMPLE_RATE = 48000;

test('zero energy or zero objects never collides', () => {
    const generator = new StochasticCollisionGenerator(SAMPLE_RATE, {
        random: new SeededRandom(1)
    });
    for (let i = 0; i < 10000; i++) {
        assert.equal(generator.tick(0, 64), 0);
    }
    const generator2 = new StochasticCollisionGenerator(SAMPLE_RATE, {
        random: new SeededRandom(1)
    });
    for (let i = 0; i < 10000; i++) {
        assert.equal(generator2.tick(1, 0), 0);
    }
});

test('collision count converges toward the configured expected rate', () => {
    const rateScale = 8;
    const energy = 1.5;
    const numberOfObjects = 64;
    const expectedRate = rateScale * energy * numberOfObjects; // collisions/sec
    const seconds = 2;

    const generator = new StochasticCollisionGenerator(SAMPLE_RATE, {
        rateScale,
        random: new SeededRandom(12345)
    });

    let collisions = 0;
    for (let i = 0; i < SAMPLE_RATE * seconds; i++) {
        if (generator.tick(energy, numberOfObjects) !== 0) collisions++;
    }

    const observedRate = collisions / seconds;
    const relativeError = Math.abs(observedRate - expectedRate) / expectedRate;
    assert.ok(
        relativeError < 0.1,
        `expected ~${expectedRate} collisions/sec, observed ${observedRate} (${collisions} over ${seconds}s)`
    );
});

test('probability is clamped so extreme parameters stay finite and well-behaved', () => {
    const generator = new StochasticCollisionGenerator(SAMPLE_RATE, {
        rateScale: 1e9,
        random: new SeededRandom(1)
    });
    for (let i = 0; i < 1000; i++) {
        const amplitude = generator.tick(4, 256);
        assert.ok(Number.isFinite(amplitude), `expected finite amplitude, got ${amplitude}`);
    }
});

test('same seed, same parameters -> identical collision sequence', () => {
    const make = () => new StochasticCollisionGenerator(SAMPLE_RATE, {
        rateScale: 8,
        random: new SeededRandom(777)
    });
    const a = make();
    const b = make();
    for (let i = 0; i < 5000; i++) {
        assert.equal(a.tick(1.5, 64), b.tick(1.5, 64));
    }
});

test('individual collision amplitude shrinks as numberOfObjects grows (density up, loudness down)', () => {
    const random = new SeededRandom(1);
    // Force a collision every call by using an energy/rateScale combination
    // whose probability saturates to 1.
    const generator = new StochasticCollisionGenerator(SAMPLE_RATE, {
        rateScale: 1e9,
        random
    });
    const amplitudeFewObjects = generator.tick(1, 1);
    const amplitudeManyObjects = generator.tick(1, 100);
    assert.ok(
        amplitudeManyObjects < amplitudeFewObjects,
        `expected 1/sqrt(N) normalization to reduce per-event amplitude, got ${amplitudeFewObjects} -> ${amplitudeManyObjects}`
    );
});

test('setRateScale() changes the observed collision rate', () => {
    const energy = 1.5;
    const numberOfObjects = 64;
    const seconds = 2;

    function observedRate(rateScale) {
        const generator = new StochasticCollisionGenerator(SAMPLE_RATE, {
            rateScale: 1, // deliberately wrong -- setRateScale() must override it
            random: new SeededRandom(42)
        });
        generator.setRateScale(rateScale);
        let collisions = 0;
        for (let i = 0; i < SAMPLE_RATE * seconds; i++) {
            if (generator.tick(energy, numberOfObjects) !== 0) collisions++;
        }
        return collisions / seconds;
    }

    const low = observedRate(4);
    const high = observedRate(32);
    assert.ok(
        high > low * 5,
        `expected setRateScale to scale observed collision rate, got ${low} -> ${high}`
    );
});
