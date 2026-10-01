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
    const decayTimes = [0.05, 1, 2];
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
    const decayTimes = [0.05, 1, 2];
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

// --- Phase C: DispersionFilter / stiffness ---------------------------
// See soundlib/utilities/DispersionFilter.js and
// soundlib/models/WG2/knowledge/{components,causal-claims}.yaml for the
// design and the measured findings these tests guard.

// Windowed-DFT peak search around a nominal partial frequency -- unlike
// fundamentalBandT60Seconds's fixed-bin Goertzel, this is needed here
// because dispersion deliberately MOVES partials away from their nominal
// n*f0 location; a fixed bin would under-measure a shifted partial.
function peakSearchFrequency(samples, sampleRate, approxHz, searchWidthHz, blockSize = 4096) {
    const magnitudeAt = (hz) => {
        let re = 0;
        let im = 0;
        for (let n = 0; n < blockSize; n++) {
            const angle = (2 * Math.PI * hz * n) / sampleRate;
            re += samples[n] * Math.cos(angle);
            im -= samples[n] * Math.sin(angle);
        }
        return Math.sqrt(re * re + im * im);
    };
    let bestHz = approxHz;
    let bestMag = -Infinity;
    const steps = 400;
    for (let i = 0; i <= steps; i++) {
        const hz = approxHz - searchWidthHz + (2 * searchWidthHz * i) / steps;
        if (hz <= 0) continue;
        const mag = magnitudeAt(hz);
        if (mag > bestMag) {
            bestMag = mag;
            bestHz = hz;
        }
    }
    return bestHz;
}

// Same technique as internalEnergyT60Seconds, extended with a `stiffness`
// argument and the dispersion filter wired into the loop (the compensated
// rail length, matching wg2Processor.js's own per-block computation).
function internalEnergyT60SecondsWithStiffness(frequency, stiffness, seconds, sampleRate = SAMPLE_RATE) {
    const pipeline = buildWg2Pipeline(sampleRate, 7);
    pipeline.dispersionFilter.setStiffness(stiffness, frequency, sampleRate);
    const compensation = pipeline.dispersionFilter.groupDelaySamplesAt(frequency, sampleRate);
    const railLength = Math.max(1, (sampleRate / frequency - compensation) / 2);
    pipeline.waveguide.setRailLength(railLength);
    pipeline.lossFilter.setDecayTime(1e6, sampleRate, pipeline.waveguide.railLength);
    pipeline.exciter.exciteAtPosition(pipeline.waveguide.rightGoing, pipeline.waveguide.leftGoing, pipeline.waveguide.railLength, 0.18, 'impulse', 1.0);

    const frameCount = Math.round(sampleRate * seconds);
    const len = Math.round(pipeline.waveguide.railLength);
    const blockSize = 512;
    let initialRms = null;
    let sumSq = 0;
    for (let i = 0; i < frameCount; i++) {
        pipeline.waveguide.tick(pipeline.nutTermination, pipeline.bridgeTermination, pipeline.lossFilter, pipeline.dispersionFilter);
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

test('stiffness=0 is wired to the same default the rest of the suite already exercises (criterion 1)', () => {
    // Every other test in this file renders without specifying `stiffness`
    // at all, which defaults to WG2_CONFIG.stiffnessDefault (0) and takes
    // DispersionFilter's bypass path -- so the full pre-existing suite
    // passing unchanged (confirmed when this feature was added) already
    // IS the "stiffness=0 reproduces current behavior" regression check.
    // This test just confirms explicit stiffness:0 and omitted stiffness
    // are the literal same code path.
    const explicit = renderWg2Pluck(SAMPLE_RATE, 9, { frequency: 220, stiffness: 0 }, 0.3, 0);
    const omitted = renderWg2Pluck(SAMPLE_RATE, 9, { frequency: 220 }, 0.3, 0);
    assert.deepEqual(Array.from(explicit), Array.from(omitted));
});

test('fundamental stays within tuning tolerance across a stiffness sweep (pitchLocked, criterion 4)', () => {
    const frequency = 220;
    for (const stiffness of [0, 0.1, 0.25, 0.5, 0.75, 1.0]) {
        const samples = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, excitationType: 'impulse', excitationPosition: 0.15, pickupPosition: 0.37, decayTime: 5, stiffness }, 0.3, 0);
        const measured = peakSearchFrequency(samples, SAMPLE_RATE, frequency, frequency * 0.15);
        const errorPercent = Math.abs((100 * (measured - frequency)) / frequency);
        assert.ok(errorPercent < 2, `expected fundamental near ${frequency}Hz at stiffness=${stiffness}, measured ${measured.toFixed(3)}Hz (${errorPercent.toFixed(3)}% error)`);
    }
});

