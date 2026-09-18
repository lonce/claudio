// Copied unchanged from the supplied Claudio utility so this deliverable can
// be tested independently. In Claudio, PlusSimplexPhasor.js may import the
// existing utilities/SimplexNoise.js instead.

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
        const random = mulberry32(Number(seed) >>> 0);
        const perm = new Uint8Array(256);
        for (let i = 0; i < 256; i++) perm[i] = i;
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [perm[i], perm[j]] = [perm[j], perm[i]];
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
        const x0 = x - (i - t);
        const y0 = y - (j - t);
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
        return Math.max(-1, Math.min(1, 70 * (n0 + n1 + n2)));
    }

    static deriveFixedY(seed) {
        const random = mulberry32((Number(seed) >>> 0) ^ 0x9E3779B9);
        return 1 + random() * 999;
    }
}

export default SimplexNoise;
