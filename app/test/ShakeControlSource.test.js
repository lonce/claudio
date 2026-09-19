import test from 'node:test';
import assert from 'node:assert/strict';
import { ShakeControlSource, SHAKE_CONTROL_CONFIG } from '../ShakeControlSource.js';

const DT = 0.005; // 200Hz synthetic sample rate -- fine enough for the
                   // velocity smoother (20ms time constant) to converge
                   // well within a single stroke segment.

// Feeds a constant-velocity pitch ramp (deg/sec) for durationSeconds,
// starting at startPitch/startTime. Returns { pitch, time } at the end,
// so segments can be chained to build a whole stroke sequence.
function feedRamp(detector, velocityDegPerSec, durationSeconds, startPitch, startTime) {
    let pitch = startPitch;
    let time = startTime;
    const steps = Math.round(durationSeconds / DT);
    for (let i = 0; i < steps; i++) {
        time += DT;
        pitch += velocityDegPerSec * DT;
        detector.update(pitch, time);
    }
    return { pitch, time };
}

function makeDetector(overrides = {}) {
    return new ShakeControlSource(overrides);
}

test('stationary noisy input produces no pulses', () => {
    const detector = makeDetector();
    let time = 0;
    let pitch = 0;
    for (let i = 0; i < 2000; i++) {
        time += DT;
        // Deterministic, tiny, sub-threshold wobble -- not real noise, but
        // exercises the same "never quite still" path a real sensor would.
        pitch = 0.05 * Math.sin(i * 0.7);
        detector.update(pitch, time);
        assert.equal(detector.tick(time), 0);
    }
});

test('a single movement establishes direction without a false reversal', () => {
    const detector = makeDetector();
    feedRamp(detector, 150, 0.3, 0, 0);
    assert.equal(detector.tick(0.3), 0, 'no completed stroke yet -- no pulse');
    assert.equal(detector.direction, 1);
});

test('a qualified reversal after one half-stroke produces one pulse', () => {
    const detector = makeDetector();
    let { pitch, time } = feedRamp(detector, 150, 0.3, 0, 0);
    feedRamp(detector, -150, 0.3, pitch, time);
    assert.ok(detector.tick(time + 0.3) > 0, 'expected a pulse after the qualified reversal');
});

test('alternating strong half-strokes produce one pulse per reversal', () => {
    const detector = makeDetector();
    let pitch = 0;
    let time = 0;
    let pulseCount = 0;
    let wasZero = true;

    for (let stroke = 0; stroke < 6; stroke++) {
        const velocity = stroke % 2 === 0 ? 150 : -150;
        ({ pitch, time } = feedRamp(detector, velocity, 0.3, pitch, time));
        const value = detector.tick(time);
        if (value > 0 && wasZero) pulseCount++;
        wasZero = false;
        // Let it fully decay before the next stroke so pulses are counted
        // distinctly rather than merging into one continuously-nonzero run.
        // At the default releaseSeconds/outputEpsilon, decay from a full
        // pulse takes ~0.76s -- give it generous headroom.
        for (let i = 0; i < 400; i++) {
            time += DT;
            const decayed = detector.tick(time);
            if (decayed === 0) { wasZero = true; break; }
        }
    }
    // First stroke only establishes direction (no prior stroke to complete),
    // so 6 strokes -> 5 completed reversals -> 5 pulses.
    assert.equal(pulseCount, 5);
});

test('small sign fluctuations near zero produce no pulses', () => {
    const detector = makeDetector();
    let pitch = 0;
    let time = 0;
    // Oscillate with peak velocity well under minimumStrokeSpeedDegPerSec,
    // crossing zero (and the direction-hysteresis band) repeatedly.
    const velocity = SHAKE_CONTROL_CONFIG.minimumStrokeSpeedDegPerSec * 0.4;
    for (let stroke = 0; stroke < 8; stroke++) {
        ({ pitch, time } = feedRamp(detector, stroke % 2 === 0 ? velocity : -velocity, 0.05, pitch, time));
        assert.equal(detector.tick(time), 0);
    }
});

