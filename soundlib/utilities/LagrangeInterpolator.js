// Plain, framework-agnostic fractional-delay interpolation strategy --
// third-order Lagrange (4-point polynomial) interpolation. Evaluated as
// the second candidate after AllpassInterpolator.js, per this codebase's
// own investigation: allpass1 fixes linear interpolation's high-frequency
// magnitude loss (see LinearInterpolator.js) almost completely, but its
// own frequency-dependent phase/group delay introduces a serious,
// frequency- and topology-dependent TUNING error (measured up to -18% at
// high frequency for WG2 -- unacceptable for a pitched instrument). A
// higher-order Lagrange interpolator is the standard next candidate for
// exactly this problem in the digital-waveguide/physical-modeling
// literature (e.g. STK's delay-line classes) -- it is FIR (stateless, no
// recursive memory, so it cannot introduce the same kind of phase-delay-
// driven mistuning an IIR/allpass section can), at the cost of reading 4
// neighboring samples instead of 2 and a gentler (not zero) magnitude
// rolloff of its own.
//
// Stateless -- like LinearInterpolator, safe to share a single instance
// across every tap site.
//
// Standard 3rd-order Lagrange formula (4 support points at integer
// offsets -1, 0, 1, 2 relative to the floor of the target position,
// evaluated at fractional distance `frac` from position 0 toward
// position 1):
//   y = x[-1] * (-frac*(frac-1)*(frac-2))/6
//     + x[0]  * ((frac+1)*(frac-1)*(frac-2))/2
//     + x[1]  * (-(frac+1)*frac*(frac-2))/2
//     + x[2]  * ((frac+1)*frac*(frac-1))/6

export class LagrangeInterpolator {
    read(buffer, bufferLength, writeIndex, offsetSamples) {
        const position = (writeIndex - offsetSamples + bufferLength * 2) % bufferLength;
        const base = Math.floor(position);
        const frac = position - base;

        const wrap = (i) => buffer[((i % bufferLength) + bufferLength) % bufferLength];
        const xm1 = wrap(base - 1);
        const x0 = wrap(base);
        const x1 = wrap(base + 1);
        const x2 = wrap(base + 2);

        const c0 = (-frac * (frac - 1) * (frac - 2)) / 6;
        const c1 = ((frac + 1) * (frac - 1) * (frac - 2)) / 2;
        const c2 = (-(frac + 1) * frac * (frac - 2)) / 2;
        const c3 = ((frac + 1) * frac * (frac - 1)) / 6;

        return xm1 * c0 + x0 * c1 + x1 * c2 + x2 * c3;
    }

    // Stateless -- no-op, present only to satisfy the same interface
    // AllpassInterpolator needs.
    reset() {}
}

export const SHARED_LAGRANGE_INTERPOLATOR = new LagrangeInterpolator();

export default LagrangeInterpolator;
