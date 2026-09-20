// Plain data, no AudioWorkletProcessor dependency -- importable by both
// bambooChimeProcessor.js (browser) and Node-side tests, same pattern as
// maracaConfig.js.
//
// Sourced from Perry Cook/Gary Scavone's STK (github.com/thestk/stk,
// include/Shakers.h / src/Shakers.cpp), instrument type 22, "Tuned Bamboo
// Chimes" -- STK's own internal constant names are literally ANGKLUNG_* for
// this type. This is the per-collision single-tube-selection variant, not
// STK's plain type-5 "Bamboo Chimes" (which shares one excitation across 3
// fixed resonances, the same architectural family as Maraca/Cabasa) --
// see docs/MODEL_PATTERNS.md archetype 5.1 for why type 22 was chosen.

import { decaySecondsFromCoefficient } from '../utilities/decayMath.js';

// ANGKLUNG_FREQUENCIES -- 7 resonances at real musical pitches (~C6 D6 F6
// G6 A6 C7 D7).
export const BAMBOO_TUBE_FREQUENCIES = [1046.6, 1174.8, 1397.0, 1568, 1760, 2093.3, 2350];
export const NUMBER_OF_TUBES = BAMBOO_TUBE_FREQUENCIES.length;

// ANGKLUNG_SYSTEM_DECAY coefficient 0.9999 @44.1kHz -> ~0.2267s (10-30x
// longer than Maraca's ~0.0227s / Cabasa's ~0.00755s -- real tubes ring far
// longer than a shaken gourd). Retuned to 0.9s by ear (longer than the
// STK-sourced figure) -- an informed listening choice, not a sourced value;
// decaySecondsFromCoefficient(0.9999, 44100) is kept here as the original
// citation, not as the actual default anymore.
export const SYSTEM_DECAY_DEFAULT = 0.9;

// ANGKLUNG_RADII 0.996 (all 7 tubes share one radius in STK) @44.1kHz
// -> ~0.00566s decay, bandwidth ~56Hz, Q@1397Hz ~= 25 -- a real singing
// tube resonance.
export const TUBE_MODE_DECAY_SECONDS = decaySecondsFromCoefficient(0.996, 44100);

// ANGKLUNG_SOUND_DECAY coefficient 0.95 @44.1kHz -> ~0.000442s (same
// coefficient Maraca's own per-event decay uses, coincidentally).
export const COLLISION_DECAY_SECONDS = decaySecondsFromCoefficient(0.95, 44100);

// ANGKLUNG_NUM_TUBES 1.2 -- NOT a literal tube count (that's the fixed 7
// above); like Maraca/Cabasa's numberOfObjects, this feeds our own
// rate*energy*N collision-probability law as a scalar. STK's own value,
// reused directly as a starting point -- our law isn't the same law STK
// uses, same caveat as Cabasa's numberOfObjects (see docs/MODEL_PATTERNS.md).
export const COLLISION_DENSITY_DEFAULT = 1.2;

// Not sourced from STK -- no STK equivalent to source a rate-scale
// constant from. Retuned to 15 by ear (was Maraca's own default, 8).
export const COLLISION_RATE_SCALE_DEFAULT = 15;
export const COLLISION_AMPLITUDE_SCALE = 1.0;
export const ENERGY_MAX = 4;
export const DRIVE_SCALE = 8;
export const STRIKE_IMPULSE_SCALE = 1.5;
export const MODE_GAIN = 1.0;
export const OUTPUT_GAIN = 0.2; // starting point, matches Maraca/Cabasa; needs a listening pass, not sourced

// STK also defines decayScale_ = 0.7 for this instrument; its exact effect
// wasn't recoverable from the source excerpts available during research,
// so it is NOT mapped here -- SYSTEM_DECAY_DEFAULT above already gives
// direct, sourced control over the same overall energy-decay-rate role.

export const BAMBOO_CHIME_CONFIG = {
    tubeFrequencies: BAMBOO_TUBE_FREQUENCIES,
    numberOfTubes: NUMBER_OF_TUBES,
    systemDecayDefault: SYSTEM_DECAY_DEFAULT,
    tubeModeDecaySeconds: TUBE_MODE_DECAY_SECONDS,
    collisionDecaySeconds: COLLISION_DECAY_SECONDS,
    collisionDensityDefault: COLLISION_DENSITY_DEFAULT,
    collisionRateScaleDefault: COLLISION_RATE_SCALE_DEFAULT,
    collisionAmplitudeScale: COLLISION_AMPLITUDE_SCALE,
    energyMax: ENERGY_MAX,
    driveScale: DRIVE_SCALE,
    strikeImpulseScale: STRIKE_IMPULSE_SCALE,
    modeGain: MODE_GAIN,
    outputGain: OUTPUT_GAIN
};

export default BAMBOO_CHIME_CONFIG;
