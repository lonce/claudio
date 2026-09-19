// Plain, framework-agnostic noise-burst exciter for the PhISEM family.
// Collisions add to one shared decaying "sound level" rather than spawning
// a separate voice each -- the core efficiency point from
// fromChat/energy/Claudio-PhISEM-Architecture-and-Maraca-First-Pass.md
// section 5.4: many overlapping collisions share one decay law instead of
// needing one voice per collision.

export class NoiseBurstExciter {
    constructor(sampleRate, options = {}) {
        this.sampleRate = sampleRate;
        this.random = options.random; // shared SeededRandom instance
        this.decayPerSample = 1;
        this.soundLevel = 0;
    }

    setDecaySeconds(decaySeconds) {
        const clamped = Math.max(1e-5, decaySeconds);
        this.decayPerSample = Math.exp(-1 / (clamped * this.sampleRate));
    }

    reset() {
        this.soundLevel = 0;
    }

    // collisionAmplitude: this sample's StochasticCollisionGenerator output
    // (0 if no collision this sample).
    tick(collisionAmplitude) {
        this.soundLevel += collisionAmplitude;
        this.soundLevel *= this.decayPerSample;
        if (!Number.isFinite(this.soundLevel)) this.soundLevel = 0;
        return this.soundLevel * this.random.bipolar();
    }
}

export default NoiseBurstExciter;
