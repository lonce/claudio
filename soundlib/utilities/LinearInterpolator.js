// Plain, framework-agnostic fractional-delay interpolation strategy --
// linear interpolation between the two adjacent integer samples. This is
// FractionalDelayWaveguide's original, only interpolation method,
// extracted verbatim (same math, not rewritten) so it can be swapped for
// an alternative (see AllpassInterpolator.js) without changing
// FractionalDelayWaveguide itself. See docs/MODEL_PATTERNS.md's digital-
// waveguide archetype for the investigation that motivated this.
//
// Stateless -- a single instance is safe to share across every tap site
// in the whole library (unlike AllpassInterpolator, which needs its own
// instance per tap).
//
// Known tradeoff, measured not assumed (see soundlib/models/WG1/knowledge/
// causal-claims.yaml and WG2's own): linear interpolation's magnitude
// response rolls off toward Nyquist, which measurably shortens decay at
// high fundamental frequencies in a feedback loop -- kept here as a
// reference/regression mode, not removed, since it remains useful as a
// baseline and a deliberately characterizable lo-fi propagation option.

export class LinearInterpolator {
    read(buffer, bufferLength, writeIndex, offsetSamples) {
        const position = (writeIndex - offsetSamples + bufferLength * 2) % bufferLength;
        const indexA = Math.floor(position);
        const frac = position - indexA;
        const indexB = (indexA + 1) % bufferLength;
        return buffer[indexA] * (1 - frac) + buffer[indexB] * frac;
    }

    // Stateless -- no-op, present only to satisfy the same interface
    // AllpassInterpolator needs.
    reset() {}
}

// Safe to share across every tap site (WG1's self-feedback read, WG2's
// two boundary-crossing reads, pickup, etc.) since there is no state.
export const SHARED_LINEAR_INTERPOLATOR = new LinearInterpolator();

export default LinearInterpolator;
