// Plain data, no AudioWorkletProcessor dependency -- importable by both
// maracaProcessor.js (browser) and Node-side tests.
//
// collisionDecaySeconds and modeDecaySeconds below are DERIVED constants,
// not placeholders: each is computed from a cited STK/Cook per-sample
// coefficient via soundlib/utilities/decayMath.js's
// decaySecondsFromCoefficient(). See docs/MODEL_PATTERNS.md, "Decay
// constants must be derived, not transcribed," for the rule this follows
// and why it exists (superseded an earlier placeholder set that produced
// an unintentionally metallic, over-resonant maraca).
//
// systemDecay is NOT listed here -- it's a live Parameter (see
// Maraca.js / maracaProcessor.js), not a fixed config constant, and its
// default/range were deliberately left unchanged pending a judgment call
// on how directly a single-strike STK coefficient should map onto a
// continuously-excited shake envelope. See MODEL_PATTERNS.md note.

import { decaySecondsFromCoefficient } from '../utilities/decayMath.js';

// --- Derivations (shown explicitly so the source is auditable) ---
// Collision/noise-burst exciter: STK per-sample coeff 0.95 @44.1kHz
//   -> decaySeconds ~= 0.000442s, T60 ~= 3.05ms
const COLLISION_DECAY_SECONDS = decaySecondsFromCoefficient(0.95, 44100);

// Body-resonator mode 0: STK per-sample coeff 0.96 @44.1kHz
//   -> decaySeconds ~= 0.000555s, T60 ~= 3.84ms, Q@3200Hz ~= 5.6
//   (previous placeholder of 0.02s implied Q~=201 -- a bell/tuning-fork
//   ring, not a damped gourd knock; this was the source of the
//   "metallic" character reported in Sept 2026 listening review)
const MODE_DECAY_SECONDS = decaySecondsFromCoefficient(0.96, 44100);

export const MARACA_CONFIG = {
    energyMax: 4,
    driveScale: 8,           // energy/sec added at shakeEnergy=1
    shakeImpulseScale: 1.5,  // energy added per shake(amount=1)
    collisionRateScale: 8,   // collisions/sec at energy=1, numberOfObjects=1
    collisionAmplitudeScale: 1.0,
    collisionDecaySeconds: COLLISION_DECAY_SECONDS, // noise-burst exciter decay ("hardness" of each micro-collision)
    modeDecaySeconds: MODE_DECAY_SECONDS,            // resonator mode 0 decay
    modeGain: 1.0,
    outputGain: 0.2
};

export default MARACA_CONFIG;
