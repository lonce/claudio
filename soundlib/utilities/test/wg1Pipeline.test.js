// End-to-end test of the WG1 (WaveguideResonator v1, Phase A) DSP pipeline
// exactly as soundlib/models/WG1/wg1Processor.js composes it, minus the
// AudioWorkletProcessor/registerProcessor plumbing (which requires a
// browser and can't run under `node --test`), mirroring windPipeline.test.js/
// chimeVocoderPipeline.test.js's own pattern.

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWg1Pluck } from '../../models/WG1/wg1PipelineCore.js';
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
    // Tolerance is not zero: linear interpolation's own smoothing (see
    // FractionalDelayWaveguide.js) makes tuning exact only when the
    // requested delay happens to land on an integer sample count --
    // confirmed empirically, not assumed (measured 0% error at frequencies
    // whose delaySamples is exactly integral, ~0.2% typically, up to ~2%
    // at the high end of the range where delaySamples is small enough that
    // one sample of interpolation smoothing is a larger fraction of it).
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
    // linear interpolation's smoothing measurably shortens actual decay
    // below that nominal value (confirmed empirically: exactly matches
    // the prediction when delaySamples happens to be an integer, ~75% of
    // it at worst-case interpolation fraction 0.5). The relationship this
    // test checks -- monotonic, substantial increase -- is what the
    // spec's own acceptance test (section 16) actually asks for.
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