test('increasing stiffness monotonically stretches an upper partial upward (criterion 2)', () => {
    const frequency = 220;
    const partial = 8;
    let previous = -Infinity;
    for (const stiffness of [0, 0.25, 0.5, 0.75, 1.0]) {
        const samples = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, excitationType: 'impulse', excitationPosition: 0.15, pickupPosition: 0.37, decayTime: 5, stiffness }, 0.3, 0);
        const measured = peakSearchFrequency(samples, SAMPLE_RATE, partial * frequency, frequency * 0.5);
        assert.ok(measured > previous, `expected partial ${partial} to stretch monotonically with stiffness, got ${measured.toFixed(2)}Hz at stiffness=${stiffness} (previous ${previous.toFixed(2)}Hz)`);
        previous = measured;
    }
});

test('stretch amount increases with partial number at a fixed stiffness (criterion 3)', () => {
    const frequency = 220;
    const stiffness = 1.0;
    const samples = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, excitationType: 'impulse', excitationPosition: 0.15, pickupPosition: 0.37, decayTime: 5, stiffness }, 0.3, 0);
    const stretch = (n) => peakSearchFrequency(samples, SAMPLE_RATE, n * frequency, frequency * 0.5) - n * frequency;
    const stretch2 = stretch(2);
    const stretch4 = stretch(4);
    const stretch8 = stretch(8);
    assert.ok(stretch4 > stretch2, `expected partial 4 to stretch more than partial 2, got ${stretch4.toFixed(2)}Hz vs ${stretch2.toFixed(2)}Hz`);
    assert.ok(stretch8 > stretch4, `expected partial 8 to stretch more than partial 4, got ${stretch8.toFixed(2)}Hz vs ${stretch4.toFixed(2)}Hz`);
});

test('internal energy is not materially reduced by stiffness alone (explicit loss disabled, criterion 5)', () => {
    // The one known exception (f=3000Hz, stiffness=0) is the ALREADY-
    // DOCUMENTED residual from the interpolation investigation (lagrange3
    // still has a small residual there even with no dispersion at all --
    // see the "internal energy ... across most of the supported frequency
    // range" test above and causal-claims.yaml), not something this
    // feature introduces -- measured separately, not folded into this
    // stiffness-focused assertion, which sticks to frequencies where the
    // pre-existing baseline is already clean.
    for (const frequency of [55, 220, 880]) {
        for (const stiffness of [0, 0.5, 1.0]) {
            const measured = internalEnergyT60SecondsWithStiffness(frequency, stiffness, 1.5);
            assert.ok(measured === null, `expected internal energy preserved at ${frequency}Hz, stiffness=${stiffness}, but it decayed to -60dB at ${measured}s`);
        }
    }
});

test('decayTime continues to scale decay consistently regardless of stiffness (criterion 6, decayTime only -- brightnessDecay does not exist yet)', () => {
    const frequency = 220;
    for (const stiffness of [0, 0.5, 1.0]) {
        const short = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, decayTime: 0.5, stiffness }, t60(0.5) * 1.4, 0);
        const long = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, decayTime: 2.0, stiffness }, t60(2.0) * 1.4, 0);
        const t60short = measuredT60Seconds(short, SAMPLE_RATE);
        const t60long = measuredT60Seconds(long, SAMPLE_RATE);
        assert.ok(t60short !== null && t60long !== null, `expected both decayTime renders to reach -60dB at stiffness=${stiffness}`);
        const ratio = t60long / t60short;
        // decayTime 2.0/0.5 = 4x -- measured ratio stays close to that
        // (~3.9-4.0) regardless of stiffness, confirming the two controls
        // are independent, not that the ratio is exactly 4 (interpolation/
        // dispersion residuals already perturb absolute T60 slightly).
        assert.ok(ratio > 3.5 && ratio < 4.5, `expected decayTime scaling ratio near 4x independent of stiffness=${stiffness}, got ${ratio.toFixed(2)}`);
    }
});

