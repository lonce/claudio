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
export const DECAY_TIME_MAX_SECONDS = 30;
export const DECAY_TIME_DEFAULT_SECONDS = 2.5;

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
    outputGain: OUTPUT_GAIN
};

export default WG2_CONFIG;
