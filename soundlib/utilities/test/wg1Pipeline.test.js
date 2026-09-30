// End-to-end test of the WG1 (WaveguideResonator v1, Phase A) DSP pipeline
// exactly as soundlib/models/WG1/wg1Processor.js composes it, minus the
// AudioWorkletProcessor/registerProcessor plumbing (which requires a
// browser and can't run under `node --test`), mirroring windPipeline.test.js/
// chimeVocoderPipeline.test.js's own pattern.

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWg1Pluck, buildWg1Pipeline } from '../../models/WG1/wg1PipelineCore.js';
import { t60 } from '../decayMath.js';

const SAMPLE_RATE = 44100;

function peak(samples) {
    let p = 0;
    for (const s of samples) {
        const a = Math.abs(s);
        if (a > p) p = a;
    }
    return p;
}

// Simple autocorrelation pitch estimate over a windowed region -- good
// enough to check tuning within a few percent, not a general-purpose
// pitch tracker.
function estimatePitch(samples, sampleRate, minHz, maxHz) {
    const minLag = Math.floor(sampleRate / maxHz);
    const maxLag = Math.min(Math.ceil(sampleRate / minHz), Math.floor(samples.length / 2));
    let bestLag = minLag;
    let bestCorr = -Infinity;
    for (let lag = minLag; lag <= maxLag; lag++) {
        let corr = 0;
        for (let i = 0; i < samples.length - lag; i++) corr += samples[i] * samples[i + lag];
        if (corr > bestCorr) {
            bestCorr = corr;
            bestLag = lag;
        }
    }
    return sampleRate / bestLag;
}

// Time for windowed RMS to drop below initialRms/1000 (-60dB), measured
// from the very start of the render (a pluck at t=0).
function measuredT60Seconds(samples, sampleRate, blockSize = 512) {
    const rmsOf = (start, length) => {
        let sum = 0;
        for (let i = start; i < start + length; i++) sum += samples[i] * samples[i];
        return Math.sqrt(sum / length);
    };
    const initialRms = rmsOf(0, blockSize);
    for (let start = 0; start + blockSize < samples.length; start += blockSize) {
        if (rmsOf(start, blockSize) < initialRms / 1000) return start / sampleRate;
    }
    return null;
}

// Single-frequency-bin DFT magnitude (Goertzel-style) -- isolates the
// FUNDAMENTAL's own decay from broadband/high-frequency content, which
// (per the interpolation investigation this test guards against
// regressing) can decay at a very different rate. See
// soundlib/models/WG1/knowledge/causal-claims.yaml.
function fundamentalBandT60Seconds(samples, sampleRate, targetHz, blockSize = 1024) {
    const magnitudeAt = (start) => {
        let re = 0;
        let im = 0;
        for (let n = 0; n < blockSize; n++) {
            const angle = (2 * Math.PI * targetHz * n) / sampleRate;
            re += samples[start + n] * Math.cos(angle);
            im -= samples[start + n] * Math.sin(angle);
        }
        return Math.sqrt(re * re + im * im) / blockSize;
    };
    const initial = magnitudeAt(0);
    for (let start = 0; start + blockSize < samples.length; start += blockSize) {
        if (magnitudeAt(start) < initial / 1000) return start / sampleRate;
    }
    return null;
}

// Drives the exact same DSP composition as wg1Processor.js's process()
// loop, but exposes the delay line's own internal stored energy (sum of
// squares across its active window) rather than only the pickup output --
// this is what isolates a genuine propagation-energy-loss regression from
// a pickup-position/interference artifact (see the interpolation
// investigation this test guards against regressing).
function internalEnergyNotReachedWithinSeconds(frequency, seconds, sampleRate = SAMPLE_RATE) {
    const pipeline = buildWg1Pipeline(sampleRate, 7);
    pipeline.waveguide.setDelaySamples(sampleRate / frequency);
    // Near-lossless: isolates the interpolator's own effect from the
    // explicit LoopLossFilter, exactly as the investigation's control did.
    pipeline.lossFilter.setDecayTime(1e6, sampleRate, pipeline.waveguide.delaySamples);
    pipeline.exciter.excite(pipeline.waveguide, pipeline.waveguide.delaySamples, 'impulse', 1.0);

    const frameCount = Math.round(sampleRate * seconds);
    const len = Math.round(pipeline.waveguide.delaySamples);
    const blockSize = 512;
    let initialRms = null;
    let sumSq = 0;
    for (let i = 0; i < frameCount; i++) {
        const filtered = pipeline.lossFilter.process(pipeline.termination.reflect(pipeline.waveguide.read(pipeline.interpolator)));
        pipeline.waveguide.write(filtered);
        let e = 0;
        for (let k = 0; k < len; k++) e += pipeline.waveguide.buffer[k] * pipeline.waveguide.buffer[k];
        sumSq += e;
        if ((i + 1) % blockSize === 0) {
            const blockRms = Math.sqrt(sumSq / blockSize);
            sumSq = 0;
            if (initialRms === null) initialRms = blockRms;
            else if (blockRms < initialRms / 1000) return false; // reached -60dB -- energy was NOT preserved
        }
    }
    return true; // never reached -60dB within the render -- energy preserved, as expected
}

