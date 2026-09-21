// Plain, framework-agnostic per-channel envelope follower (rectify +
// one-pole tracking smoothing) for the "one model's sound interpreted as
// filter/envelope control for another model's audio" pattern -- see
// docs/MODEL_PATTERNS.md's cross-synthesis/vocoder archetype. Generic
// (not private to any one model), so it lives flat here alongside
// ResonatorBank.js/EnergyAccumulator.js rather than under a model's own
// subfolder.
//
// Uses the standard two-term one-pole tracking filter
// (a*y[n-1] + (1-a)*x[n]), not this codebase's usual decay-only shape
// (EnergyAccumulator/NoiseBurstExciter) -- those only ever decay from an
// impulse, but an envelope follower must track a possibly-RISING rectified
// signal too, so it needs the (1-a) input term to actually converge toward
// it. Same exp(-1/(tau*sampleRate)) sample-rate-independent coefficient
// derivation as the rest of the PhISEM family, just applied to a tracking
// filter instead of a pure decay. One symmetric time constant (no separate
// attack/release) -- simplest thing that satisfies "rectify + smoothing".

export class EnvelopeFollowerBank {
    constructor(sampleRate, numberOfChannels) {
        this.sampleRate = sampleRate;
        this.numberOfChannels = numberOfChannels;
        this.coefficient = 1;
        this.envelope = new Float64Array(numberOfChannels);
    }

    setTimeConstant(seconds) {
        const clamped = Math.max(1e-4, seconds);
        this.coefficient = Math.exp(-1 / (clamped * this.sampleRate));
    }

    reset() {
        this.envelope.fill(0);
    }

    // input: this channel's current instantaneous (unrectified) sample.
    tick(index, input) {
        const rectified = Math.abs(input);
        const next = this.coefficient * this.envelope[index] + (1 - this.coefficient) * rectified;
        this.envelope[index] = Number.isFinite(next) ? next : 0;
        return this.envelope[index];
    }
}

export default EnvelopeFollowerBank;