test('measured partial frequencies approximately follow the target f_n = n*f0*sqrt(1+B*n^2) curve (criterion 7)', () => {
    // B_MAX/SLOPE_EXPONENT mirror DispersionFilter.js's own internal
    // mapping -- duplicated here deliberately (not imported) so this test
    // independently recomputes the expected curve rather than trusting
    // the implementation's own numbers circularly.
    const B_MAX = 0.0015;
    const SLOPE_EXPONENT = 2;
    const stiffnessToB = (stiffness) => B_MAX * Math.pow(stiffness, SLOPE_EXPONENT);

    for (const frequency of [110, 220, 880]) {
        for (const stiffness of [0.5, 1.0]) {
            const B = stiffnessToB(stiffness);
            const samples = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, excitationType: 'impulse', excitationPosition: 0.15, pickupPosition: 0.37, decayTime: 5, stiffness }, 0.3, 0);
            const measuredF1 = peakSearchFrequency(samples, SAMPLE_RATE, frequency, frequency * 0.15);
            for (const n of [2, 4, 6]) {
                const theoreticalRatio = (n * Math.sqrt(1 + B * n * n)) / Math.sqrt(1 + B);
                const theoreticalHz = measuredF1 * theoreticalRatio;
                const measuredHz = peakSearchFrequency(samples, SAMPLE_RATE, n * frequency, frequency * 0.4);
                const errorPercent = Math.abs((100 * (measuredHz - theoreticalHz)) / theoreticalHz);
                assert.ok(
                    errorPercent < 2,
                    `expected partial ${n} near the theoretical stiff-string curve at f0=${frequency}Hz stiffness=${stiffness}: theoretical ${theoreticalHz.toFixed(2)}Hz, measured ${measuredHz.toFixed(2)}Hz (${errorPercent.toFixed(2)}% error)`
                );
            }
        }
    }
});

test('stable (finite, bounded) at stiffness=1 across pitch extremes and both common sample rates (criterion 8)', () => {
    for (const sampleRate of [44100, 48000]) {
        for (const frequency of [20, 4000]) {
            const samples = renderWg2Pluck(sampleRate, 7, { frequency, stiffness: 1.0, excitationType: 'noise', decayTime: 2 }, 0.3, 0);
            for (const s of samples) {
                assert.ok(Number.isFinite(s), `expected finite output at sampleRate=${sampleRate} frequency=${frequency}Hz stiffness=1`);
            }
            assert.ok(peak(samples) < 3, `expected bounded output at sampleRate=${sampleRate} frequency=${frequency}Hz stiffness=1, got peak ${peak(samples)}`);
        }
    }
});

