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
// Phase A shape (WG1): used as a SINGLE delay loop representing one full
// round trip via read()/write()/setDelaySamples(). Phase B (WG2's
// BidirectionalWaveguide, soundlib/utilities/BidirectionalWaveguide.js)
// uses the SAME class as one one-way rail of a true bidirectional two-rail
// waveguide, via the more general readAt()/writeAt() -- confirmed to need
// no new delay-line class, just these two additions, kept fully backward
// compatible (read()/write() are unchanged, WG1's own tests re-verified
// after adding them). This class only knows how to read/write a buffer at
// an offset; it has no opinion about whether that represents a full loop
// or one rail -- that meaning lives in the caller.
//
// Read/write split (not a single read-modify-write pointer, the classic
// textbook Karplus-Strong shape): writes always happen at the integer
// write index; reads are interpolated at a fractional offset behind it.
// This is the standard way to support a continuously variable, non-
// integer delay length without ambiguity about where a fractional write
// should land.
//
// The interpolation METHOD itself is a swappable strategy (see
// LinearInterpolator.js/AllpassInterpolator.js), not baked in here --
// readAt()/read() take an optional interpolator argument, defaulting to
// the shared stateless linear one for exact backward compatibility. A
// stateful interpolator (allpass) needs its own instance per tap site,
// not one shared across the whole waveguide -- see AllpassInterpolator.js's
// own comment for why, and BidirectionalWaveguide.js for how WG2 owns two
// separate instances for its two propagation-critical taps.

import { SHARED_LINEAR_INTERPOLATOR } from './LinearInterpolator.js';

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

    // Interpolated read at an arbitrary offset behind the write pointer
    // ("the value written `offsetSamples` samples ago"), via whichever
    // interpolator is passed -- defaults to the shared linear one,
    // reproducing the exact prior behavior when omitted. Measured,
    // frequency-dependent tradeoffs of each interpolation strategy are
    // documented on the interpolator classes themselves, not here.
    readAt(offsetSamples, interpolator = SHARED_LINEAR_INTERPOLATOR) {
        return interpolator.read(this.buffer, this.buffer.length, this.writeIndex, offsetSamples);
    }

    // this.delaySamples behind the write pointer -- the self-feedback
    // loop shape WG1 uses. Sugar over readAt(); unchanged behavior.
    read(interpolator = SHARED_LINEAR_INTERPOLATOR) {
        return this.readAt(this.delaySamples, interpolator);
    }

    // Writes directly at an arbitrary offset behind the write pointer,
    // WITHOUT advancing the pointer -- for placing an initial spatial
    // condition (set the state that's already "there" at several
    // positions at once), not injecting a new sample to propagate later.
    // No interpolation on write -- a fractional offset rounds to its
    // nearest integer slot, the same "informed approximation" spirit as
    // readAt()'s own linear interpolation; there is no single clean slot
    // for a fractional write the way there naturally is for a fractional
    // read.
    writeAt(offsetSamples, value) {
        const length = this.buffer.length;
        const index = Math.round((this.writeIndex - offsetSamples + length * 2) % length) % length;
        this.buffer[index] = Number.isFinite(value) ? value : 0;
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
