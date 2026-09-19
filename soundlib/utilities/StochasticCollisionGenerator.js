// Plain, framework-agnostic per-sample stochastic collision decision for
// the PhISEM family. Approximates a Poisson process: each sample, draws a
// collision with probability (expected rate in collisions/sec) * dt, and
// dt = 1/sampleRate, so the expected density stays sample-rate independent.
//
// Deliberately isolated (per fromChat/energy/Claudio-PhISEM-Architecture-
// and-Maraca-First-Pass.md section 5.3: "isolate the probability
// calculation so it can later be replaced or generalized") -- whether rate
// should scale with N, sqrt(N), or a saturating function, and exactly how
// energy should split between rate and per-event strength, are Phase E
// perceptual-tuning questions, not settled here. The linear rate * energy *
// numberOfObjects model and the placeholder rateScale/amplitudeScale below
// are a starting point only.

export class StochasticCollisionGenerator {
    constructor(sampleRate, options = {}) {
        this.sampleRate = sampleRate;
        this.rateScale = options.rateScale ?? 8; // collisions/sec at energy=1, numberOfObjects=1
        this.amplitudeScale = options.amplitudeScale ?? 1;
        this.random = options.random; // shared SeededRandom instance
    }

    setRateScale(rateScale) {
        this.rateScale = rateScale;
    }

    // Returns this sample's collision amplitude (0 if no collision this
    // sample). Per-collision amplitude is normalized by
    // 1/sqrt(numberOfObjects) -- same principle as BellStrike.js's noise-
    // bank normalization (docs/MODEL_PATTERNS.md archetype 2): more
    // roughly-independent micro-events should raise density, not loudness.
    tick(energy, numberOfObjects) {
        const rate = this.rateScale * energy * numberOfObjects;
        const probability = Math.min(1, rate / this.sampleRate);
        if (this.random.unipolar() >= probability) return 0;
        return this.amplitudeScale * energy / Math.sqrt(Math.max(1, numberOfObjects));
    }
}

export default StochasticCollisionGenerator;
