// Plain data, no worklet dependency -- same shape as windConfig.js/
// maracaConfig.js. Phase A only (see scratch/WaveguideResonator-v1-
// Specification-and-Reasoning-Model.md and docs/MODEL_PATTERNS.md's
// digital-waveguide archetype): frequency/energy/decayTime plus a fixed,
// non-user-facing termination -- excitation/pickup position, dispersion,
// bridge filtering, and polarization are later phases.

// Physical: the spec's own essential-controls table (section 6).
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
export const EXCITATION_TYPE_CHOICES = ['noise', 'impulse'];

// Physically informed: two rigid string ends cancel over one full round
// trip ((-1)*(-1) = +1) -- see RigidTermination.js's own comment. Not
// exposed as a user-facing Parameter in Phase A; BridgeTermination
// (Phase C) is what exposes a tunable reflection control.
export const TERMINATION_REFLECTION = 1.0;

// Set empirically from soundlib/utilities/test/wg1Pipeline.test.js's
// full parameter-grid sweep -- see that file's own comment for the
// measured worst-case peak this was derived from, matching the gain-
// staging discipline used for Wind/ChimeVocoder/BambooChimes.
export const OUTPUT_GAIN = 1;

export const WG1_CONFIG = {
    frequencyMinHz: FREQUENCY_MIN_HZ,
    frequencyMaxHz: FREQUENCY_MAX_HZ,
    frequencyDefaultHz: FREQUENCY_DEFAULT_HZ,
    energyDefault: ENERGY_DEFAULT,
    decayTimeMinSeconds: DECAY_TIME_MIN_SECONDS,
    decayTimeMaxSeconds: DECAY_TIME_MAX_SECONDS,
    decayTimeDefaultSeconds: DECAY_TIME_DEFAULT_SECONDS,
    excitationTypeDefault: EXCITATION_TYPE_DEFAULT,
    excitationTypeChoices: EXCITATION_TYPE_CHOICES,
    terminationReflection: TERMINATION_REFLECTION,
    outputGain: OUTPUT_GAIN
};

export default WG1_CONFIG;