test('silence before any pluck', () => {
    const samples = renderWg1Pluck(SAMPLE_RATE, 1, {}, 0.2, 10 /* pluck after the render ends */);
    for (const s of samples) assert.equal(s, 0);
});

test('same seed and settings render identically', () => {
    const a = renderWg1Pluck(SAMPLE_RATE, 4, { frequency: 220 }, 0.5, 0);
    const b = renderWg1Pluck(SAMPLE_RATE, 4, { frequency: 220 }, 0.5, 0);
    assert.deepEqual(Array.from(a), Array.from(b));
});

test('different seeds diverge for noise excitation', () => {
    const a = renderWg1Pluck(SAMPLE_RATE, 5, { excitationType: 'noise' }, 0.2, 0);
    const b = renderWg1Pluck(SAMPLE_RATE, 6, { excitationType: 'noise' }, 0.2, 0);
    assert.notDeepEqual(Array.from(a), Array.from(b));
});

test('no NaN or Infinity across the full parameter grid, including corners', () => {
    const frequencies = [20, 220, 4000];
    const energies = [0, 0.5, 1];
    const decayTimes = [0.05, 2.5, 30];
    const excitationTypes = ['noise', 'impulse'];
    for (const frequency of frequencies) {
        for (const energy of energies) {
            for (const decayTime of decayTimes) {
                for (const excitationType of excitationTypes) {
                    const samples = renderWg1Pluck(SAMPLE_RATE, 7, { frequency, energy, decayTime, excitationType }, 0.3, 0);
                    for (const s of samples) {
                        assert.ok(
                            Number.isFinite(s),
                            `expected finite output at frequency=${frequency} energy=${energy} decayTime=${decayTime} excitationType=${excitationType}, got ${s}`
                        );
                    }
                }
            }
        }
    }
});

test('loop stays stable (bounded peak) across the full parameter grid', () => {
    const frequencies = [20, 220, 4000];
    const energies = [0, 0.5, 1];
    const decayTimes = [0.05, 2.5, 30];
    const excitationTypes = ['noise', 'impulse'];
    let worstPeak = 0;
    let worstParams = null;
    for (const frequency of frequencies) {
        for (const energy of energies) {
            for (const decayTime of decayTimes) {
                for (const excitationType of excitationTypes) {
                    const samples = renderWg1Pluck(SAMPLE_RATE, 7, { frequency, energy, decayTime, excitationType }, 0.5, 0);
                    const p = peak(samples);
                    if (p > worstPeak) {
                        worstPeak = p;
                        worstParams = { frequency, energy, decayTime, excitationType };
                    }
                }
            }
        }
    }
    // Measured worst case across this grid is ~1.08 (see wg1Config.js's
    // OUTPUT_GAIN comment) -- well under the OutputConditioner clamp (4.0).
    // A generous bound here catches genuine instability, not normal peaks.
    assert.ok(worstPeak < 2, `expected bounded loop output, got peak ${worstPeak} at ${JSON.stringify(worstParams)}`);
});

test('estimated fundamental is within a few percent across the supported frequency range', () => {
    // Tolerance is not zero: interpolation is only exact when the
    // requested delay happens to land on an integer sample count.
    // lagrange3 (the default -- see createInterpolator.js) was chosen
    // specifically because its tuning error matches plain linear
    // interpolation's own (already small) error almost exactly, unlike
    // allpass1, which was rejected for this exact reason (measured up to
    // -18% tuning error at high frequency -- see
    // soundlib/models/WG1/knowledge/causal-claims.yaml).
    for (const frequency of [30, 100, 220, 440, 1000, 3000]) {
        const samples = renderWg1Pluck(SAMPLE_RATE, 7, { frequency, decayTime: 3 }, 0.3, 0);
        const window = samples.slice(4000, 12000);
        const estimated = estimatePitch(window, SAMPLE_RATE, frequency * 0.5, frequency * 2);
        const errorPercent = Math.abs(100 * (estimated - frequency) / frequency);
        assert.ok(
            errorPercent < 3,
            `expected fundamental near ${frequency}Hz, estimated ${estimated.toFixed(2)}Hz (${errorPercent.toFixed(2)}% error)`
        );
    }
});

