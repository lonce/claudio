// Plain data, no worklet dependency -- same shape as wg1Config.js. Phase B
// only (see scratch/WaveguideResonator-v1-Specification-and-Reasoning-
// Model.md and docs/MODEL_PATTERNS.md's digital-waveguide archetype):
// adds excitation/pickup position, pickup type, and a triangle excitation
// shape on top of WG1's frequency/energy/decayTime. Extended controls
// (width, hardness, roughness, velocityMix, pickupWidth) are out of scope
// for this pass -- see the WG2 planning notes.

// Physical: same range as WG1 (spec's essential-controls table, section 6).
export const FREQUENCY_MIN_HZ = 20;
export const FREQUENCY_MAX_HZ = 4000;
export const FREQUENCY_DEFAULT_HZ = 220;

export const ENERGY_DEFAULT = 0.6;

export const DECAY_TIME_MIN_SECONDS = 0.05;
// Lowered from 30 to 2 for more usable control resolution over a good
// perceptual range -- decayTime is tau (the 1/e time constant), not T60
// (time to -60dB, which is tau*ln(1000) ~= 6.9x longer), and the measured
// T60 at this max is already well over 10s at moderate frequencies. "At
// least for now" -- revisit if 30s decays turn out to be wanted later.
export const DECAY_TIME_MAX_SECONDS = 2;
export const DECAY_TIME_DEFAULT_SECONDS = 1.0;

export const EXCITATION_TYPE_DEFAULT = 'noise';
export const EXCITATION_TYPE_CHOICES = ['noise', 'impulse', 'triangle'];

// Physical: spec's essential-controls table. Clamped away from the exact
// endpoints (spec 5.1: "excluding unstable endpoint singularities") --
// also avoids division-by-zero in InitialConditionExciter's triangle
// shape math (which divides by `position` and `1 - position`).
export const EXCITATION_POSITION_MIN = 0.02;
export const EXCITATION_POSITION_MAX = 0.98;
export const EXCITATION_POSITION_DEFAULT = 0.18;

export const PICKUP_POSITION_MIN = 0.02;
export const PICKUP_POSITION_MAX = 0.98;
export const PICKUP_POSITION_DEFAULT = 0.72;

export const PICKUP_TYPE_DEFAULT = 'displacement';
export const PICKUP_TYPE_CHOICES = ['displacement', 'velocity', 'bridgeForce'];

// Physically informed: two rigid string ends, each a proper sign-
// inverting boundary now that they're represented separately (see
// RigidTermination.js's own reasoning and WG1's -- WG1's single lumped
// loop used +1 because it represented BOTH ends combined over one round
// trip; here each boundary is expressed correctly on its own).
export const TERMINATION_REFLECTION = -1.0;

// Set empirically from soundlib/utilities/test/wg2Pipeline.test.js's
// full parameter-grid sweep, same gain-staging discipline as WG1/Wind/
// ChimeVocoder.
export const OUTPUT_GAIN = 1;

// Phase C, first dispersion step -- see soundlib/utilities/DispersionFilter.js
// and docs/MODEL_PATTERNS.md's digital-waveguide archetype. 0 = no effect
// at all (the filter bypasses entirely), chosen as the default for strict
// backward compatibility: a freshly-added parameter changes nothing about
// today's WG2 sound until turned up.
export const STIFFNESS_MIN = 0;
export const STIFFNESS_MAX = 1;
export const STIFFNESS_DEFAULT = 0;

// Number of identical first-order allpass sections in the dispersion
// cascade -- a structural/CPU-cost choice, not itself part of `stiffness`.
// See DispersionFilter.js's own comment for the source (Rauhala &
// Valimaki, DAFX-2006) and this value's rationale.
export const DISPERSION_SECTION_COUNT = 6;