test('a live stiffness ramp produces no excess transient beyond the natural pluck onset (criterion 9)', () => {
    // Block-rate stiffness updates (matching every other k-rate parameter
    // in this codebase) -- measured safe: a 0->1 ramp's windowed peak
    // envelope, AFTER the initial pluck onset, stays within a normal
    // waveform-dependent range of a static-stiffness render's own
    // envelope (no sustained multiplicative blowup the way AllpassInterpolator's
    // integer-offset bug once produced during the interpolation
    // investigation). No smoothing/update-rate constraint is needed for v1.
    const frequency = 220;
    const pickupPosition = 0.72; // WG2_CONFIG default, held fixed for comparability
    const sampleRate = SAMPLE_RATE;

    function renderWithStiffnessFn(stiffnessFn, seconds) {
        const pipeline = buildWg2Pipeline(sampleRate, 7);
        pipeline.waveguide.setRailLength(sampleRate / (2 * frequency));
        pipeline.lossFilter.setDecayTime(5, sampleRate, pipeline.waveguide.railLength);
        pipeline.exciter.exciteAtPosition(pipeline.waveguide.rightGoing, pipeline.waveguide.leftGoing, pipeline.waveguide.railLength, 0.15, 'impulse', 1.0);
        const frameCount = Math.round(sampleRate * seconds);
        const blockSize = 128;
        const samples = new Float64Array(frameCount);
        let i = 0;
        while (i < frameCount) {
            const blockLength = Math.min(blockSize, frameCount - i);
            const stiffness = stiffnessFn(i / frameCount);
            pipeline.dispersionFilter.setStiffness(stiffness, frequency, sampleRate);
            const compensation = pipeline.dispersionFilter.groupDelaySamplesAt(frequency, sampleRate);
            pipeline.waveguide.setRailLength(Math.max(1, (sampleRate / frequency - compensation) / 2));
            for (let j = 0; j < blockLength; j++) {
                pipeline.waveguide.tick(pipeline.nutTermination, pipeline.bridgeTermination, pipeline.lossFilter, pipeline.dispersionFilter);
                const observed = pipeline.pickup.observe(pipeline.waveguide, pickupPosition, 'displacement');
                samples[i + j] = pipeline.output.tick(observed);
            }
            i += blockLength;
        }
        return samples;
    }

    function windowedPeakEnvelope(samples, windowSize) {
        const envelope = [];
        for (let start = 0; start + windowSize <= samples.length; start += windowSize) {
            let p = 0;
            for (let i = start; i < start + windowSize; i++) p = Math.max(p, Math.abs(samples[i]));
            envelope.push(p);
        }
        return envelope;
    }

    const windowSize = Math.round(0.01 * sampleRate);
    const staticEnv = windowedPeakEnvelope(renderWithStiffnessFn(() => 0.5, 0.5), windowSize);
    const rampEnv = windowedPeakEnvelope(renderWithStiffnessFn((frac) => Math.min(1, frac), 0.5), windowSize);

    // Skip the first 20ms (the natural pluck onset transient, present
    // regardless of stiffness) and require the ramp's envelope to stay
    // within a generous 3x band of the static-render's own envelope at
    // every later window -- catches a genuine modulation-induced blowup
    // without being sensitive to ordinary beating/modal-phase wobble
    // between two different stiffness trajectories.
    for (let i = 2; i < Math.min(staticEnv.length, rampEnv.length); i++) {
        const ratio = rampEnv[i] / (staticEnv[i] || 1e-9);
        assert.ok(ratio < 3, `expected no excess transient during a live stiffness ramp at window ${i * 10}ms, got ratio ${ratio.toFixed(2)}`);
    }
});

test('dispersion adds only modest CPU cost relative to bypassed (criterion 10)', () => {
    const sampleCount = 500000; // keep this test itself fast; the measured ratio doesn't depend on render length
    const seconds = sampleCount / SAMPLE_RATE;
    const timeRender = (stiffness) => {
        const start = process.hrtime.bigint();
        renderWg2Pluck(SAMPLE_RATE, 7, { frequency: 220, stiffness }, seconds, 0);
        return Number(process.hrtime.bigint() - start) / 1e6;
    };
    // Warm up once (JIT) before timing, same discipline as the
    // interpolator comparison's own CPU measurement.
    timeRender(0);
    timeRender(0.8);
    const bypassedMs = timeRender(0);
    const activeMs = timeRender(0.8);
    const ratio = activeMs / bypassedMs;
    // Measured ~1.1x on real hardware during implementation; generous 3x
    // ceiling here so this test isn't flaky on slower/shared CI hardware
    // while still catching a real regression (e.g. an accidental O(n^2)).
    assert.ok(ratio < 3, `expected dispersion's CPU cost to stay modest relative to bypassed, got ${ratio.toFixed(2)}x (bypassed ${bypassedMs.toFixed(1)}ms, active ${activeMs.toFixed(1)}ms)`);
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
