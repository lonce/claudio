// Plain, framework-agnostic dispersion filter for waveguide-family models
// -- see FractionalDelayWaveguide.js for the shared-placement rationale
// (reuse by future bow/hammer/other waveguide models, per the spec's own
// stated intent). WaveguideResonator v1 Phase C (dispersion/stiffness)
// -- see docs/MODEL_PATTERNS.md's digital-waveguide archetype and
// scratch/WaveguideResonator-v1-Specification-and-Reasoning-Model.md
// section 5.4.
//
// A cascade of `sectionCount` identical first-order allpass sections --
// the SAME transfer-function family as AllpassInterpolator.js's single
// section ((a+z^-1)/(1+a*z^-1), y[n]=a*x[n]+x[n-1]-a*y[n-1]), just
// repeated M times in series with independent per-section state, and with
// a DIFFERENT coefficient-derivation purpose: AllpassInterpolator
// approximates a flat fractional delay (its own phase error is an
// unwanted side effect to minimize); this filter DELIBERATELY introduces
// frequency-dependent phase delay as the actual goal.
//
// Coefficient design: the closed-form method of Rauhala & Valimaki,
// "Dispersion Modeling in Waveguide Piano Synthesis Using Tunable Allpass
// Filters" (DAFX-2006, pp. 71-76), as implemented in Faust's standard
// library (misceffects.lib's piano_dispersion_filter, authored by Julius
// O. Smith III -- verified against the real source at
// https://github.com/grame-cncm/faustlibraries/blob/master/misceffects.lib,
// not transcribed from a secondary summary). Maps a target inharmonicity
// coefficient B (the textbook stiff-string relation f_n = n*f0*sqrt(1 +
// B*n^2)) and the current fundamental f0 to a single coefficient `a1`
// shared by all M sections, via an empirical fit (the k1..k3/m1..m4
// constants below), calibrated assuming exponent 2 specifically -- a
// DIFFERENT "2" from the live `slope` exponent below (see `update()`'s
// own comment for why these must not be conflated).
//
// Critically, the source design ALREADY separates the dispersion phase
// itself from tuning compensation: the group delay the whole cascade
// introduces AT f0 (`groupDelaySamplesAt()`) is a value a caller can use
// to shorten the surrounding delay line so the fundamental stays in tune
// (pitchLocked behavior) -- entirely independent of process()'s own
// per-sample filtering. A future lengthLocked mode simply stops using
// that value; this class and process() don't change at all.
//
// `stiffness` (0-1, the public control surface) maps onto an internal
// TARGET DESCRIPTION -- { amount, pivot, slope, polarity, pitchLock }.
// `amount` (cents of stretch at partial `pivot`) is the audible quantity
// stiffness actually drives; `pivot` and `slope` are themselves live,
// smoothed parameters (see update()); `polarity`/`pitchLock` stay fixed
// internal constants, present in the struct so the data model already
// accommodates them without restructuring later.
//
// IMPORTANT NAMING NOTE, resolved by direct measurement (not assumed):
// `pivot` was named `knee` in an earlier version of this file. Rendering
// the real filter's achieved stretch curve at several reference-partial
// values showed smooth, continuous growth from n=1 at EVERY value tested
// -- there is no flat "below-knee" region at any of them; moving `pivot`
// simply rescales where the SAME smooth power-law curve lands, it does
// not shift an onset boundary. `pivot` is an accurate name for what this
// parameter does; `knee` was not, and renaming (not building a separate
// true onset-threshold mechanism) was the deliberately bounded response
// -- see docs/MODEL_PATTERNS.md's Phase C section and
// soundlib/models/WG2/knowledge/causal-claims.yaml for the measurement.
//
// `amount` is expressed in an AUDIBLE quantity -- cents of stretch at
// partial `pivot` -- not B directly. Inverting the generalized stiff-
// string relation f_n = n*f0*sqrt((1+B*n^slope)/(1+B)) for B given a
// target cents(pivot)=amount:
//   R = 2^(amount/600)
//   B = (R-1) / (pivot^slope - R)
// This is a closed-form inversion of the SAME textbook relation the
// Rauhala-Valimaki empirical fit targets, not a new physical claim.
//
// SAFETY CLAMP, measured not guessed: the resulting B is clamped to
// [tiny-positive-floor, bSafeMax] (a constructor argument -- see
// wg2Config.js's DISPERSION_B_SAFE_MAX comment for the cents-accurate
// measurement this was chosen from). This protects FUNDAMENTAL TUNING
// specifically -- large B stays finite/stable/correctly-ordered far
// beyond this clamp (tested to B=0.2), so this is NOT a stability limit,
// it is "the current limit of reliable pitch compensation" (the user's
// own framing). It does NOT protect stretch accuracy at partials beyond
// `pivot` itself, which has its own, separate, lower, per-partial
// breakdown points (see causal-claims.yaml) -- two different limitations,
// not conflated into one clamp.
//
// Clamping is never invisible: getTargetDescription() reports
// requestedAmount, the unclamped and clamped B, whether clamping
// occurred, and maxRealizableAmount (what B=bSafeMax itself produces at
// the current pivot/slope) -- so a caller can tell when further movement
// of `stiffness` has entered a "dead zone" where it stops mattering.
//
// At stiffness below a small epsilon, the filter BYPASSES entirely
// (process() returns its input unchanged, groupDelaySamplesAt() returns
// 0) rather than merely driving the coefficient toward zero -- this is
// what gives stiffness=0 the cleanest possible reference behavior,
// identical to not having this component in the signal path at all.

