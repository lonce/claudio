// End-to-end test of the WG2 (WaveguideResonator v1, Phase B) DSP pipeline
// exactly as soundlib/models/WG2/wg2Processor.js composes it, minus the
// AudioWorkletProcessor/registerProcessor plumbing (which requires a
// browser and can't run under `node --test`), mirroring
// wg1Pipeline.test.js's own pattern.

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWg2Pluck, buildWg2Pipeline } from '../../models/WG2/wg2PipelineCore.js';
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
// FUNDAMENTAL's own decay from broadband/high-frequency content. See
// soundlib/models/WG2/knowledge/causal-claims.yaml.
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

// Drives the exact same DSP composition as wg2Processor.js's process()
// loop, but exposes the two rails' own internal stored energy rather than
// only the pickup output -- isolates a genuine propagation-energy-loss
// regression from a pickup-position/interference artifact (see the
// interpolation investigation this test guards against regressing).
// Returns the measured T60 in seconds, or null if energy was never
// observed to decay to -60dB within the render (i.e. fully preserved).
function internalEnergyT60Seconds(frequency, seconds, sampleRate = SAMPLE_RATE) {
    const pipeline = buildWg2Pipeline(sampleRate, 7);
    pipeline.waveguide.setRailLength(sampleRate / (2 * frequency));
    // Near-lossless: isolates the interpolator's own effect from the
    // explicit LoopLossFilter, exactly as the investigation's control did.
    pipeline.lossFilter.setDecayTime(1e6, sampleRate, pipeline.waveguide.railLength);
    pipeline.exciter.exciteAtPosition(pipeline.waveguide.rightGoing, pipeline.waveguide.leftGoing, pipeline.waveguide.railLength, 0.18, 'impulse', 1.0);

    const frameCount = Math.round(sampleRate * seconds);
    const len = Math.round(pipeline.waveguide.railLength);
    const blockSize = 512;
    let initialRms = null;
    let sumSq = 0;
    for (let i = 0; i < frameCount; i++) {
        pipeline.waveguide.tick(pipeline.nutTermination, pipeline.bridgeTermination, pipeline.lossFilter);
        let e = 0;
        for (let k = 0; k < len; k++) {
            e += pipeline.waveguide.rightGoing.buffer[k] * pipeline.waveguide.rightGoing.buffer[k];
            e += pipeline.waveguide.leftGoing.buffer[k] * pipeline.waveguide.leftGoing.buffer[k];
        }
        sumSq += e;
        if ((i + 1) % blockSize === 0) {
            const blockRms = Math.sqrt(sumSq / blockSize);
            sumSq = 0;
            if (initialRms === null) initialRms = blockRms;
            else if (blockRms < initialRms / 1000) return i / sampleRate;
        }
    }
    return null;
}

// Single-frequency-bin DFT magnitude (Goertzel-style) -- enough to check
// modal-null suppression at specific harmonics, not a general spectral
// analysis tool.
function harmonicMagnitude(samples, freqHz, sampleRate) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < samples.length; n++) {
        const angle = (2 * Math.PI * freqHz * n) / sampleRate;
        re += samples[n] * Math.cos(angle);
        im -= samples[n] * Math.sin(angle);
    }
    return Math.sqrt(re * re + im * im) / samples.length;
}

function harmonicProfile(settings, frequency, numHarmonics) {
    const samples = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, decayTime: 5, ...settings }, 0.3, 0);
    const window = samples.slice(2000, 2000 + 8192);
    const mags = [];
    for (let n = 1; n <= numHarmonics; n++) mags.push(harmonicMagnitude(window, frequency * n, SAMPLE_RATE));
    return mags;
}

test('silence before any pluck', () => {
    const samples = renderWg2Pluck(SAMPLE_RATE, 1, {}, 0.2, 10);
    for (const s of samples) assert.equal(s, 0);
});

test('same seed and settings render identically', () => {
    const a = renderWg2Pluck(SAMPLE_RATE, 4, { frequency: 220 }, 0.5, 0);
    const b = renderWg2Pluck(SAMPLE_RATE, 4, { frequency: 220 }, 0.5, 0);
    assert.deepEqual(Array.from(a), Array.from(b));
});

test('different seeds diverge for noise excitation', () => {
    const a = renderWg2Pluck(SAMPLE_RATE, 5, { excitationType: 'noise' }, 0.2, 0);
    const b = renderWg2Pluck(SAMPLE_RATE, 6, { excitationType: 'noise' }, 0.2, 0);
    assert.notDeepEqual(Array.from(a), Array.from(b));
});

