// soundlib/utilities/decayMath.js
//
// Shared conversions between the different ways a PhISEM-family model's
// decay/damping can be specified: a reference per-sample coefficient
// (as STK/Cook papers usually quote them, at a stated sample rate), the
// sample-rate-independent decaySeconds time constant this codebase's
// EnergyAccumulator / NoiseBurstExciter / ResonatorBank all consume, T60,
// and (for two-pole resonators only) bandwidth and Q.
//
// Why this file exists: every decaySeconds constant in a PhISEM model
// that cites a reference coefficient must be COMPUTED from that
// coefficient via decaySecondsFromCoefficient(), not hand-transcribed
// from an architecture doc's illustrative placeholder. See
// docs/MODEL_PATTERNS.md, "Decay constants must be derived, not
// transcribed." Importing and calling these functions (as maracaConfig.js
// does) makes that derivation auditable and keeps the source coefficient,
// its sample rate, and the resulting time constant next to each other
// instead of silently drifting apart.

/**
 * Convert a reference per-sample decay coefficient (e.g. as quoted in an
 * STK/Cook implementation at a specific sample rate) into the
 * sample-rate-independent decaySeconds time constant (tau, the 1/e decay
 * time) used throughout this codebase.
 *
 * @param {number} coefficient - per-sample multiplier, 0 < coefficient < 1,
 *   as quoted at referenceSampleRate.
 * @param {number} referenceSampleRate - the sample rate (Hz) the
 *   coefficient was quoted/measured at. STK figures are commonly quoted
 *   at 44100.
 * @returns {number} decaySeconds (tau, in seconds).
 */
export function decaySecondsFromCoefficient(coefficient, referenceSampleRate) {
    if (!(coefficient > 0 && coefficient < 1)) {
        throw new RangeError(
            `decaySecondsFromCoefficient: coefficient must be in (0, 1), got ${coefficient}`
        );
    }
    if (!(referenceSampleRate > 0)) {
        throw new RangeError(
            `decaySecondsFromCoefficient: referenceSampleRate must be > 0, got ${referenceSampleRate}`
        );
    }
    return -1 / (referenceSampleRate * Math.log(coefficient));
}

/**
 * Convert decaySeconds back into a per-sample decay coefficient at a given
 * (possibly different) sample rate. Inverse of decaySecondsFromCoefficient
 * when sampleRate === referenceSampleRate; also what
 * EnergyAccumulator / NoiseBurstExciter / ResonatorBank compute internally
 * each time the sample rate changes.
 *
 * @param {number} decaySeconds - tau, in seconds.
 * @param {number} sampleRate - target sample rate in Hz.
 * @returns {number} per-sample multiplier.
 */
export function perSampleCoefficient(decaySeconds, sampleRate) {
    return Math.exp(-1 / (decaySeconds * sampleRate));
}

/**
 * T60: time in seconds for the envelope to fall by 60dB (amplitude to
 * 1/1000), given the 1/e time constant decaySeconds.
 *
 * @param {number} decaySeconds - tau, in seconds.
 * @returns {number} T60 in seconds.
 */
export function t60(decaySeconds) {
    return decaySeconds * Math.log(1000);
}

/**
 * Inverse of t60(): recover decaySeconds (tau) from a desired T60.
 * Useful when a reference source states "decays to silence in Xms"
 * rather than giving a per-sample coefficient.
 *
 * @param {number} t60Seconds - desired T60, in seconds.
 * @returns {number} decaySeconds (tau, in seconds).
 */
export function decaySecondsFromT60(t60Seconds) {
    return t60Seconds / Math.log(1000);
}

/**
 * -3dB bandwidth of a two-pole resonator mode with the given decaySeconds.
 * Sample-rate-independent by construction (same derivation used in
 * ResonatorBank). Only meaningful for a two-pole resonant mode, not for
 * the single-pole EnergyAccumulator/NoiseBurstExciter decays.
 *
 * @param {number} decaySeconds - tau, in seconds.
 * @returns {number} bandwidth in Hz.
 */
export function bandwidthFromDecay(decaySeconds) {
    return 1 / (Math.PI * decaySeconds);
}

/**
 * Q of a two-pole resonator mode at center frequency f0Hz with the given
 * decaySeconds. Only meaningful for a two-pole resonant mode.
 *
 * @param {number} f0Hz - mode center frequency, in Hz.
 * @param {number} decaySeconds - tau, in seconds.
 * @returns {number} Q (dimensionless).
 */
export function qFromDecay(f0Hz, decaySeconds) {
    return Math.PI * f0Hz * decaySeconds;
}

/**
 * Inverse of qFromDecay(): recover decaySeconds (tau) from a desired Q at
 * a given center frequency. Useful when a reference source states a
 * target Q rather than a coefficient or T60.
 *
 * @param {number} f0Hz - mode center frequency, in Hz.
 * @param {number} q - desired Q (dimensionless).
 * @returns {number} decaySeconds (tau, in seconds).
 */
export function decaySecondsFromQ(f0Hz, q) {
    return q / (Math.PI * f0Hz);
}

/**
 * Closed-form steady-state magnitude gain, at its own resonant frequency,
 * of a ResonatorBank-style two-pole mode (y[n] = a1*y[n-1] + a2*y[n-2] +
 * gain*x[n], a1=2r*cos(theta), a2=-r^2) driven CONTINUOUSLY (not
 * impulsively) by a sustained sinusoid at f0Hz, with gain=1.
 *
 * This is a DIFFERENT quantity from Q/decaySeconds/T60 above (those are
 * sample-rate-independent physical/acoustic quantities) -- it's the
 * discrete filter's own continuous-drive steady-state response, which
 * genuinely depends on sampleRate (found empirically: NOT sample-rate
 * invariant even when decaySeconds/Q are held fixed -- confirmed ~15%
 * different between 44100 and 48000 for the same decaySeconds/frequency).
 * Needed because even a modest, genuinely-low Q (e.g. Q=4) gives an
 * enormous continuous-drive steady-state gain for a near-unity-pole
 * discrete resonator -- measured in the hundreds to thousands, NOT
 * obvious from Q alone, and easy to miss if only impulse response is
 * checked (an impulse's total injected energy is tiny compared to a
 * sustained drive's). A caller that continuously excites a ResonatorBank
 * mode (as opposed to a one-shot strike -- see
 * soundlib/utilities/BodyModeBank.js) should divide its intended gain by
 * this value before calling ResonatorBank.setMode(), so the mode's own
 * steady-state response at resonance stays near the intended target
 * rather than scaling unpredictably with Q and sample rate.
 *
 * Derivation: evaluate the mode's own transfer function
 * H(z) = gain / (1 - a1*z^-1 - a2*z^-2) at z = e^(j*theta) and return
 * 1/|H| for gain=1.
 *
 * @param {number} f0Hz - mode center frequency, in Hz.
 * @param {number} decaySeconds - tau, in seconds.
 * @param {number} sampleRate - the ACTUAL runtime sample rate.
 * @returns {number} steady-state output/input magnitude ratio at f0Hz, for gain=1.
 */
export function discreteResonatorGainAtCenter(f0Hz, decaySeconds, sampleRate) {
    const theta = (2 * Math.PI * f0Hz) / sampleRate;
    const r = Math.exp(-1 / (decaySeconds * sampleRate));
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const real = (1 - r) * (1 + r - 2 * r * c * c);
    const imag = 2 * r * c * s * (1 - r);
    return 1 / Math.sqrt(real * real + imag * imag);
}
