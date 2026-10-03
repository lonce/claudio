// Plain data, no worklet dependency -- same shape as wg3Config.js's own
// precedent and maracaConfig.js's own placement logic (model-local config
// for a DSP mechanism -- BodyModeBank.js -- that itself lives in
// soundlib/utilities/ and is reusable outside this particular string
// model).
//
// Phase C.5.2: a registry of NAMED body presets, not a single fixed body
// -- the point of this phase is proving the same exciter/string/
// termination/coupling can acquire a distinctly different identity when
// only the body configuration changes. BodyModeBank.js itself stays an
// unchanged, generic shared-excitation mode bank -- it has no notion of
// "wood," "metal," "large," or "small." Those character labels live only
// here, as plain data/metadata, never hardcoded into the DSP mechanism.
//
// Each preset: { name, modes: [{ frequencyHz, q, decaySeconds,
// relativeGain }], metadata }. `q` is stored explicitly (not just
// decaySeconds) because Q = pi*f0*decaySeconds -- scaling a preset's
// frequencies while holding decaySeconds fixed would silently change Q;
// storing q lets scalePreset() re-derive decaySeconds correctly at each
// new frequency for the SAME q.
//
// decaySeconds are DERIVED from q via decayMath.js's
// decaySecondsFromQ(f0Hz, q), never hand-picked -- see the C.5.1 finding
// (git history / causal-claims.yaml) that picking decaySeconds directly
// without checking the resulting Q produced an unintentionally high-Q,
// ringing body instead of the intended thuddy one.
//
// relativeGain is the INTENDED balance between modes only -- NOT the
// value ResonatorBank.setMode() actually receives. Compensation for a
// continuously-driven near-unity-pole resonator's enormous, Q- and
// sample-rate-dependent steady-state gain at resonance is a MECHANISM
// concern, computed live at the actual runtime sample rate by
// BodyModeBank's own constructor (see decayMath.js's
// discreteResonatorGainAtCenter) -- kept out of this static config
// entirely, per this project's established "config data vs. coupling
// mechanism" separation.

import { decaySecondsFromQ } from '../../utilities/decayMath.js';

function buildModes(frequencies, q, relativeGains) {
    return frequencies.map((frequencyHz, i) => ({
        frequencyHz,
        q,
        decaySeconds: decaySecondsFromQ(frequencyHz, q),
        relativeGain: relativeGains[i]
    }));
}

// Scales every mode's frequencyHz by `factor`, preserving modal-frequency
// RATIOS exactly (every frequency scales together) and re-deriving
// decaySeconds from the SAME q at each new frequency (preserving the Q
// convention, not the absolute decaySeconds value). relativeGain is left
// untouched -- this is a pure frequency-scale operation, nothing else.
function scalePreset(basePreset, factor, name, character) {
    return {
        name,
        modes: basePreset.modes.map((mode) => ({
            frequencyHz: mode.frequencyHz * factor,
            q: mode.q,
            decaySeconds: decaySecondsFromQ(mode.frequencyHz * factor, mode.q),
            relativeGain: mode.relativeGain
        })),
        metadata: {
            frequencyScale: factor,
            character: `SIZE HYPOTHESIS (untested): ${character}`
        }
    };
}

// Comparison A (C.5.2): same frequencies/relativeGains/mode count as
// sparseHighQ below -- Q is the ONLY variable that differs between them,
// isolating modal persistence from modal distribution per the directive.
const FREQUENCIES_HZ = [185, 340, 505, 710];
const RELATIVE_GAINS = [1.0, 0.8, 0.65, 0.5];

const sparseLowQ = {
    name: 'sparseLowQ',
    modes: buildModes(FREQUENCIES_HZ, 4, RELATIVE_GAINS),
    metadata: {
        character: 'thud-like, fast-damped (the C.5.1 default) -- Q=4'
    }
};

const sparseHighQ = {
    name: 'sparseHighQ',
    modes: buildModes(FREQUENCIES_HZ, 50, RELATIVE_GAINS),
    metadata: {
        character: 'ringing, ~12.5x longer-lived than sparseLowQ at each ' +
            'mode (Q=50 vs Q=4) -- perceptual labels like "metallic" are ' +
            'NOT asserted here, only recorded as explicit, untested ' +
            'perceptual hypotheses in causal-claims.yaml'
    }
};

// Comparison B (C.5.2, optional per the directive -- included): a global
// modal-frequency scale, testing (not assuming) the hypothesis that a
// lower scale reads as a larger/darker body and a higher scale as a
// smaller/brighter one. Built from sparseLowQ specifically, holding Q
// (and therefore "character") fixed so size is the only isolated
// variable.
const sparseLowQLarge = scalePreset(sparseLowQ, 0.5, 'sparseLowQLarge', 'lower modal scale -> larger/darker');
const sparseLowQSmall = scalePreset(sparseLowQ, 2.0, 'sparseLowQSmall', 'higher modal scale -> smaller/brighter');

export const BODY_PRESETS = {
    sparseLowQ,
    sparseHighQ,
    sparseLowQLarge,
    sparseLowQSmall
};

export const BODY_PRESET_DEFAULT = 'sparseLowQ';

export default BODY_PRESETS;
