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
        this.excitation = new Float64Array(maxModes);
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
        this.excitation.fill(0);
    }

    // Adds to mode `index`'s pending excitation for the sample about to be
    // ticked -- lets a caller target one mode (or several, or none) per
    // sample instead of driving every active mode with the same shared
    // signal. Additive (not overwriting) so more than one excite() call
    // before the next tick() sums, matching how simultaneous excitations
    // would naturally combine.
    excite(index, amount) {
        if (index < 0 || index >= this.maxModes) return;
        this.excitation[index] += amount;
    }

    // Advances every active mode by one sample using whatever excitation
    // has accumulated for it since the last tick() (via excite()), then
    // clears it. A mode that received no excite() this sample still
    // advances on its own prior state -- this is what lets modes ring down
    // independently across later collisions that target other modes.
    tick() {
        let sum = 0;
        for (let i = 0; i < this.activeModes; i++) {
            const y0 = this.a1[i] * this.y1[i] + this.a2[i] * this.y2[i] + this.gain[i] * this.excitation[i];
            const safeY0 = Number.isFinite(y0) ? y0 : 0;
            this.y2[i] = this.y1[i];
            this.y1[i] = safeY0;
            sum += safeY0;
        }
        this.excitation.fill(0);
        return sum;
    }
}

export default ResonatorBank;
