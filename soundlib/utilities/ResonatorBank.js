// Plain, framework-agnostic fixed-capacity bank of two-pole resonant
// filters (structure-of-arrays, per fromChat/energy/Claudio-PhISEM-
// Architecture-and-Maraca-First-Pass.md section 5.5) for the PhISEM family.
// Each mode is a standard resonant IIR:
//
//   y[n] = a1*y[n-1] + a2*y[n-2] + gain*x[n]
//
// with a1 = 2*r*cos(theta), a2 = -r*r, derived from a frequency (Hz) and a
// decay time (seconds), using the same exp(-1/(decaySeconds*sampleRate))
// convention as EnergyAccumulator/NoiseBurstExciter.
//
// Frequencies are clamped well below Nyquist (45% of sampleRate) before
// computing theta -- at or above Nyquist the mode folds back audibly and
// cos(theta) stops meaning what the coefficient math assumes.

const NYQUIST_SAFETY_FRACTION = 0.45;

export class ResonatorBank {
    constructor(sampleRate, maxModes) {
        this.sampleRate = sampleRate;
        this.maxModes = maxModes;
        this.activeModes = 0;
        this.a1 = new Float64Array(maxModes);
        this.a2 = new Float64Array(maxModes);
        this.gain = new Float64Array(maxModes);
        this.y1 = new Float64Array(maxModes);
        this.y2 = new Float64Array(maxModes);
    }

    // Configures mode `index` (0 <= index < maxModes). Recomputes
    // coefficients only -- does not reset filter state, so retuning a
    // live mode doesn't click.
    setMode(index, frequencyHz, decaySeconds, gain) {
        if (index < 0 || index >= this.maxModes) return;
        const safeFrequency = Math.max(
            1,
            Math.min(frequencyHz, this.sampleRate * NYQUIST_SAFETY_FRACTION)
        );
        const theta = 2 * Math.PI * safeFrequency / this.sampleRate;
        const radius = Math.exp(-1 / (Math.max(1e-5, decaySeconds) * this.sampleRate));
        this.a1[index] = 2 * radius * Math.cos(theta);
        this.a2[index] = -radius * radius;
        this.gain[index] = gain;
        this.activeModes = Math.max(this.activeModes, index + 1);
    }

    reset() {
        this.y1.fill(0);
        this.y2.fill(0);
    }

    tick(excitation) {
        let sum = 0;
        for (let i = 0; i < this.activeModes; i++) {
            const y0 = this.a1[i] * this.y1[i] + this.a2[i] * this.y2[i] + this.gain[i] * excitation;
            const safeY0 = Number.isFinite(y0) ? y0 : 0;
            this.y2[i] = this.y1[i];
            this.y1[i] = safeY0;
            sum += safeY0;
        }
        return sum;
    }
}

export default ResonatorBank;
