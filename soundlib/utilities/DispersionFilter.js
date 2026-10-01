// Plain, framework-agnostic dispersion filter for waveguide-family models
// -- see FractionalDelayWaveguide.js for the shared-placement rationale
// (reuse by future bow/hammer/other waveguide models, per the spec's own
// stated intent). WaveguideResonator v1 Phase C (dispersion/stiffness),
// first step -- see docs/MODEL_PATTERNS.md's digital-waveguide archetype
// and scratch/WaveguideResonator-v1-Specification-and-Reasoning-Model.md
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
// constants below). This is a PHYSICAL/physically-informed mapping (per
// docs/MODEL_PATTERNS.md's four-category classification) -- a real
// published closed form, not invented for this codebase.
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
// TARGET DESCRIPTION -- { amount, knee, slope, polarity, pitchLock } --
// rather than directly onto an opaque allpass coefficient. This is the
// widened-range step: only `amount` is actually live (driven by
// `stiffness`); `knee`/`slope`/`polarity`/`pitchLock` stay fixed internal
// defaults this step, but are REAL constructor arguments (not hardcoded
// module constants) specifically so a future dispersionKnee/
// dispersionSlope Parameter is just "construct with a different value,"
// no restructuring of this class needed. `polarity`/`pitchLock` stay
// simple internal constants (not constructor args) for now -- they're
// flags, not curve-shape numbers -- but DO appear in the struct returned
// by getTargetDescription(), so the data model already accommodates them.
//
// `amount` is expressed in an AUDIBLE quantity -- cents of stretch at
// partial `knee` -- not B directly, per the explicit design goal of
// keeping the public-facing concept legible rather than an opaque
// coefficient. Inverting the generalized stiff-string relation
// f_n = n*f0*sqrt((1+B*n^slope)/(1+B)) for B given a target
// cents(knee)=amount:
//   R = 2^(amount/600)
//   B = (R-1) / (knee^slope - R)
// This is a closed-form inversion of the SAME textbook relation the
// Rauhala-Valimaki empirical fit targets (slope fixed at 2, their own
// calibration exponent -- see the slope default below), not a new
// physical claim of its own.
//
// This part of the mapping (stiffness -> amount, and amount -> B via the
// inversion above) is PHYSICALLY INFORMED, not physical: it preserves
// the right causal direction (higher stiffness -> higher amount -> higher
// B -> more stretching) but the specific curve shape/ceiling is a
// judgment call, calibrated empirically against where the Rauhala-
// Valimaki fit's own approximation stays reliable (see wg2Config.js's
// DISPERSION_AMOUNT_MAX_CENTS comment for the measurement), not derived
// from one particular physical string.
//
// At stiffness below a small epsilon, the filter BYPASSES entirely
// (process() returns its input unchanged, groupDelaySamplesAt() returns
// 0) rather than merely driving the coefficient toward zero -- this is
// what gives stiffness=0 the cleanest possible reference behavior,
// identical to not having this component in the signal path at all.

const STIFFNESS_EPSILON = 1e-6;
const POLARITY_DEFAULT = 'positive'; // only 'positive' is implemented -- see module comment above the class
const PITCH_LOCK_DEFAULT = true; // the only mode implemented -- a future lengthLocked mode is a caller-side choice, not a DispersionFilter change

// Closed-form inversion: target cents of stretch at partial `knee` ->
// the inharmonicity coefficient B that (per the idealized continuous
// formula) produces it. See module comment above for the derivation.
function bFromTargetAmount(amountCents, knee, slope) {
    const R = Math.pow(2, amountCents / 600);
    return (R - 1) / (Math.pow(knee, slope) - R);
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
    // knee/slope/amountMaxCents/stiffnessCurveExponent: see wg2Config.js's
    // DISPERSION_* constants for the measured/documented defaults and
    // their rationale -- passed in here (not hardcoded) so a future
    // dispersionKnee/dispersionSlope control needs no change to this file.
    constructor(sectionCount, knee, slope, amountMaxCents, stiffnessCurveExponent) {
        this.sectionCount = sectionCount;
        this.knee = knee;
        this.slope = slope;
        this.amountMaxCents = amountMaxCents;
        this.stiffnessCurveExponent = stiffnessCurveExponent;
        this.xPrev = new Float64Array(sectionCount);
        this.yPrev = new Float64Array(sectionCount);
        this.a1 = 0;
        this.bypassed = true;
        this.lastTarget = null; // set by setStiffness(); see getTargetDescription()
    }

    reset() {
        this.xPrev.fill(0);
        this.yPrev.fill(0);
    }

    // Requested-vs-achieved reporting: the target description setStiffness()
    // computed most recently (null when bypassed). Callers measure the
    // ACTUAL achieved stretch themselves (this class has no notion of
    // "partials," it just filters samples) and compare against this.
    getTargetDescription() {
        return this.lastTarget;
    }

    // Recomputes the shared section coefficient from stiffness (0-1) and
    // the current fundamental -- called once per block, same cadence as
    // every other live k-rate parameter in this codebase (frequency,
    // decayTime, ...). Two steps: stiffness -> target description (amount
    // live, knee/slope/polarity/pitchLock fixed) -> B (closed-form
    // inversion) -> a1 (the existing, unchanged Rauhala-Valimaki fit).
    setStiffness(stiffness, f0Hz, sampleRate) {
        if (stiffness <= STIFFNESS_EPSILON) {
            this.bypassed = true;
            this.a1 = 0;
            this.lastTarget = null;
            return;
        }
        this.bypassed = false;

        const amount = this.amountMaxCents * Math.pow(stiffness, this.stiffnessCurveExponent);
        this.lastTarget = {
            amount,
            knee: this.knee,
            slope: this.slope,
            polarity: POLARITY_DEFAULT,
            pitchLock: PITCH_LOCK_DEFAULT
        };

        const B = bFromTargetAmount(amount, this.knee, this.slope);
        const Bc = Math.max(B, 0.000001);
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
