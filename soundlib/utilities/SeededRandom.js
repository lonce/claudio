// Plain, framework-agnostic seeded PRNG for the PhISEM family (and any
// other worklet DSP that needs uniform draws without Math.random()). Same
// mulberry32 generator already used by SimplexNoise.js, exposed here as a
// small reusable class rather than duplicated inline again.

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class SeededRandom {
    constructor(seed = 1) {
        this.reset(seed);
    }

    reset(seed = this.seed) {
        this.seed = Number(seed) >>> 0;
        this._next = mulberry32(this.seed);
    }

    // Uniform in [0, 1).
    unipolar() {
        return this._next();
    }

    // Uniform in [-1, 1).
    bipolar() {
        return this._next() * 2 - 1;
    }
}

export default SeededRandom;
