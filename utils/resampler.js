// /utils/resampler.js
// Polyphase windowed-sinc resampler (stateful, hop-friendly)

export class WSincResampler {
  constructor(srcRate, dstRate, {
    taps = 32,      // 16 will speed things up (over 32) with a small hit to sound quality
    phases = 1024,  // 512 will speed things up (over 1024) with a small hit to sound quality
    cutoff = 0.90 * Math.min(0.5, 0.5 * dstRate / srcRate),
    window = 'kaiser',
    kaiserBeta = 6.0,
  } = {}) {
    this.srcRate = srcRate;
    this.dstRate = dstRate;
    this.taps = taps;
    this.phases = phases;
    this.cutoff = cutoff;
    this.kaiserBeta = kaiserBeta;

    this.kernel = new Float32Array(phases * taps);
    this._buildKernel(window);

    this._srcFrac = 0;
    this._history = new Float32Array(taps);
    this._ratio = dstRate / srcRate;
  }

  // ---- internals ----
  _i0(x) {
    let sum = 1.0, u = 1.0;
    for (let k = 1; k < 20; k++) {
      u *= (x * x) / (4 * k * k);
      sum += u;
      if (u < 1e-12) break;
    }
    return sum;
  }
  _kaiserWindow(n, N, beta) {
    const a = 2 * n / (N - 1) - 1;
    return this._i0(beta * Math.sqrt(1 - a * a)) / this._i0(beta);
  }
  _blackmanWindow(n, N) {
    const a0 = 0.42, a1 = 0.5, a2 = 0.08, x = 2 * Math.PI * n / (N - 1);
    return a0 - a1 * Math.cos(x) + a2 * Math.cos(2 * x);
  }
  _sinc(x) {
    if (Math.abs(x) < 1e-8) return 1.0;
    const pix = Math.PI * x;
    return Math.sin(pix) / pix;
  }
  _buildKernel(window) {
    const { phases, taps, cutoff } = this;
    const half = (taps - 1) / 2;
    for (let p = 0; p < phases; p++) {
      const frac = p / phases;
      let sum = 0;
      for (let n = 0; n < taps; n++) {
        const x = (n - half) - frac;
        const win = (window === 'kaiser')
          ? this._kaiserWindow(n, taps, this.kaiserBeta)
          : this._blackmanWindow(n, taps);
        const v = cutoff * this._sinc(x * cutoff) * win;
        this.kernel[p * taps + n] = v;
        sum += v;
      }
      if (sum !== 0) {
        const inv = 1 / sum;
        for (let n = 0; n < taps; n++) {
          this.kernel[p * taps + n] *= inv;
        }
      }
    }
  }

  // ---- streaming process: input @ srcRate → Float32Array @ dstRate ----
  process(input) {
    const { taps, phases } = this;
    const ratio = this._ratio;

    // [history | input]
    const hist = this._history;
    const histKeep = Math.min(taps - 1, hist.length);
    const total = histKeep + input.length;
    const work = new Float32Array(total);
    work.set(hist.subarray(hist.length - histKeep), 0);
    work.set(input, histKeep);

    // refresh history (last taps-1)
    const keep = Math.min(taps - 1, total);
    if (keep > 0) hist.set(work.subarray(total - keep));

    const inAvail = total - (taps - 1);
    const outLen = Math.max(0, Math.floor((inAvail - this._srcFrac) * ratio));
    const out = new Float32Array(outLen);

    let outIndex = 0;
    let srcPos = this._srcFrac;

    while (outIndex < outLen) {
      const iposInt = Math.floor(srcPos);
      const frac = srcPos - iposInt;
      const phase = Math.min(phases - 1, Math.floor(frac * phases));
      const center = iposInt + (taps - 1) / 2;
      const kBase = phase * taps;

      let acc = 0.0;
      const start = center - (taps - 1) / 2;
      for (let n = 0; n < taps; n++) {
        acc += work[start + n] * this.kernel[kBase + n];
      }
      out[outIndex++] = acc;

      srcPos += 1 / ratio;
      if (iposInt + 1 >= inAvail) break;
    }

    const consumed = Math.floor(srcPos);
    this._srcFrac = srcPos - consumed;
    return out;
  }
}

// Optional quick fallback for “fast mode”
export function upsample2xLinear(x24) {
  const N = x24.length;
  const out = new Float32Array(N * 2);
  for (let i = 0; i < N - 1; i++) {
    const a = x24[i], b = x24[i + 1];
    out[2 * i] = a;
    out[2 * i + 1] = 0.5 * (a + b);
  }
  out[out.length - 2] = x24[N - 1];
  out[out.length - 1] = x24[N - 1];
  return out;
}
