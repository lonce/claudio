// Plain, framework-agnostic mechanical-energy accumulator for the PhISEM
// family (soundlib/worklets/maracaProcessor.js and future relatives).
//
//   E[n+1] = min(maxEnergy, decayPerSample * E[n] + driveContribution + impulse)
//
// decayPerSample is derived from a decay TIME in seconds via
// exp(-1 / (decaySeconds * sampleRate)) -- the exact per-sample coefficient
// for continuous exponential decay at any sample rate, not an approximation
// that only holds near one particular rate. Continuous drive is likewise
// divided by sampleRate so the total energy added per second of held drive
// is the same regardless of sample rate.

const DEFAULT_MAX_ENERGY = 4;

export class EnergyAccumulator {
    constructor(sampleRate, options = {}) {
        this.sampleRate = sampleRate;
        this.maxEnergy = options.maxEnergy ?? DEFAULT_MAX_ENERGY;
        this.driveScale = options.driveScale ?? 1; // energy/second at driveLevel=1
        this.decayPerSample = 1;
        this.energy = 0;
        this.pendingImpulse = 0;
    }

    // decaySeconds: time for stored energy to decay by 1/e with no drive.
    setDecaySeconds(decaySeconds) {
        const clamped = Math.max(1e-4, decaySeconds);
        this.decayPerSample = Math.exp(-1 / (clamped * this.sampleRate));
    }

    // Discrete injection (shake()) -- queued, applied on the next tick(), so
    // it lands on a real sample boundary inside process() rather than
    // between blocks.
    injectImpulse(amount) {
        this.pendingImpulse += Math.max(0, amount);
    }

    reset() {
        this.energy = 0;
        this.pendingImpulse = 0;
    }

    // driveLevel: the current continuous drive (e.g. shakeEnergy), 0-1.
    tick(driveLevel) {
        const driveContribution = driveLevel * this.driveScale / this.sampleRate;
        const next = this.decayPerSample * this.energy + driveContribution + this.pendingImpulse;
        this.pendingImpulse = 0;
        this.energy = Number.isFinite(next)
            ? Math.min(this.maxEnergy, Math.max(0, next))
            : 0;
        return this.energy;
    }
}

export default EnergyAccumulator;