test('no NaN or Infinity across the full parameter grid, including corners', () => {
    const frequencies = [20, 220, 4000];
    const energies = [0, 0.5, 1];
    const decayTimes = [0.05, 2.5, 30];
    const positions = [0.02, 0.5, 0.98];
    const excitationTypes = ['noise', 'impulse', 'triangle'];
    const pickupTypes = ['displacement', 'velocity', 'bridgeForce'];
    for (const frequency of frequencies) {
        for (const energy of energies) {
            for (const decayTime of decayTimes) {
                for (const excitationPosition of positions) {
                    for (const pickupPosition of positions) {
                        for (const excitationType of excitationTypes) {
                            for (const pickupType of pickupTypes) {
                                const settings = { frequency, energy, decayTime, excitationPosition, pickupPosition, excitationType, pickupType };
                                const samples = renderWg2Pluck(SAMPLE_RATE, 7, settings, 0.2, 0);
                                for (const s of samples) {
                                    assert.ok(Number.isFinite(s), `expected finite output at ${JSON.stringify(settings)}, got ${s}`);
                                }
                            }
                        }
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
    const positions = [0.02, 0.5, 0.98];
    const excitationTypes = ['noise', 'impulse', 'triangle'];
    const pickupTypes = ['displacement', 'velocity', 'bridgeForce'];
    let worstPeak = 0;
    let worstParams = null;
    for (const frequency of frequencies) {
        for (const energy of energies) {
            for (const decayTime of decayTimes) {
                for (const excitationPosition of positions) {
                    for (const pickupPosition of positions) {
                        for (const excitationType of excitationTypes) {
                            for (const pickupType of pickupTypes) {
                                const settings = { frequency, energy, decayTime, excitationPosition, pickupPosition, excitationType, pickupType };
                                const samples = renderWg2Pluck(SAMPLE_RATE, 7, settings, 0.2, 0);
                                const p = peak(samples);
                                if (p > worstPeak) {
                                    worstPeak = p;
                                    worstParams = settings;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    // Measured worst case across this grid is ~1.46 (see wg2Config.js's
    // OUTPUT_GAIN comment) -- well under the OutputConditioner clamp (4.0).
    assert.ok(worstPeak < 3, `expected bounded loop output, got peak ${worstPeak} at ${JSON.stringify(worstParams)}`);
});

test('estimated fundamental is within a few percent across the supported frequency range', () => {
    for (const frequency of [30, 100, 220, 440, 1000, 3000]) {
        const samples = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, decayTime: 3 }, 0.3, 0);
        const window = samples.slice(4000, 12000);
        const estimated = estimatePitch(window, SAMPLE_RATE, frequency * 0.5, frequency * 2);
        const errorPercent = Math.abs((100 * (estimated - frequency)) / frequency);
        assert.ok(errorPercent < 3, `expected fundamental near ${frequency}Hz, estimated ${estimated.toFixed(2)}Hz (${errorPercent.toFixed(2)}% error)`);
    }
});

test('increasing decayTime measurably and monotonically lengthens decay', () => {
    // Same "not checked against the naive tau*ln(1000) prediction exactly"
    // caveat as wg1Pipeline.test.js -- the two-rail structure crosses the
    // interpolator's smoothing twice per full loop trip instead of once,
    // so the shortfall below nominal is expected to be somewhat larger
    // than WG1's own ~75% worst case, not a regression.
    const decaySteps = [0.2, 1, 5];
    let previousT60 = 0;
    for (const decayTime of decaySteps) {
        const renderSeconds = t60(decayTime) * 1.4;
        const samples = renderWg2Pluck(SAMPLE_RATE, 7, { frequency: 220, decayTime }, renderSeconds, 0);
        const measured = measuredT60Seconds(samples, SAMPLE_RATE);
        assert.ok(measured !== null, `expected decay to reach -60dB within the render for decayTime=${decayTime}`);
        assert.ok(
            measured > previousT60 * 1.3,
            `expected a substantially longer decay than the previous step, got ${measured}s (previous ${previousT60}s) for decayTime=${decayTime}`
        );
        previousT60 = measured;
    }
});

test('exciting at the midpoint suppresses even harmonics but not odd ones (movable modal null, excitation side)', () => {
    const frequency = 220;
    const midpoint = harmonicProfile({ excitationPosition: 0.5, pickupPosition: 0.31 }, frequency, 8);
    const offCenter = harmonicProfile({ excitationPosition: 0.18, pickupPosition: 0.31 }, frequency, 8);

    for (let harmonic = 2; harmonic <= 8; harmonic += 2) {
        const ratio = midpoint[harmonic - 1] / offCenter[harmonic - 1];
        assert.ok(
            ratio < 0.2,
            `expected harmonic ${harmonic} (even) to be suppressed when exciting at the midpoint, got ratio ${ratio.toFixed(4)}`
        );
    }
    for (let harmonic = 1; harmonic <= 7; harmonic += 2) {
        const ratio = midpoint[harmonic - 1] / offCenter[harmonic - 1];
        assert.ok(
            ratio > 0.3,
            `expected harmonic ${harmonic} (odd) to NOT be systematically suppressed when exciting at the midpoint, got ratio ${ratio.toFixed(4)}`
        );
    }
});

test('picking up at the midpoint suppresses even harmonics but not odd ones (movable modal null, pickup side)', () => {
    const frequency = 220;
    const midpoint = harmonicProfile({ excitationPosition: 0.18, pickupPosition: 0.5 }, frequency, 8);
    const offCenter = harmonicProfile({ excitationPosition: 0.18, pickupPosition: 0.29 }, frequency, 8);

    for (let harmonic = 2; harmonic <= 8; harmonic += 2) {
        const ratio = midpoint[harmonic - 1] / offCenter[harmonic - 1];
        assert.ok(
            ratio < 0.2,
            `expected harmonic ${harmonic} (even) to be suppressed when picking up at the midpoint, got ratio ${ratio.toFixed(4)}`
        );
    }
});

test('pickupType (displacement/velocity/bridgeForce) produces distinct renders', () => {
    const displacement = renderWg2Pluck(SAMPLE_RATE, 42, { frequency: 220, pickupPosition: 0.3, pickupType: 'displacement' }, 0.2, 0);
    const velocity = renderWg2Pluck(SAMPLE_RATE, 42, { frequency: 220, pickupPosition: 0.3, pickupType: 'velocity' }, 0.2, 0);
    const bridgeForce = renderWg2Pluck(SAMPLE_RATE, 42, { frequency: 220, pickupPosition: 0.3, pickupType: 'bridgeForce' }, 0.2, 0);
    assert.notDeepEqual(Array.from(displacement), Array.from(velocity));
    assert.notDeepEqual(Array.from(displacement), Array.from(bridgeForce));
    assert.notDeepEqual(Array.from(velocity), Array.from(bridgeForce));
});

test('excitationType=triangle produces a distinct render from noise/impulse', () => {
    const triangle = renderWg2Pluck(SAMPLE_RATE, 42, { frequency: 220, excitationType: 'triangle' }, 0.1, 0);
    const noise = renderWg2Pluck(SAMPLE_RATE, 42, { frequency: 220, excitationType: 'noise' }, 0.1, 0);
    const impulse = renderWg2Pluck(SAMPLE_RATE, 42, { frequency: 220, excitationType: 'impulse' }, 0.1, 0);
    assert.notDeepEqual(Array.from(triangle), Array.from(noise));
    assert.notDeepEqual(Array.from(triangle), Array.from(impulse));
});

// The regression-coverage gap the interpolation investigation surfaced --
// see wg1Pipeline.test.js's matching tests for the full rationale. WG2's
// own numbers differ from WG1's (it crosses the interpolator twice per
// round trip, not once), so its thresholds are set from WG2's own
// measurements, not copied from WG1's.
test('internal energy is approximately preserved (explicit loss disabled) across most of the supported frequency range', () => {
    // Measured with lagrange3 (the default): fully preserved (no decay to
    // -60dB within 3s) at every frequency except the extreme top of the
    // range, where a real, honest residual remains (measured T60 ~1.4s at
    // 3000Hz) -- still a ~24x improvement over linear's own 3000Hz result
    // (~0.058s -- see soundlib/models/WG2/knowledge/causal-claims.yaml),
    // not a complete fix. The floor at 3000Hz catches a regression back
    // toward that catastrophic linear-era behavior without asserting a
    // standard lagrange3 doesn't actually meet there.
    for (const frequency of [55, 110, 220, 440, 880, 1760]) {
        const measured = internalEnergyT60Seconds(frequency, 2);
        assert.ok(measured === null, `expected internal energy to stay preserved at ${frequency}Hz, but it decayed to -60dB at ${measured}s`);
    }
    const highFreqMeasured = internalEnergyT60Seconds(3000, 2);
    assert.ok(highFreqMeasured === null || highFreqMeasured > 0.8, `expected 3000Hz's known residual energy loss to stay well above linear's catastrophic ~0.06s floor, got ${highFreqMeasured}`);
});

test('fundamental-band T60 stays close to nominal across most of the supported frequency range', () => {
    // Thresholds reflect what's actually measured with lagrange3, not a
    // uniform guess -- excellent (ratio 0.95-1.01) from 55-880Hz, weaker
    // at the top of the range (measured ~0.86 at 1760Hz, ~0.33 at
    // 3000Hz -- a real residual, not a bug; still far better than
    // linear's own ~0.07-0.41 at those frequencies).
    const decayTime = 0.5;
    const expectedT60 = t60(decayTime);
    const minRatioByFrequency = { 55: 0.85, 110: 0.85, 220: 0.85, 440: 0.85, 880: 0.85, 1760: 0.7, 3000: 0.2 };
    for (const [frequency, minRatio] of Object.entries(minRatioByFrequency)) {
        const samples = renderWg2Pluck(SAMPLE_RATE, 7, { frequency: Number(frequency), decayTime }, expectedT60 * 1.4, 0);
        const measured = fundamentalBandT60Seconds(samples, SAMPLE_RATE, Number(frequency));
        assert.ok(measured !== null, `expected the fundamental to decay to -60dB within the render at ${frequency}Hz`);
        const ratio = measured / expectedT60;
        assert.ok(
            ratio > minRatio,
            `expected fundamental-band T60 ratio above ${minRatio} at ${frequency}Hz, got ${ratio.toFixed(3)} (measured ${measured.toFixed(3)}s vs expected ${expectedT60.toFixed(3)}s)`
        );
    }
});
