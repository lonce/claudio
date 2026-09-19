// Generic, model-agnostic normalized [0,1] control source derived from
// device pitch-direction reversals (repeatedly tipping the top of the
// device toward/away from the user). Per
// scratch/Shake-Control-Source-Specification.md: emphasizes the moment of
// direction reversal at each end of a stroke -- not raw angle, not
// continuous speed -- matching the moment particles crash into the far
// side of a physical maraca.
//
// Pure and DOM-free: app/main.js feeds it raw device-orientation pitch
// samples via update() and reads the current envelope back via tick(). It
// knows nothing about sensors, permissions, SoundModels, or parameters --
// nothing here should ever reference Maraca, shakeEnergy, or any other
// model-specific name.

export const SHAKE_CONTROL_CONFIG = {
    velocitySmoothingSeconds: 0.02,
    directionThresholdDegPerSec: 12,
    minimumStrokeSpeedDegPerSec: 25,
    strongStrokeSpeedDegPerSec: 220,
    responseExponent: 1.4,
    minimumReversalIntervalSeconds: 0.06,
    releaseSeconds: 0.11,
    outputEpsilon: 0.001,
    // Not in the spec's own example config -- needed for its section 14
    // "reset after a sensor gap" requirement. A gap this long means the
    // device stopped reporting orientation (backgrounded, sensor hiccup),
    // not a genuine pause mid-shake.
    maxValidIntervalSeconds: 0.5
};

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

// Normalizes an angular difference into (-180, 180] so a sample pair that
// happens to straddle the +/-180 boundary doesn't produce a spurious
// near-360-degree velocity spike.
function wrapDegrees(diff) {
    let wrapped = diff % 360;
    if (wrapped <= -180) wrapped += 360;
    if (wrapped > 180) wrapped -= 360;
    return wrapped;
}

export class ShakeControlSource {
    constructor(config = {}) {
        this.config = { ...SHAKE_CONTROL_CONFIG, ...config };
        this.reset();
    }

    reset() {
        this.hasSample = false;
        this.lastPitch = 0;
        this.lastSampleTime = null;
        this.lastTickTime = null;
        this.filteredVelocity = 0;
        this.direction = 0; // -1, 0 (no stroke established yet), or 1
        this.strokePeak = 0;
        this.lastReversalTime = -Infinity;
        this.envelope = 0;
    }

    // pitchDegrees: raw device pitch (e.g. deviceorientation's event.beta),
    // unclamped -- clamping (as the existing `pitch` mapping does) would
    // flatten velocity right at the extremes of a vigorous shake, exactly
    // where reversals happen. nowSeconds: a monotonic clock, consistent
    // with tick()'s.
    update(pitchDegrees, nowSeconds) {
        if (!Number.isFinite(pitchDegrees) || !Number.isFinite(nowSeconds)) return;

        if (!this.hasSample) {
            this.hasSample = true;
            this.lastPitch = pitchDegrees;
            this.lastSampleTime = nowSeconds;
            return;
        }

        const dt = nowSeconds - this.lastSampleTime;
        this.lastSampleTime = nowSeconds;

        if (!(dt > 0) || dt > this.config.maxValidIntervalSeconds) {
            // Zero/negative/unreasonable interval, or a stale gap just
            // ended -- can't compute a meaningful velocity from this pair,
            // and any in-progress stroke is no longer credible. Drop the
            // derivative/stroke history but keep this sample as the fresh
            // reference point, rather than integrating garbage.
            this.lastPitch = pitchDegrees;
            this.filteredVelocity = 0;
            this.direction = 0;
            this.strokePeak = 0;
            return;
        }

        const rawVelocity = wrapDegrees(pitchDegrees - this.lastPitch) / dt;
        this.lastPitch = pitchDegrees;

        const alpha = clamp01(dt / (dt + this.config.velocitySmoothingSeconds));
        this.filteredVelocity += alpha * (rawVelocity - this.filteredVelocity);

        this._trackStrokeAndReversals(nowSeconds);
    }

    _trackStrokeAndReversals(nowSeconds) {
        const v = this.filteredVelocity;
        const { directionThresholdDegPerSec } = this.config;

        if (this.direction === 0) {
            // The first credible movement establishes direction and starts
            // peak tracking, without counting as a completed stroke -- no
            // reversal has happened yet.
            if (v > directionThresholdDegPerSec) this.direction = 1;
            else if (v < -directionThresholdDegPerSec) this.direction = -1;
            this.strokePeak = Math.abs(v);
            return;
        }

        this.strokePeak = Math.max(this.strokePeak, Math.abs(v));

        const reversing = (this.direction > 0 && v < -directionThresholdDegPerSec)
            || (this.direction < 0 && v > directionThresholdDegPerSec);
        if (!reversing) return;

        this._acceptReversal(nowSeconds, v);
    }

    _acceptReversal(nowSeconds, velocityAfterReversal) {
        const { minimumStrokeSpeedDegPerSec, minimumReversalIntervalSeconds } = this.config;

        const qualifies = this.strokePeak >= minimumStrokeSpeedDegPerSec
            && (nowSeconds - this.lastReversalTime) >= minimumReversalIntervalSeconds;

        if (qualifies) {
            const pulse = this._strokeToPulse(this.strokePeak);
            this.envelope = Math.max(this.envelope, pulse);
            this.lastReversalTime = nowSeconds;
        }

        // A new half-stroke starts regardless of whether this reversal
        // qualified for a pulse -- an unqualified reversal (too weak, too
        // soon) still means direction has genuinely flipped.
        this.direction = velocityAfterReversal > 0 ? 1 : -1;
        this.strokePeak = Math.abs(velocityAfterReversal);
    }

    _strokeToPulse(strokePeak) {
        const { minimumStrokeSpeedDegPerSec, strongStrokeSpeedDegPerSec, responseExponent } = this.config;
        const span = strongStrokeSpeedDegPerSec - minimumStrokeSpeedDegPerSec;
        const x = clamp01(span > 0 ? (strokePeak - minimumStrokeSpeedDegPerSec) / span : 1);
        return Math.pow(x, responseExponent);
    }

    // Call every animation frame, regardless of whether a new sample
    // arrived, so the envelope decays smoothly and a stale sensor gap gets
    // detected even with no further input. nowSeconds: same monotonic
    // clock as update(). Returns the current [0, 1] envelope value.
    tick(nowSeconds) {
        if (!Number.isFinite(nowSeconds)) return this.envelope;

        if (this.hasSample && (nowSeconds - this.lastSampleTime) > this.config.maxValidIntervalSeconds) {
            this.hasSample = false;
            this.filteredVelocity = 0;
            this.direction = 0;
            this.strokePeak = 0;
            this.envelope = 0;
        }

        if (this.lastTickTime !== null) {
            const dt = Math.max(0, nowSeconds - this.lastTickTime);
            this.envelope *= Math.exp(-dt / this.config.releaseSeconds);
            if (this.envelope < this.config.outputEpsilon) this.envelope = 0;
        }
        this.lastTickTime = nowSeconds;

        return this.envelope;
    }
}

export default ShakeControlSource;