const STIFFNESS_EPSILON = 1e-6;
const POLARITY_DEFAULT = 'positive'; // only 'positive' is implemented -- see module comment above
const PITCH_LOCK_DEFAULT = true; // the only mode implemented -- a future lengthLocked mode is a caller-side choice, not a DispersionFilter change
const MIN_B = 0.000001; // tiny-positive floor, defends against the inversion's denominator going non-positive (not expected within the documented pivot/slope/amount ranges -- see wg2Config.js -- but guarded regardless, fail-toward-safety)
const ASSUMED_BLOCK_SAMPLES = 128; // the standard Web Audio render quantum this whole codebase assumes elsewhere; used only to size the per-block smoothing coefficient

// Closed-form inversion: target cents of stretch at partial `pivot` ->
// the inharmonicity coefficient B that (per the idealized continuous
// formula) produces it. See module comment above for the derivation.
function bFromTargetAmount(amountCents, pivot, slope) {
    const R = Math.pow(2, amountCents / 600);
    return (R - 1) / (Math.pow(pivot, slope) - R);
}

// The idealized continuous-formula cents stretch at partial n, for a
// given B/slope -- used both to derive bFromTargetAmount's inverse and
// to compute maxRealizableAmount (the forward direction, at B=bSafeMax).
function idealCentsAt(B, n, slope) {
    return 600 * Math.log2((1 + B * Math.pow(n, slope)) / (1 + B));
}

// Empirical fit constants from Rauhala & Valimaki (2006), as corrected in
// the Faust misceffects.lib implementation (an erratum in the original
// paper's Eq. 7 is corrected there and in Rauhala's dissertation).
const K1 = -0.00179;
const K2 = -0.0233;
const K3 = -2.93;
const M1 = 0.0126;
const M2 = 0.0606;
const M3 = -0.00825;
const M4 = 1.97;

const SEMITONE_RATIO = Math.pow(2, 1 / 12);
const A0_HZ = 27.5;

function logBase(base, x) {
    return Math.log(x) / Math.log(base);
}

// Group delay, in samples, of ONE first-order allpass section with
// coefficient `a` at angular frequency `omegaT` (radians/sample) --
// atan(sin(wT)/(a+cos(wT))) / wT.
function sectionGroupDelay(a, omegaT) {
    return Math.atan(Math.sin(omegaT) / (a + Math.cos(omegaT))) / omegaT;
}