test('increasing decayTime measurably and monotonically lengthens decay', () => {
    // Not checked against the naive tau*ln(1000) prediction exactly --
    // even with lagrange3 (the default), interpolation still isn't
    // perfectly transparent, so actual decay can fall a little short of
    // the nominal value at some frequencies (dramatically less than
    // linear's own shortfall -- see the frequency-swept tests below,
    // which are what actually guard against a regression here). The
    // relationship this test checks -- monotonic, substantial increase --
    // is what the spec's own acceptance test (section 16) actually asks
    // for.
    const decaySteps = [0.2, 1, 5];
    let previousT60 = 0;
    for (const decayTime of decaySteps) {
        const renderSeconds = t60(decayTime) * 1.3;
        const samples = renderWg1Pluck(SAMPLE_RATE, 7, { frequency: 220, decayTime }, renderSeconds, 0);
        const measured = measuredT60Seconds(samples, SAMPLE_RATE);
        assert.ok(measured !== null, `expected decay to reach -60dB within the render for decayTime=${decayTime}`);
        assert.ok(
            measured > previousT60 * 1.5,
            `expected a substantially longer decay than the previous step, got ${measured}s (previous ${previousT60}s) for decayTime=${decayTime}`
        );
        previousT60 = measured;
    }
});

test('energy measurably changes the render', () => {
    const low = renderWg1Pluck(SAMPLE_RATE, 42, { frequency: 220, energy: 0.1 }, 0.3, 0);
    const high = renderWg1Pluck(SAMPLE_RATE, 42, { frequency: 220, energy: 1 }, 0.3, 0);
    assert.ok(peak(high) > peak(low) * 2, `expected higher energy to produce a substantially louder pluck, got peak(low)=${peak(low)} peak(high)=${peak(high)}`);
});

test('excitationType (noise vs impulse) produces different renders', () => {
    const noise = renderWg1Pluck(SAMPLE_RATE, 42, { frequency: 220, excitationType: 'noise' }, 0.1, 0);
    const impulse = renderWg1Pluck(SAMPLE_RATE, 42, { frequency: 220, excitationType: 'impulse' }, 0.1, 0);
    assert.notDeepEqual(Array.from(noise), Array.from(impulse));
});

// The regression-coverage gap the interpolation investigation surfaced:
// every test above this point only ever checked decay/tuning at 220Hz,
// which would never have caught linear interpolation's catastrophic
// high-frequency energy collapse (see
// soundlib/models/WG1/knowledge/causal-claims.yaml). These sweep the full
// supported frequency range with the default interpolator (lagrange3),
// checking both internal stored energy (with explicit loss disabled --
// isolates the propagation/interpolation effect itself) and the
// fundamental's own band-specific decay (with normal decayTime -- what a
// listener would actually perceive as "how long the note rings").
test('internal energy is approximately preserved (explicit loss disabled) across the supported frequency range', () => {
    for (const frequency of [55, 220, 440, 880, 1760, 3000]) {
        const preserved = internalEnergyNotReachedWithinSeconds(frequency, 2);
        assert.ok(preserved, `expected internal energy to stay close to preserved (near-lossless) at ${frequency}Hz with the default interpolator, but it decayed to -60dB within 2s`);
    }
});

test('fundamental-band T60 stays close to nominal across the supported frequency range', () => {
    // Thresholds reflect what's actually measured with lagrange3 (the
    // default), not a uniform guess: excellent (ratio 0.95-1.0) across
    // most of the range, but genuinely weaker at both extremes (measured
    // ~0.79 at 55Hz, ~0.52 at 3000Hz) -- a real, honest residual, not a
    // bug (still a large improvement over linear's own extremes, e.g.
    // ~0.02-0.07 for WG2 at 3000Hz -- see
    // soundlib/models/WG1/knowledge/causal-claims.yaml). Each threshold
    // is set with real margin below its own measured value, so this
    // catches a genuine regression without being so loose it can't.
    const decayTime = 0.5;
    const expectedT60 = t60(decayTime);
    const minRatioByFrequency = { 55: 0.65, 110: 0.85, 220: 0.85, 440: 0.85, 880: 0.85, 1760: 0.85, 3000: 0.4 };
    for (const [frequency, minRatio] of Object.entries(minRatioByFrequency)) {
        const samples = renderWg1Pluck(SAMPLE_RATE, 7, { frequency: Number(frequency), decayTime }, expectedT60 * 1.4, 0);
        const measured = fundamentalBandT60Seconds(samples, SAMPLE_RATE, Number(frequency));
        assert.ok(measured !== null, `expected the fundamental to decay to -60dB within the render at ${frequency}Hz`);
        const ratio = measured / expectedT60;
        assert.ok(
            ratio > minRatio,
            `expected fundamental-band T60 ratio above ${minRatio} at ${frequency}Hz, got ${ratio.toFixed(3)} (measured ${measured.toFixed(3)}s vs expected ${expectedT60.toFixed(3)}s)`
        );
    }
});