test('reversals inside the minimum interval are rejected', () => {
    const detector = makeDetector();
    let { pitch, time } = feedRamp(detector, 150, 0.3, 0, 0);
    ({ pitch, time } = feedRamp(detector, -150, 0.3, pitch, time));
    const firstPulse = detector.tick(time);
    assert.ok(firstPulse > 0);

    // Immediately reverse again, well inside minimumReversalIntervalSeconds.
    ({ pitch, time } = feedRamp(detector, 150, DT * 2, pitch, time));
    const beforeSecondReversal = detector.lastReversalTime;
    ({ pitch, time } = feedRamp(detector, -150, DT * 2, pitch, time));
    assert.equal(
        detector.lastReversalTime, beforeSecondReversal,
        'a reversal inside the minimum interval must not register as a new one'
    );
});

test('stronger completed strokes produce larger pulse amplitudes', () => {
    function pulseFor(velocity) {
        const detector = makeDetector();
        let { pitch, time } = feedRamp(detector, velocity, 0.3, 0, 0);
        ({ pitch, time } = feedRamp(detector, -velocity, 0.3, pitch, time));
        return detector.tick(time);
    }
    const weak = pulseFor(40);
    const strong = pulseFor(200);
    assert.ok(strong > weak, `expected a stronger stroke to produce a larger pulse, got ${weak} vs ${strong}`);
});

test('pulse amplitudes remain in [0, 1] even far beyond the "strong" reference speed', () => {
    const detector = makeDetector();
    let { pitch, time } = feedRamp(detector, 2000, 0.3, 0, 0);
    ({ pitch, time } = feedRamp(detector, -2000, 0.3, pitch, time));
    const value = detector.tick(time);
    assert.ok(value >= 0 && value <= 1, `expected value in [0,1], got ${value}`);
});

test('envelope decay is independent of update rate', () => {
    function decayTo(tickIntervalSeconds, totalSeconds) {
        const detector = makeDetector();
        let { pitch, time } = feedRamp(detector, 150, 0.3, 0, 0);
        ({ pitch, time } = feedRamp(detector, -150, 0.3, pitch, time));
        detector.tick(time); // establishes the pulse and lastTickTime
        const steps = Math.round(totalSeconds / tickIntervalSeconds);
        let value;
        for (let i = 0; i < steps; i++) {
            time += tickIntervalSeconds;
            value = detector.tick(time);
        }
        return value;
    }
    const coarse = decayTo(0.05, 0.2);
    const fine = decayTo(0.001, 0.2);
    assert.ok(
        Math.abs(coarse - fine) < 0.01,
        `expected rate-independent decay, got ${coarse} vs ${fine}`
    );
});

test('the envelope reaches exactly zero after enough decay time', () => {
    const detector = makeDetector();
    let { pitch, time } = feedRamp(detector, 150, 0.3, 0, 0);
    ({ pitch, time } = feedRamp(detector, -150, 0.3, pitch, time));
    detector.tick(time);
    for (let i = 0; i < 200; i++) {
        time += 0.01;
        detector.tick(time);
    }
    assert.equal(detector.tick(time + 1), 0);
});

test('a long sensor gap resets derivative/reversal state safely', () => {
    const detector = makeDetector();
    let { pitch, time } = feedRamp(detector, 150, 0.3, 0, 0);
    assert.equal(detector.direction, 1);

    // Simulate a long gap with no update() calls, discovered by tick().
    const afterGap = time + SHAKE_CONTROL_CONFIG.maxValidIntervalSeconds + 1;
    detector.tick(afterGap);
    assert.equal(detector.hasSample, false);
    assert.equal(detector.direction, 0);
    assert.equal(detector.envelope, 0);

    // A fresh stroke afterward should behave exactly like a cold start,
    // not like a continuation of the pre-gap stroke.
    feedRamp(detector, 150, 0.3, pitch, afterGap);
    assert.equal(detector.direction, 1);
});

test('sign-inverted input produces equivalent pulse magnitude and timing', () => {
    function run(sign) {
        const detector = makeDetector();
        let { pitch, time } = feedRamp(detector, sign * 150, 0.3, 0, 0);
        ({ pitch, time } = feedRamp(detector, sign * -150, 0.3, pitch, time));
        return { value: detector.tick(time), reversalTime: detector.lastReversalTime };
    }
    const positive = run(1);
    const negative = run(-1);
    assert.ok(
        Math.abs(positive.value - negative.value) < 1e-9,
        `expected sign-inverted input to produce the same pulse magnitude, got ${positive.value} vs ${negative.value}`
    );
    assert.equal(positive.reversalTime, negative.reversalTime);
});
