// Plain data, no worklet dependency -- same shape as chimeVocoderConfig.js.
// Ported from scratch/DS_Wind_1.1/DSWind.py (a non-real-time Python
// prototype); constants below are labeled sourced-from-the-Python vs.
// informed-approximation-for-real-time where they differ.

// Sourced directly from DSWind.py's generate() -- same values, same roles.
export const OCTAVE_WEIGHTS = [0.6, 0.25, 0.15]; // == noiseControlProcessor.js's own DEFAULT_OCTAVE_WEIGHTS, coincidentally
export const CF_BASE_HZ = 180;
export const CF_STRENGTH_SCALE = 440;
export const CF_DEVIATION_OCTAVE_SCALE = 0.75;
export const GAIN_FLOOR = 0.1;
export const GAIN_DEVIATION_SCALE = 0.9;
export const Q_SCALE = 40;
export const Q_FLOOR = 0.5;
export const MOTION_FREQ_SCALE = 3; // Hz per unit gustiness

// DSWind.py hardcodes these (lpcutoff=400, locutofforder=5) despite
// misleading self.getParam(...) comments suggesting they were meant to be
// exposed -- never actually wired up there, so not exposed as Parameters
// here either; matches the Python's *actual* behavior.
export const LOWPASS_CUTOFF_HZ = 400;
// Informed approximation, not a sourced/exact port: DSWind.py's lowpass is
// an order-5 Butterworth (~30dB/octave, flat passband, sharp knee) applied
// via scipy's offline filtfilt-style call. windProcessor.js instead uses a
// cascade of identical one-pole sections (~6dB/octave per stage), which
// has a different passband/knee shape even at a stage count chosen for
// similar overall rolloff steepness. 4 stages -> ~24dB/octave, close in
// spirit, not an exact match. Adjustable if it sounds audibly too
// soft/harsh compared to the original.
export const LOWPASS_STAGES = 4;

// NOT from the Python -- it has no equivalent. DSWind.py's per-render
// global peak-normalization (y/max(abs(y))) can't port to a continuous
// real-time stream (no way to know a never-ending signal's peak in
// advance). It was also doing two DIFFERENT jobs at once, both handled
// separately below instead:
//
// 1. Q-compensation: scales the resonator's own gain by
//    Q^-qCompensationExponent. An initial analytical guess (RMS ~ sqrt(Q)
//    for a 2-pole resonator driven by broadband noise, i.e. exponent=0.5)
//    was WRONG for this resonator's actual measured behavior -- checked
//    empirically (not assumed) by rendering uncompensated across
//    howliness=[0..1] (Q from 0.5 to 40.5) at fixed strength=0.5/
//    deviation=0.3/gustiness=0.3: RMS went 1.83 -> 3.61, a ~1.97x swing
//    across an 81x Q range, not the ~9x sqrt(81) predicted. The exponent
//    actually needed to flatten that specific measured swing is
//    ln(3.61/1.83)/ln(81) ~= 0.154, used below.
export const Q_COMPENSATION_EXPONENT = 0.154;

// 2. Lowpass-position compensation: a resonator's actual output level also
//    depends on WHERE its center frequency sits relative to the fixed
//    400Hz-lowpassed noise spectrum's energy (a resonator near 180Hz, deep
//    in the noise's passband, extracts far more energy than one near
//    620Hz, close to/above the lowpass cutoff) -- i.e. loudness varies
//    with `strength`/`deviation` too, not just `howliness`/Q. Unlike a
//    true spectrum-aware adaptive normalizer (out of scope -- the noise
//    source itself is never analyzed), this IS fully derivable without
//    guessing: CascadedLowpass is a fixed, known filter, so its exact
//    magnitude response at any frequency can be computed analytically
//    (windProcessor.js's lowpassMagnitudeAt()) and inverted. Measured
//    impact: across the full strength x deviation x gustiness x howliness
//    grid (corners + midpoints), the worst-case/quietest-case RMS ratio
//    was 327x with Q-compensation alone; adding this at full inversion
//    (exponent=1) brought it to 52x -- a real, substantial improvement,
//    not a complete fix (a residual of that size is the accepted
//    "reasonable estimate" limitation, matching the user's own tolerance
//    for the original's normalization being itself "a bit of a hack").
//    The floor keeps the inversion bounded as cf approaches/exceeds the
//    lowpass cutoff, where the true magnitude response approaches zero and
//    a naive inversion would blow up.
export const LOWPASS_COMPENSATION_EXPONENT = 1.0;
export const LOWPASS_COMPENSATION_FLOOR = 1e-3;

// Set from rendering the full strength x deviation x gustiness x
// howliness parameter grid (corners + midpoints) with both compensations
// above, at outputGain=1: worst-case RMS was 202.7 (strength=0,
// deviation=1, gustiness=0.5, howliness=1). Crest factor (peak/RMS) was
// measured empirically at ~4.3-4.5 and essentially CONSTANT across every
// tested parameter combination -- expected, since a high-Q resonator
// driven by broadband noise behaves like a narrowband Gaussian process
// whose peak-to-RMS ratio depends on its statistics, not on gain scaling.
// Because peak is a property of a stochastic process that (mathematically)
// has no finite upper bound over unbounded listening time, outputGain
// cannot be chosen to guarantee literal zero clipping forever -- that is
// exactly what OutputConditioner's own hard clamp exists for. outputGain
// is instead sized so the worst-case corner's TYPICAL peaks sit at ~75% of
// the clamp (crest margin 6x, above the measured ~4.5x, for headroom):
// 4.0 / (202.7 * 6) ~= 0.0033.
export const OUTPUT_GAIN = 0.0033;

// Reasonable starting points, not derived from the Python (which gives
// formulas, not example parameter values) -- adjustable by ear.
export const STRENGTH_DEFAULT = 0.5;
export const DEVIATION_DEFAULT = 0.3;
export const GUSTINESS_DEFAULT = 0.3;
export const HOWLINESS_DEFAULT = 0.3;

export const WIND_CONFIG = {
    octaveWeights: OCTAVE_WEIGHTS,
    lowpassCutoffHz: LOWPASS_CUTOFF_HZ,
    lowpassStages: LOWPASS_STAGES,
    cfBaseHz: CF_BASE_HZ,
    cfStrengthScale: CF_STRENGTH_SCALE,
    cfDeviationOctaveScale: CF_DEVIATION_OCTAVE_SCALE,
    gainFloor: GAIN_FLOOR,
    gainDeviationScale: GAIN_DEVIATION_SCALE,
    qScale: Q_SCALE,
    qFloor: Q_FLOOR,
    qCompensationExponent: Q_COMPENSATION_EXPONENT,
    lowpassCompensationExponent: LOWPASS_COMPENSATION_EXPONENT,
    lowpassCompensationFloor: LOWPASS_COMPENSATION_FLOOR,
    motionFreqScale: MOTION_FREQ_SCALE,
    outputGain: OUTPUT_GAIN,
    strengthDefault: STRENGTH_DEFAULT,
    deviationDefault: DEVIATION_DEFAULT,
    gustinessDefault: GUSTINESS_DEFAULT,
    howlinessDefault: HOWLINESS_DEFAULT
};

export default WIND_CONFIG;