// Phase C -- see DispersionFilter.js's own comment for the full
// derivation. pivot/slope/amountMaxCents/stiffnessCurveExponent/bSafeMax/
// smoothingSeconds are all constructor arguments (not hardcoded inside
// DispersionFilter.js) specifically so a future dispersionPivot/
// dispersionSlope Parameter is just "pass a different value from here,"
// no filter rewrite needed.
//
// NAMING NOTE: this was called DISPERSION_KNEE in an earlier version.
// Renamed to PIVOT after direct measurement showed the real filter's
// achieved stretch curve grows smoothly from partial 1 at EVERY tested
// reference-partial value -- there is no flat "below-knee" onset region
// at any of them. Moving this value rescales where the target `amount`
// lands on the same smooth power-law curve; it does not shift an onset
// boundary the way "knee" implies. See DispersionFilter.js's own
// "IMPORTANT NAMING NOTE" and causal-claims.yaml for the measurement.
//
// pivot=4 (not 8, used in the amount-widening step's own headline
// numbers): partial 8 breaks down earlier than partial 4 under the same
// B (approximation error grows with n^slope), so anchoring the target
// amount at a lower, more robust partial leaves more usable headroom
// before the filter's own approximation limits are reached.
export const DISPERSION_PIVOT_MIN = 2;
export const DISPERSION_PIVOT_MAX = 16;
export const DISPERSION_PIVOT_DEFAULT = 4; // unchanged from the fixed value used until this step
// slope=2 matches the literature's own textbook stiff-string exponent
// (f_n = n*f0*sqrt(1+B*n^2)) as its DEFAULT -- not because it's unsafe to
// vary (confirmed by direct measurement: varying slope at a fixed pivot/
// amount genuinely reshapes the curve, e.g. the ratio of partial-16- to
// partial-4-stretch goes from ~4.4x at slope=1 to ~25x at slope=3, not a
// uniform rescale -- a real, independent shape control). What stays
// fixed regardless of this live `slope` value is a DIFFERENT "2": the
// Rauhala-Valimaki a1-from-B empirical fit's own internal calibration
// exponent, baked into DispersionFilter.js's K1..M4 constants -- `slope`
// here only governs the amount-to-B INVERSION (which B gets chosen),
// never the fit itself. See DispersionFilter.js's own `update()` comment.
export const DISPERSION_SLOPE_MIN = 0.5;
export const DISPERSION_SLOPE_MAX = 4;
export const DISPERSION_SLOPE_DEFAULT = 2; // unchanged -- the literature value
// Measured empirically (not guessed), using a frequency-adaptive
// measurement window (>=60 cycles of f0, min 8192 samples -- a fixed
// 4096-sample window gives misleading, noisy cents figures at low f0,
// found and corrected during this step's own planning): fundamental
// tuning stays under ~1 cent from 55-880Hz through B=0.05, growing to
// ~10.6 cents at 1760Hz at that same B -- right at the stated 10-cent
// tolerance, reported honestly rather than hidden. Real breakdown
// (>20 cents) starts around B=0.07-0.08 depending on frequency. 0.05 is
// kept PROVISIONALLY (per explicit instruction) as "the current limit of
// reliable pitch compensation, not a stability or final expressive
// limit" -- large B stays finite/stable/correctly-ordered far beyond
// this (tested to B=0.2). A future, separate investigation (recorded,
// not pursued here) could extend this via direct phase-based tuning
// compensation -- see causal-claims.yaml.
export const DISPERSION_B_SAFE_MAX = 0.05;
// One-pole smoothing time constant applied to pivot/slope specifically
// (NOT to stiffness/amount, which was already measured safe unsmoothed).
// An abrupt, unsmoothed pivot/slope jump was measured during design to
// produce a real, if modest, sample-level discontinuity (~2-2.5x the
// local baseline delta) -- this smooths that out. Starting value;
// confirmed adequate (not just assumed) by the abrupt-jump-with-
// smoothing regression test in wg2Pipeline.test.js.
export const DISPERSION_SMOOTHING_SECONDS = 0.03;

