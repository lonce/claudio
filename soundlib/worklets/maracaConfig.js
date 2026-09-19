// Plain data, no AudioWorkletProcessor dependency -- importable by both
// maracaProcessor.js (browser) and Node-side tests. All values below are
// provisional placeholders transcribed from
// fromChat/energy/Claudio-PhISEM-Architecture-and-Maraca-First-Pass.md's
// own illustrative config (explicitly marked there as "not approved
// constants"), not verified Cook/STK figures -- see
// docs/MODEL_PATTERNS.md's sourced-fact-vs-informed-construction
// distinction for physically-informed models. Expect these to move during
// listening-based refinement.
export const MARACA_CONFIG = {
    energyMax: 4,
    driveScale: 8,           // energy/sec added at shakeEnergy=1
    shakeImpulseScale: 1.5,  // energy added per shake(amount=1)
    collisionRateScale: 8,   // collisions/sec at energy=1, numberOfObjects=1
    collisionAmplitudeScale: 1.0,
    collisionDecaySeconds: 0.004, // noise-burst exciter decay ("hardness" of each micro-collision)
    modeDecaySeconds: 0.02,       // resonator mode 0 decay
    modeGain: 1.0,
    outputGain: 0.2
};

export default MARACA_CONFIG;
