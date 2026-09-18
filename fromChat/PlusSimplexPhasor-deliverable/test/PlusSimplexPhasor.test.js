import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
    PlusSimplexPhasor,
    DEFAULT_NOISE_COORDINATE_SCALE
} from '../PlusSimplexPhasor.js';

function phaseDistance(a, b) {
    const difference = Math.abs(a - b) % 1;
    return Math.min(difference, 1 - difference);
}

test('weight zero is an ordinary phasor', () => {
    const phasor = new PlusSimplexPhasor(
        2,
        [{ id: 'quarter', phase: 0.25 }],
        0,
        { weight: 0, seed: 4 }
    );
    const events = phasor.processBlock(48000, 48000);
    assert.ok(phaseDistance(phasor.getBasePhase(), 0) < 1e-10);
    assert.ok(phaseDistance(phasor.getOutputPhase(), 0) < 1e-10);
    assert.equal(events.length, 2);
});

test('seeded trajectories replay deterministically', () => {
    const options = { weight: 1.2, seed: 9821 };
    const a = new PlusSimplexPhasor(3, [], 0.2, options);
    const b = new PlusSimplexPhasor(3, [], 0.2, options);
    for (let block = 0; block < 100; block++) {
        a.processBlock(128, 48000);
        b.processBlock(128, 48000);
    }
    assert.equal(a.outputUnwrappedPhase, b.outputUnwrappedPhase);
    assert.equal(a.noiseCoordinate, b.noiseCoordinate);
});

test('output rate stays positive and octave-bounded for clamped noise', () => {
    const phasor = new PlusSimplexPhasor(5, [], 0, {
        weight: 2,
        seed: 7
    });
    for (let block = 0; block < 500; block++) {
        phasor.processBlock(128, 48000);
        const outputRate = phasor.getOutputRate();
        assert.ok(outputRate >= 5 / 4 - 1e-12);
        assert.ok(outputRate <= 5 * 4 + 1e-12);
    }
});

test('nonzero-weight rendezvous reaches exact output phase and endpoints', () => {
    const sampleRate = 48000;
    const durationFrames = 5 * sampleRate;
    const phasor = new PlusSimplexPhasor(
        1.7,
        [{ id: 'a', phase: 0 }, { id: 'b', phase: 0.37 }],
        0.13,
        { weight: 0.4, seed: 431, planningSteps: 1024 }
    );

    phasor.beginTransition({
        durationFrames,
        targetRate: 2.3,
        targetWeight: 1.25,
        targetPhase: 0.71,
        sharpness: 3
    });

    const start = performance.now();
    const events = [];
    for (let frame = 0; frame < durationFrames; frame += 128) {
        events.push(...phasor.processBlock(
            Math.min(128, durationFrames - frame),
            sampleRate
        ));
    }
    const planningAndRenderMilliseconds = performance.now() - start;

    assert.ok(phaseDistance(phasor.getOutputPhase(), 0.71) < 1e-9);
    assert.equal(phasor.getRate(), 2.3);
    assert.equal(phasor.getWeight(), 1.25);
    assert.ok(events.every((event, index) =>
        index === 0 || event.sampleOffset >= 0
    ));
    assert.ok(planningAndRenderMilliseconds < 2000);
});

test('multiple phase events remain ordered', () => {
    const phasor = new PlusSimplexPhasor(
        12,
        [
            { id: 'zero', phase: 0 },
            { id: 'quarter', phase: 0.25 },
            { id: 'half', phase: 0.5 },
            { id: 'three-quarter', phase: 0.75 }
        ],
        0,
        { weight: 2.5, seed: 88 }
    );
    const events = phasor.processBlock(48000, 48000);
    const order = ['quarter', 'half', 'three-quarter', 'zero'];
    for (let index = 0; index < events.length; index++) {
        assert.equal(events[index].id, order[index % order.length]);
        if (index > 0) {
            assert.ok(events[index].sampleOffset >= events[index - 1].sampleOffset);
        }
    }
});

test('default calibration is approximately one rising crossing per base cycle', () => {
    const phasor = new PlusSimplexPhasor(1, [], 0, { seed: 17 });
    let previous = phasor.getNoiseValue();
    let crossings = 0;
    const cycles = 2000;
    const samplesPerCycle = 200;
    for (let index = 1; index <= cycles * samplesPerCycle; index++) {
        phasor.noiseCoordinate = index / samplesPerCycle
            * DEFAULT_NOISE_COORDINATE_SCALE;
        const current = phasor.getNoiseValue();
        if (previous < 0 && current >= 0) crossings++;
        previous = current;
    }
    assert.ok(crossings / cycles > 0.9);
    assert.ok(crossings / cycles < 1.1);
});
