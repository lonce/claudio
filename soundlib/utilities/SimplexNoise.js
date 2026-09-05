// Plain, framework-agnostic seeded 2D simplex noise generator. No Web Audio
// references -- same spirit as TransitionPhasor.js. Consumed by
// worklets/noiseControlProcessor.js the same way transitionNotifierProcessor.js
// imports TransitionPhasor.
//
// Standard Gustavson-style 2D simplex noise. The permutation table is
// shuffled by a small seeded PRNG (mulberry32), never Math.random(), so the
// same seed always reproduces the same noise field.

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

const GRAD2 = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1]
];

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

export class SimplexNoise {
    constructor(seed = 0) {
        const normalizedSeed = Number(seed) >>> 0;
        const random = mulberry32(normalizedSeed);

        const perm = new Uint8Array(256);
        for (let i = 0; i < 256; i++) perm[i] = i;
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            const tmp = perm[i];
            perm[i] = perm[j];
            perm[j] = tmp;
        }

        this.perm = new Uint8Array(512);
        this.permMod8 = new Uint8Array(512);
        for (let i = 0; i < 512; i++) {
            this.perm[i] = perm[i & 255];
            this.permMod8[i] = this.perm[i] % 8;
        }
    }

    noise2D(x, y) {
        const s = (x + y) * F2;
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);
        const t = (i + j) * G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = x - X0;
        const y0 = y - Y0;

        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }

        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2;
        const y2 = y0 - 1 + 2 * G2;

        const ii = i & 255;
        const jj = j & 255;

        const gi0 = this.permMod8[ii + this.perm[jj]];
        const gi1 = this.permMod8[ii + i1 + this.perm[jj + j1]];
        const gi2 = this.permMod8[ii + 1 + this.perm[jj + 1]];

        let n0 = 0, n1 = 0, n2 = 0;

        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 >= 0) {
            t0 *= t0;
            const g = GRAD2[gi0];
            n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
        }

        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 >= 0) {
            t1 *= t1;
            const g = GRAD2[gi1];
            n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
        }

        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 >= 0) {
            t2 *= t2;
            const g = GRAD2[gi2];
            n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
        }

        // Standard 2D simplex normalization keeps the sum nominally in [-1,1].
        const value = 70 * (n0 + n1 + n2);
        return Math.max(-1, Math.min(1, value));
    }

    // Deterministic per-seed second coordinate for 1D traversal of this 2D
    // field (noise2D(t, fixedY)) -- two different seeds get genuinely
    // different paths, not just different permutation shuffles of the same
    // y=constant slice.
    static deriveFixedY(seed) {
        const normalizedSeed = Number(seed) >>> 0;
        const random = mulberry32(normalizedSeed ^ 0x9E3779B9);
        return 1 + random() * 999;
    }
}

export default SimplexNoise;
