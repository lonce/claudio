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
