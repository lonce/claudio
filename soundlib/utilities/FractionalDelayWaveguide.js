// Plain, framework-agnostic fractional-delay circular buffer with feedback
// -- the propagation primitive for WaveguideResonator-family models (see
// docs/MODEL_PATTERNS.md's digital-waveguide archetype and
// scratch/WaveguideResonator-v1-Specification-and-Reasoning-Model.md).
// Lives here (not under soundlib/models/WG1/) deliberately: the spec's own
// stated goal is reuse by future bow/hammer/collision-excited waveguide
// models, not just WG1 -- an explicit exception to this codebase's usual
// "extract once a second consumer exists" rule, justified by that stated
// intent rather than guessed.
//
// Phase A shape: a SINGLE delay loop representing one full round trip (not
// yet a true bidirectional two-rail waveguide with independently
// addressable spatial positions) -- matching the spec's own Phase A/Phase
// B split, where position-dependent excitation/pickup (which genuinely
// needs the two-rail structure to mean anything physically) is explicitly
// Phase B. This class only knows how to read/write a single loop; do not
// read more physical meaning into it than that.
//
// Read/write split (not a single read-modify-write pointer, the classic
// textbook Karplus-Strong shape): writes always happen at the integer
// write index; reads are linearly interpolated at a fractional offset
// behind it. This is the standard way to support a continuously variable,
// non-integer delay length without ambiguity about where a fractional
// write should land.

export class FractionalDelayWaveguide {
    constructor(maxDelaySamples) {
        this.buffer = new Float64Array(Math.max(4, Math.ceil(maxDelaySamples)));
        this.writeIndex = 0;
        this.delaySamples = this.buffer.length - 1;
    }

    reset() {
        this.buffer.fill(0);
        this.writeIndex = 0;
    }

    // Clamped to leave room for the interpolator's +1 read and to stay
    // strictly positive -- a zero or negative delay has no physical
    // meaning for this loop.
    setDelaySamples(delaySamples) {
        this.delaySamples = Math.max(1, Math.min(delaySamples, this.buffer.length - 2));
    }

    // Linear-interpolated read, `this.delaySamples` behind the write
    // pointer. Phase A's stated interpolation choice (spec 5.2) --
    // introduces frequency-dependent loss under fast modulation, not
    // mistuning under a static/slowly-changing delay; isolated here so a
    // higher-quality interpolator can replace it later without touching
    // any caller.
    read() {
        const length = this.buffer.length;
        const position = (this.writeIndex - this.delaySamples + length * 2) % length;
        const indexA = Math.floor(position);
        const frac = position - indexA;
        const indexB = (indexA + 1) % length;
        return this.buffer[indexA] * (1 - frac) + this.buffer[indexB] * frac;
    }

    // Writes at the current index and advances it -- the feedback step.
    // Fails toward silence on a non-finite value (same principle as
    // ResonatorBank.tick()) rather than letting NaN poison every future
    // read.
    write(value) {
        this.buffer[this.writeIndex] = Number.isFinite(value) ? value : 0;
        this.writeIndex = (this.writeIndex + 1) % this.buffer.length;
    }
}

export default FractionalDelayWaveguide;