// SAFETY FIX for a real, user-reported bug (a loud, distorted "blast" at
// high frequency + high stiffness + certain dispersionPivot/
// dispersionSlope combinations) -- see
// soundlib/models/WG2/knowledge/causal-claims.yaml's
// claim.lagrange3-unstable-at-short-fractional-rail-length for the full
// investigation. Root cause: dispersion's own compensation
// (DispersionFilter.groupDelaySamplesAt) can demand more delay than the
// geometric rail can supply at high frequency, forcing railLength toward
// its floor -- and the default lagrange3 interpolator's 4-point stencil
// becomes genuinely UNSTABLE (confirmed exponential, not just imprecise)
// at short, FRACTIONAL railLength values specifically. Measured directly
// (a fine sweep of a minimal self-feedback loop, lagrange3 vs. linear):
// the danger zone is the open interval (1, 2) samples -- e.g. railLength
// =1.35 produced a raw peak of ~1.6e61 in 3000 iterations, while
// railLength=2.0 and every tested fractional value from 2.0 up through
// 5.0 stayed stable (~1.0). Exactly integer railLength values (1, 2, 3,
// ...) are ALSO stable even below 2 (the dangerous stencil tap's own
// Lagrange coefficient is exactly zero when the fractional part is
// exactly zero) -- but compensation is a continuous value and will
// essentially never land on an exact integer, so this can't be relied on.
//
// Chosen remediation (of three options presented; this one explicitly
// chosen to try first, with the option to revert if it causes
// "playability" issues during further exploration): clamp the
// geometric railLength's own floor from 1 up to this value, which
// INDIRECTLY caps how much compensation dispersion's own pitchLocked
// calculation can effectively demand at high frequency -- the floor is
// applied at the same site the old Math.max(1, ...) floor already was in
// wg2Processor.js/wg2PipelineCore.js, not a new parallel calculation.
// Where this floor engages, pitchLocked tuning accuracy can degrade
// further at that specific (frequency, stiffness, pivot, slope) corner
// rather than the waveguide becoming unstable -- a tuning-accuracy
// tradeoff, not a new one in kind (same spirit as DISPERSION_B_SAFE_MAX
// above), just at a different, more extreme corner of the parameter
// space than B_SAFE_MAX alone was protecting.
export const DISPERSION_MIN_SAFE_RAIL_LENGTH_SAMPLES = 2;
// 100 cents at pivot=4/slope=2 inverts to B~0.0082 -- comfortably under
// DISPERSION_B_SAFE_MAX (0.05), so the default shape's own ceiling stays
// entirely unclamped; this value is unchanged from the amount-widening
// step.
export const DISPERSION_AMOUNT_MAX_CENTS = 100;
// stiffness -> amount = amountMaxCents * stiffness^stiffnessCurveExponent.
// Exponent 3 keeps the lower half of the stiffness range inside "fine
// control over plausible stiffness" territory (amount at stiffness=0.5 is
// LESS than the old B_MAX's full-range equivalent) while the upper range
// ramps steeply into the new, much larger ceiling.
export const DISPERSION_STIFFNESS_CURVE_EXPONENT = 3;

export const WG2_CONFIG = {
    frequencyMinHz: FREQUENCY_MIN_HZ,
    frequencyMaxHz: FREQUENCY_MAX_HZ,
    frequencyDefaultHz: FREQUENCY_DEFAULT_HZ,
    energyDefault: ENERGY_DEFAULT,
    decayTimeMinSeconds: DECAY_TIME_MIN_SECONDS,
    decayTimeMaxSeconds: DECAY_TIME_MAX_SECONDS,
    decayTimeDefaultSeconds: DECAY_TIME_DEFAULT_SECONDS,
    excitationTypeDefault: EXCITATION_TYPE_DEFAULT,
    excitationTypeChoices: EXCITATION_TYPE_CHOICES,
    excitationPositionMin: EXCITATION_POSITION_MIN,
    excitationPositionMax: EXCITATION_POSITION_MAX,
    excitationPositionDefault: EXCITATION_POSITION_DEFAULT,
    pickupPositionMin: PICKUP_POSITION_MIN,
    pickupPositionMax: PICKUP_POSITION_MAX,
    pickupPositionDefault: PICKUP_POSITION_DEFAULT,
    pickupTypeDefault: PICKUP_TYPE_DEFAULT,
    pickupTypeChoices: PICKUP_TYPE_CHOICES,
    terminationReflection: TERMINATION_REFLECTION,
    outputGain: OUTPUT_GAIN,
    stiffnessMin: STIFFNESS_MIN,
    stiffnessMax: STIFFNESS_MAX,
    stiffnessDefault: STIFFNESS_DEFAULT,
    dispersionSectionCount: DISPERSION_SECTION_COUNT,
    dispersionPivotMin: DISPERSION_PIVOT_MIN,
    dispersionPivotMax: DISPERSION_PIVOT_MAX,
    dispersionPivotDefault: DISPERSION_PIVOT_DEFAULT,
    dispersionSlopeMin: DISPERSION_SLOPE_MIN,
    dispersionSlopeMax: DISPERSION_SLOPE_MAX,
    dispersionSlopeDefault: DISPERSION_SLOPE_DEFAULT,
    dispersionBSafeMax: DISPERSION_B_SAFE_MAX,
    dispersionSmoothingSeconds: DISPERSION_SMOOTHING_SECONDS,
    dispersionAmountMaxCents: DISPERSION_AMOUNT_MAX_CENTS,
    dispersionStiffnessCurveExponent: DISPERSION_STIFFNESS_CURVE_EXPONENT,
    dispersionMinSafeRailLengthSamples: DISPERSION_MIN_SAFE_RAIL_LENGTH_SAMPLES
};

export default WG2_CONFIG;