export class DispersionFilter {
    // pivot/slope: initial values AND the smoother's reset target (see
    // reset()). amountMaxCents/stiffnessCurveExponent: shape the
    // stiffness->amount mapping. bSafeMax: the tuning-safety clamp (see
    // module comment). smoothingSeconds: one-pole time constant applied
    // to pivot/slope specifically (stiffness/amount stay unsmoothed,
    // matching that control's own already-validated finding that it
    // needs none). All passed in, not hardcoded, so future exposure of
    // any of these needs no change to this file -- see wg2Config.js for
    // the measured/documented values actually used.
    constructor(sectionCount, pivot, slope, amountMaxCents, stiffnessCurveExponent, bSafeMax, smoothingSeconds) {
        this.sectionCount = sectionCount;
        this.defaultPivot = pivot;
        this.defaultSlope = slope;
        this.amountMaxCents = amountMaxCents;
        this.stiffnessCurveExponent = stiffnessCurveExponent;
        this.bSafeMax = bSafeMax;
        this.smoothingSeconds = smoothingSeconds;

        this.smoothedPivot = pivot;
        this.smoothedSlope = slope;

        this.xPrev = new Float64Array(sectionCount);
        this.yPrev = new Float64Array(sectionCount);
        this.a1 = 0;
        this.bypassed = true;
        this.lastTarget = null; // set by update(); see getTargetDescription()
        this.needsSnap = false; // see reset()/update()
    }

    // BUG FIX (found from a real, reported artifact -- a fast pitch
    // glide at the start of every fresh note once pivot/slope were moved
    // away from their construction defaults): this does NOT reset
    // smoothedPivot/smoothedSlope back to this.defaultPivot/defaultSlope
    // -- doing so forced every fresh note to re-smooth from (4,2) up to
    // whatever the user's actual sliders say, over ~30-150ms, dragging
    // railLength through a wide swing right at note onset (changing a
    // waveguide's geometric delay length WHILE it's actively circulating
    // is a genuine Doppler-style pitch glide, not a cosmetic artifact --
    // see the spec's own section 8.3 on fast delay modulation). Smoothing
    // exists to protect against audible jumps from a LIVE pivot/slope
    // change WHILE a note is sounding; a brand-new note should start
    // immediately at the currently-dialed-in values, same as every other
    // parameter (frequency, stiffness, ...) already does. `needsSnap`
    // tells the NEXT update() call to jump straight to its target instead
    // of smoothing toward it, exactly once, right after a reset.
    reset() {
        this.xPrev.fill(0);
        this.yPrev.fill(0);
        this.needsSnap = true;
    }

    // Requested-vs-achieved reporting: the full target description
    // update() computed most recently (null when bypassed). Callers
    // measure the ACTUAL achieved stretch themselves (this class has no
    // notion of "partials," it just filters samples) and compare against
    // this -- but unclampedB/clampedB/wasClamped/maxRealizableAmount are
    // already enough to know WHETHER a given request will be honored
    // before measuring anything.
    getTargetDescription() {
        return this.lastTarget;
    }

