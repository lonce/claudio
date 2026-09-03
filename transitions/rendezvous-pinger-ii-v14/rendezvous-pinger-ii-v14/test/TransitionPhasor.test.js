import assert from 'node:assert/strict';
import { TransitionPhasor } from '../utilities/TransitionPhasor.js';

const sampleRate = 48000;

function nearlyEqual(actual, expected, tolerance, message) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `${message}: expected ${expected}, received ${actual}`
    );
}

// Exact endpoint with a non-integral total number of rotations.
{
    const phasor = new TransitionPhasor(
        2.3,
        [{ id: 'quarter', phase: 0.25, event: 'click' }],
        0.17
    );
    const durationFrames = sampleRate * 3;
    phasor.beginTransition({
        durationFrames,
        targetRate: 4.7,
        targetPhase: 0.63
    });

    let events = [];
    for (let remaining = durationFrames; remaining > 0;) {
        const block = Math.min(128, remaining);
        events = events.concat(phasor.processBlock(block, sampleRate));
        remaining -= block;
    }

    nearlyEqual(phasor.getPhase(), 0.63, 1e-10, 'target phase');
    nearlyEqual(phasor.getRate(), 4.7, 1e-12, 'target frequency');
    assert.ok(events.length > 0, 'expected phase events during transition');
    assert.ok(
        events.every((event) => event.sampleOffset >= 0 && event.sampleOffset <= 128),
        'event offsets must lie inside their render quantum'
    );
}

// Multiple rotations in one block must produce every crossing.
{
    const phasor = new TransitionPhasor(
        sampleRate / 32,
        [{ id: 'zero', phase: 0, event: 'click' }],
        0
    );
    const events = phasor.processBlock(128, sampleRate);
    assert.equal(events.length, 4);
}

// Sharpness bends the rate path toward a midpoint step while preserving the
// exact endpoint rate and phase landmark.
{
    const durationFrames = sampleRate * 4;
    const linear = new TransitionPhasor(1, [], 0.2);
    const shaped = new TransitionPhasor(1, [], 0.2);
    linear.beginTransition({
        durationFrames,
        targetRate: 5,
        targetPhase: 0.7,
        sharpness: 0
    });
    shaped.beginTransition({
        durationFrames,
        targetRate: 5,
        targetPhase: 0.7,
        sharpness: 6
    });

    linear.processBlock(durationFrames / 4, sampleRate);
    shaped.processBlock(durationFrames / 4, sampleRate);
    assert.ok(
        shaped.getRate() < linear.getRate(),
        'a sharp rising transition should remain nearer its start rate early on'
    );

    linear.processBlock(durationFrames * 3 / 4, sampleRate);
    shaped.processBlock(durationFrames * 3 / 4, sampleRate);
    nearlyEqual(shaped.getPhase(), 0.7, 1e-10, 'shaped target phase');
    nearlyEqual(shaped.getRate(), 5, 1e-12, 'shaped target frequency');
}

// A natural rate transition follows the uncorrected linear ramp and therefore
// lands at the phase implied by the average of its endpoint rates.
{
    const startPhase = 0.2;
    const startRate = 1.25;
    const targetRate = 3.75;
    const durationSeconds = 4;
    const durationFrames = sampleRate * durationSeconds;
    const phasor = new TransitionPhasor(startRate, [], startPhase);
    phasor.beginRateTransition({
        durationFrames,
        targetRate,
        sampleRate,
        sharpness: 6
    });

    for (let remaining = durationFrames; remaining > 0;) {
        const block = Math.min(128, remaining);
        phasor.processBlock(block, sampleRate);
        remaining -= block;
    }

    const expectedPhase = (
        startPhase + durationSeconds * (startRate + targetRate) / 2
    ) % 1;
    nearlyEqual(phasor.getPhase(), expectedPhase, 1e-10, 'natural target phase');
    nearlyEqual(phasor.getRate(), targetRate, 1e-12, 'natural target frequency');
}

// Immediate setters replace an in-progress transition without coupling rate
// and phase to one another.
{
    const phasor = new TransitionPhasor(2, [], 0.1);
    phasor.beginTransition({
        durationFrames: sampleRate * 5,
        targetRate: 6,
        targetPhase: 0.9
    });
    phasor.processBlock(128, sampleRate);

    phasor.setRate(3);
    nearlyEqual(phasor.getRate(), 3, 1e-12, 'immediate frequency');
    const phaseBefore = phasor.getPhase();
    phasor.processBlock(128, sampleRate);
    nearlyEqual(
        phasor.getPhase(),
        (phaseBefore + 3 * 128 / sampleRate) % 1,
        1e-10,
        'frequency setter cancels transition'
    );

    phasor.beginTransition({
        durationFrames: sampleRate * 5,
        targetRate: 7,
        targetPhase: 0.8
    });
    phasor.setPhase(0.25);
    nearlyEqual(phasor.getPhase(), 0.25, 1e-12, 'immediate phase');
    nearlyEqual(phasor.getRate(), 3, 1e-12, 'phase setter preserves frequency');
}

console.log('TransitionPhasor tests passed.');
