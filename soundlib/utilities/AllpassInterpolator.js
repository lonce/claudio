// Plain, framework-agnostic fractional-delay interpolation strategy --
// first-order allpass ("Thiran-1"-style) fractional delay, the spec's own
// recommended refinement over linear interpolation (see
// scratch/WaveguideResonator-v1-Specification-and-Reasoning-Model.md,
// section 5.2: "first-order allpass or higher-quality interpolation as a
// selectable refinement").
//
// NOT to be confused with DispersionFilter's allpass sections (a future
// component, Phase C) -- that one *deliberately* introduces frequency-
// dependent delay for a musical inharmonicity effect. This one exists to
// approximate a true fractional delay as closely as possible (flat
// magnitude, phase delay as close to the target as achievable with one
// section) -- its own frequency-dependent phase-delay error is a
// side-effect to be measured and minimized, not a goal.
//
// Stateful (one-pole allpass memory) -- unlike LinearInterpolator, this
// needs its own instance PER TAP SITE, not shared: WG1 has one tap (its
// self-feedback read); WG2's BidirectionalWaveguide has two propagation-
// critical taps (one per rail's boundary-crossing read), each needing
// independent state. Sharing one instance across multiple taps would
// corrupt each tap's own delay-line memory with another tap's samples.
//
// Standard fractional-delay allpass: for integer part D_int =
// floor(offsetSamples) and fractional part frac = offsetSamples - D_int,
// read the buffer at the exact integer delay D_int (no interpolation
// needed for that part), then filter that integer-delayed sample stream
// through a first-order allpass whose own delay is `frac`:
//   a = (1 - frac) / (1 + frac)
//   y[n] = a*x[n] + x[n-1] - a*y[n-1]
// Stable for frac in (0, 1) (pole at z=-a, |a|<1); frac is clamped away
// from exactly 0 (a=1, the unstable boundary) and 1, per this codebase's
// established "constrain coefficient range away from instability"
// convention (matching DispersionFilter's own planned safeguard).
//
// Magnitude response is unity at all frequencies (the defining allpass
// property) -- but its PHASE/group delay only approximates the target
// `frac` closely at low-to-mid frequencies; the approximation error grows
// toward Nyquist. This can shift upper partials' frequencies (a form of
// unintended dispersion) even though it fixes linear interpolation's
// magnitude-loss problem -- exactly the tradeoff this investigation
// measures rather than assumes away.

export class AllpassInterpolator {
    constructor() {
        this.xPrev = 0;
        this.yPrev = 0;
    }

    reset() {
        this.xPrev = 0;
        this.yPrev = 0;
    }

    read(buffer, bufferLength, writeIndex, offsetSamples) {
        // Matches LinearInterpolator's exact position calculation --
        // critically, the integer/fractional split must be taken AFTER
        // combining writeIndex (always an integer) with offsetSamples
        // (fractional), not by flooring offsetSamples on its own first.
        // writeIndex - offsetSamples flips which side the fractional part
        // falls on whenever offsetSamples is non-integer -- splitting
        // offsetSamples in isolation reads the wrong buffer index
        // entirely (found by empirical trace during this investigation,
        // not caught by inspection: energy silently went to zero within
        // ~40ms because the interpolator's read never actually reached
        // the excited samples until far later than the intended loop
        // period).
        const position = (writeIndex - offsetSamples + bufferLength * 2) % bufferLength;
        const integerIndex = Math.floor(position);
        const rawFrac = position - integerIndex;
        const frac = Math.max(0.001, Math.min(0.999, rawFrac));
        const a = (1 - frac) / (1 + frac);

        const x = buffer[integerIndex];

        const y = a * x + this.xPrev - a * this.yPrev;
        this.xPrev = x;
        this.yPrev = Number.isFinite(y) ? y : 0;
        return this.yPrev;
    }
}

export default AllpassInterpolator;