    // Recomputes the shared section coefficient from stiffness (0-1),
    // pivot, and slope (both live, smoothed -- see class comment), and
    // the current fundamental. Called once per block, same cadence as
    // every other live k-rate parameter in this codebase.
    //
    // pivot/slope are smoothed toward their raw targets with a one-pole
    // filter BEFORE use -- an abrupt (unsmoothed) jump in either was
    // measured during design to produce a real, if modest, sample-level
    // discontinuity (~2-2.5x the local baseline delta); smoothing
    // avoids this the same way live-adjustable parameters are smoothed
    // elsewhere in Web Audio (setTargetAtTime-style). `stiffness` itself
    // is NOT smoothed here -- a live stiffness ramp was already measured
    // safe without it (see the amount-widening step's own findings).
    //
    // NOTE on `slope`: this is the exponent in the amount-to-B
    // INVERSION (how pivot/amount combine to choose a B). It is a
    // different "2" from the one baked into the Rauhala-Valimaki a1-
    // from-B empirical fit below, which assumes exponent 2 for its OWN
    // calibration regardless of what `slope` is live-set to -- varying
    // `slope` changes which B gets chosen, not the fit's own internal
    // assumption. See the module comment's "IMPORTANT NAMING NOTE" and
    // this file's own history for why this distinction matters.
    update(stiffness, pivot, slope, f0Hz, sampleRate) {
        if (this.needsSnap) {
            // Right after a reset (a brand-new note) -- jump straight to
            // the current target instead of smoothing toward it. See
            // reset()'s own comment for why: smoothing a fresh note's
            // OWN starting value (rather than only a later, live change)
            // was the actual bug.
            this.smoothedPivot = pivot;
            this.smoothedSlope = slope;
            this.needsSnap = false;
        } else {
            const blockDurationSeconds = ASSUMED_BLOCK_SAMPLES / sampleRate;
            const smoothingCoefficient = Math.exp(-blockDurationSeconds / this.smoothingSeconds);
            this.smoothedPivot += (pivot - this.smoothedPivot) * (1 - smoothingCoefficient);
            this.smoothedSlope += (slope - this.smoothedSlope) * (1 - smoothingCoefficient);
        }

        if (stiffness <= STIFFNESS_EPSILON) {
            this.bypassed = true;
            this.a1 = 0;
            this.lastTarget = null;
            return;
        }
        this.bypassed = false;

        const amount = this.amountMaxCents * Math.pow(stiffness, this.stiffnessCurveExponent);
        const unclampedB = bFromTargetAmount(amount, this.smoothedPivot, this.smoothedSlope);
        const clampedB = Math.min(Math.max(unclampedB, MIN_B), this.bSafeMax);
        const maxRealizableAmount = idealCentsAt(this.bSafeMax, this.smoothedPivot, this.smoothedSlope);

        this.lastTarget = {
            requestedAmount: amount,
            pivot: this.smoothedPivot,
            slope: this.smoothedSlope,
            polarity: POLARITY_DEFAULT,
            pitchLock: PITCH_LOCK_DEFAULT,
            unclampedB,
            clampedB,
            wasClamped: clampedB !== unclampedB,
            maxRealizableAmount
        };

        const Bc = Math.max(clampedB, MIN_B);
        const logBc = Math.log(Bc);

        const ikey = logBase(SEMITONE_RATIO, (f0Hz * SEMITONE_RATIO) / A0_HZ);
        const kd = Math.exp(K1 * logBc * logBc + K2 * logBc + K3);
        const Cd = Math.exp((M1 * Math.log(this.sectionCount) + M2) * logBc + M3 * Math.log(this.sectionCount) + M4);
        const D = Math.exp(Cd - ikey * kd);

        // a1 = (1-D)/(1+D), D >= 0 so a1 in (-1, 1] -- stable by
        // construction (Rauhala & Valimaki Eq. 3). Clamp away from the
        // exact |a1|=1 boundary as an extra safety margin, matching this
        // codebase's established "constrain coefficient range away from
        // instability" convention (AllpassInterpolator.js's own frac clamp).
        const rawA1 = (1 - D) / (1 + D);
        this.a1 = Math.max(-0.999, Math.min(0.999, rawA1));
    }

    // The M-section cascade. Returns `sample` unchanged when bypassed.
    process(sample) {
        if (this.bypassed) return sample;

        let x = sample;
        for (let i = 0; i < this.sectionCount; i++) {
            const y = this.a1 * x + this.xPrev[i] - this.a1 * this.yPrev[i];
            this.xPrev[i] = x;
            this.yPrev[i] = Number.isFinite(y) ? y : 0;
            x = this.yPrev[i];
        }
        return x;
    }

    // Group delay, in samples, the WHOLE cascade ADDS at f0Hz, for the
    // filter's CURRENT stiffness/a1 state -- a pure function, no
    // interaction with process()'s own running state. 0 when bypassed.
    // Callers subtract this from the surrounding delay line's own length
    // to keep the fundamental in tune (pitchLocked behavior).
    //
    // Built from Rauhala & Valimaki's own Df0 = polydel(a1) - polydel(1/a1)
    // (scaled by sectionCount, M identical sections), but NOT their exact
    // sign convention: the Faust reference exposes `-Df0*M`, meant to be
    // ADDED to a delay-line length in their own pipeline usage
    // (`+(totalDelay)`); this method instead returns a plain positive
    // "samples of delay added" quantity, matching its own name and this
    // model's own usage (wg2Processor.js subtracts it directly). Which
    // sign is actually correct for THIS implementation is confirmed, not
    // assumed, by the fundamental-tuning regression test (stays in tune
    // across a stiffness sweep) -- see wg2Pipeline.test.js.
    groupDelaySamplesAt(f0Hz, sampleRate) {
        if (this.bypassed) return 0;

        const omegaT = (2 * Math.PI * f0Hz) / sampleRate;
        const df0 = sectionGroupDelay(this.a1, omegaT) - sectionGroupDelay(1 / this.a1, omegaT);
        return df0 * this.sectionCount;
    }
}

export default DispersionFilter;
