// Plain, framework-agnostic final output-stage conditioning for the
// PhISEM family: DC blocking (a standard one-pole DC blocker), fixed
// output scaling, and a defensive finite-value/clamp backstop. Applied
// once per sample, after the resonator bank.
//
// Per fromChat/energy/Claudio-PhISEM-Architecture-and-Maraca-First-Pass.md
// section 5.6: this conditions an already-well-behaved signal, it does not
// mask an unstable or poorly scaled synthesis path with heavy dynamics
// processing.

const DC_BLOCK_R = 0.995;
const OUTPUT_CLAMP = 4; // generous headroom above the expected +/-1 range; catches genuine runaway, not normal peaks

export class OutputConditioner {
    constructor(options = {}) {
        this.outputGain = options.outputGain ?? 1;
        this.previousInput = 0;
        this.previousOutput = 0;
    }

    reset() {
        this.previousInput = 0;
        this.previousOutput = 0;
    }

    tick(sample) {
        const blocked = sample - this.previousInput + DC_BLOCK_R * this.previousOutput;
        this.previousInput = sample;
        this.previousOutput = Number.isFinite(blocked) ? blocked : 0;

        const scaled = this.previousOutput * this.outputGain;
        if (!Number.isFinite(scaled)) return 0;
        return Math.max(-OUTPUT_CLAMP, Math.min(OUTPUT_CLAMP, scaled));
    }
}

export default OutputConditioner;
