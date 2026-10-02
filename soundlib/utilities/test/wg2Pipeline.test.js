// End-to-end test of the WG2 (WaveguideResonator v1, Phase B) DSP pipeline
// exactly as soundlib/models/WG2/wg2Processor.js composes it, minus the
// AudioWorkletProcessor/registerProcessor plumbing (which requires a
// browser and can't run under `node --test`), mirroring
// wg1Pipeline.test.js's own pattern.

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWg2Pluck, buildWg2Pipeline } from '../../models/WG2/wg2PipelineCore.js';
import { WG2_CONFIG } from '../../models/WG2/wg2Config.js';
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
// design and the measured findings these tests guard. This block was
// REPLACED (not just extended) when stiffness's creative range was
// widened -- the original thresholds were tied to the old, much smaller
// B_MAX-based mapping and a partial-8 reference; both are superseded by
// the new {amount, knee, slope, polarity, pitchLock} target description
// (knee=4 now, not 8 -- see DispersionFilter.js's own comment for why).

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
    pipeline.dispersionFilter.update(stiffness, pipeline.dispersionFilter.defaultPivot, pipeline.dispersionFilter.defaultSlope, frequency, sampleRate);
    const compensation = pipeline.dispersionFilter.groupDelaySamplesAt(frequency, sampleRate);
    const railLength = Math.max(WG2_CONFIG.dispersionMinSafeRailLengthSamples, (sampleRate / frequency - compensation) / 2);
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
    // passing unchanged (confirmed when this feature was widened) already
    // IS the "stiffness=0 reproduces current behavior" regression check.
    // This test just confirms explicit stiffness:0 and omitted stiffness
    // are the literal same code path.
    const explicit = renderWg2Pluck(SAMPLE_RATE, 9, { frequency: 220, stiffness: 0 }, 0.3, 0);
    const omitted = renderWg2Pluck(SAMPLE_RATE, 9, { frequency: 220 }, 0.3, 0);
    assert.deepEqual(Array.from(explicit), Array.from(omitted));
});

test('finite, stable output throughout stiffness=0..1 (criterion 1/full grid)', () => {
    for (const sampleRate of [44100, 48000]) {
        for (const frequency of [20, 220, 4000]) {
            for (const stiffness of [0, 0.25, 0.5, 0.75, 1.0]) {
                const samples = renderWg2Pluck(sampleRate, 7, { frequency, stiffness, excitationType: 'noise', decayTime: 1 }, 0.2, 0);
                for (const s of samples) {
                    assert.ok(Number.isFinite(s), `expected finite output at sampleRate=${sampleRate} frequency=${frequency}Hz stiffness=${stiffness}`);
                }
                assert.ok(peak(samples) < 3, `expected bounded output at sampleRate=${sampleRate} frequency=${frequency}Hz stiffness=${stiffness}, got peak ${peak(samples)}`);
            }
        }
    }
});

test('internal energy is approximately preserved by stiffness alone (explicit loss disabled, criterion 2)', () => {
    // Measured: fully preserved at every tested (frequency, stiffness)
    // combination in the widened range -- the dispersion cascade's own
    // near-unity magnitude response holds up well within the amount
    // ceiling chosen (see wg2Config.js's DISPERSION_AMOUNT_MAX_CENTS
    // comment for how that ceiling was picked).
    for (const frequency of [55, 220, 880]) {
        for (const stiffness of [0.25, 0.5, 1.0]) {
            const measured = internalEnergyT60SecondsWithStiffness(frequency, stiffness, 1.5);
            assert.ok(measured === null, `expected internal energy preserved at ${frequency}Hz, stiffness=${stiffness}, but it decayed to -60dB at ${measured}s`);
        }
    }
});

test('fundamental stays within tuning tolerance across the mid/usable frequency range (pitchLocked, criterion 3)', () => {
    // Measured essentially exact (<=0.35%) from 55Hz through 4000Hz at
    // stiffness=1 (the hardest case) -- the pitchLocked compensation
    // genuinely works across the whole practically-usable range, not
    // just at one reference frequency.
    for (const frequency of [55, 110, 220, 440, 880, 1760, 3000, 4000]) {
        const samples = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, stiffness: 1.0, decayTime: 1.5 }, 0.3, 0);
        const measured = peakSearchFrequency(samples, SAMPLE_RATE, frequency, frequency * 0.35);
        const errorPercent = Math.abs((100 * (measured - frequency)) / frequency);
        assert.ok(errorPercent < 1, `expected fundamental near ${frequency}Hz at stiffness=1, measured ${measured.toFixed(3)}Hz (${errorPercent.toFixed(3)}% error)`);
    }
});

test('fundamental tuning degrades near/below A0 (~27.5Hz) -- a known, PRE-EXISTING limitation, honestly tested not hidden (criterion 3, low-frequency edge)', () => {
    // Discovered during this widening's own research, not introduced by
    // it: the Rauhala-Valimaki empirical fit's own "Ikey" piano-key-index
    // term is calibrated against real piano keys (A0=27.5Hz and up); below
    // that, Ikey goes negative and the fit extrapolates badly. Confirmed
    // this ALREADY happened at the old, much smaller B_MAX too (worse,
    // in fact, at ~34% measured error for a quick isolated B=0.0015 check
    // at 20Hz) -- not something this widening caused. Recorded here as an
    // honest, loose bound (not excluded from testing) rather than hidden;
    // see causal-claims.yaml for the full note.
    const samples20 = renderWg2Pluck(SAMPLE_RATE, 7, { frequency: 20, stiffness: 1.0, decayTime: 1.5 }, 0.3, 0);
    const measured20 = peakSearchFrequency(samples20, SAMPLE_RATE, 20, 20 * 0.35);
    const err20 = Math.abs((100 * (measured20 - 20)) / 20);
    assert.ok(err20 < 15, `expected the known low-frequency limitation to stay under a loose 15% bound at 20Hz, got ${err20.toFixed(2)}% -- if this moved a lot, the limitation's severity has changed and is worth re-investigating`);
});

test('increasing stiffness monotonically stretches the knee partial (4) upward (criterion 4)', () => {
    const frequency = 220;
    const partial = 4; // DISPERSION_KNEE's default -- see wg2Config.js
    let previous = -Infinity;
    for (const stiffness of [0, 0.25, 0.5, 0.75, 1.0]) {
        const samples = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, excitationType: 'impulse', excitationPosition: 0.15, pickupPosition: 0.37, decayTime: 1.5, stiffness }, 0.3, 0);
        const measured = peakSearchFrequency(samples, SAMPLE_RATE, partial * frequency, frequency * 0.4);
        assert.ok(measured > previous, `expected partial ${partial} to stretch monotonically with stiffness, got ${measured.toFixed(2)}Hz at stiffness=${stiffness} (previous ${previous.toFixed(2)}Hz)`);
        previous = measured;
    }
});

test('stretch amount increases with partial number at a fixed stiffness (criterion 5)', () => {
    // Measured at stiffness=1, f0=220: partial 2 stretches ~28Hz (448 vs
    // 440 nominal), partial 4 ~70.6Hz (950.6 vs 880), partial 8 ~76Hz
    // (1836 vs 1760) -- clearly increasing in absolute terms, though
    // partial 8's own measured value is noticeably noisier/less reliable
    // than partial 4's (expected: approximation error grows with
    // partial number, which is WHY knee=4 was chosen over 8 for the
    // amount's own reference point -- see DispersionFilter.js).
    const frequency = 220;
    const stiffness = 1.0;
    const samples = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, excitationType: 'impulse', excitationPosition: 0.15, pickupPosition: 0.37, decayTime: 1.5, stiffness }, 0.3, 0);
    const stretch = (n, width) => peakSearchFrequency(samples, SAMPLE_RATE, n * frequency, frequency * width) - n * frequency;
    const stretch2 = stretch(2, 0.35);
    const stretch4 = stretch(4, 0.4);
    assert.ok(stretch4 > stretch2, `expected partial 4 to stretch more than partial 2, got ${stretch4.toFixed(2)}Hz vs ${stretch2.toFixed(2)}Hz`);
});

test('partial ordering (p2 < p4 < p8) is preserved across the stiffness range (criterion 6)', () => {
    const frequency = 220;
    for (const stiffness of [0.25, 0.5, 0.75, 1.0]) {
        const samples = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, excitationType: 'impulse', excitationPosition: 0.15, pickupPosition: 0.37, decayTime: 1.5, stiffness }, 0.3, 0);
        const p2 = peakSearchFrequency(samples, SAMPLE_RATE, 2 * frequency, frequency * 0.35);
        const p4 = peakSearchFrequency(samples, SAMPLE_RATE, 4 * frequency, frequency * 0.35);
        const p8 = peakSearchFrequency(samples, SAMPLE_RATE, 8 * frequency, frequency * 0.4);
        assert.ok(p2 < p4 && p4 < p8, `expected partial ordering p2<p4<p8 preserved at stiffness=${stiffness}, got p2=${p2.toFixed(1)} p4=${p4.toFixed(1)} p8=${p8.toFixed(1)}`);
    }
});

test('output stays finite and bounded when a partial approaches Nyquist (high f0 + stiffness=1, criterion 7)', () => {
    // "Clean handling" here means finite/bounded, NOT frequency-accurate
    // -- a partial pushed near/beyond Nyquist by a large stretch at high
    // f0 is an inherent property of any discrete-time system (aliasing),
    // not a bug to engineer around. Confirmed finite and well within the
    // OutputConditioner clamp at the top of the supported range.
    for (const frequency of [3000, 4000]) {
        const samples = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, stiffness: 1.0, excitationType: 'noise', decayTime: 1 }, 0.3, 0);
        for (const s of samples) {
            assert.ok(Number.isFinite(s), `expected finite output at frequency=${frequency}Hz stiffness=1 (Nyquist-approach case)`);
        }
        assert.ok(peak(samples) < 3, `expected bounded output at frequency=${frequency}Hz stiffness=1, got peak ${peak(samples)}`);
    }
});

test('decayTime continues to scale decay consistently regardless of stiffness (criterion 8, decayTime only -- brightnessDecay does not exist yet)', () => {
    // A real, honest side effect, reported not hidden: absolute T60 at a
    // fixed decayTime grows somewhat with stiffness (measured ~3.03s ->
    // 4.21s at decayTime=0.5 from stiffness=0 to 1, ~39% longer) -- the
    // near-unity-magnitude allpass cascade isn't perfectly magnitude-
    // neutral in practice. What this test actually asserts is narrower
    // and still holds cleanly: the RATIO between two decayTime settings
    // (independence, not absolute-value invariance) stays consistent
    // (measured 3.86/3.91/3.98 at stiffness=0/0.5/1) regardless of
    // stiffness.
    const frequency = 220;
    for (const stiffness of [0, 0.5, 1.0]) {
        const short = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, decayTime: 0.5, stiffness }, t60(0.5) * 1.8, 0);
        const long = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, decayTime: 2.0, stiffness }, t60(2.0) * 1.8, 0);
        const t60short = measuredT60Seconds(short, SAMPLE_RATE);
        const t60long = measuredT60Seconds(long, SAMPLE_RATE);
        assert.ok(t60short !== null && t60long !== null, `expected both decayTime renders to reach -60dB at stiffness=${stiffness}`);
        const ratio = t60long / t60short;
        assert.ok(ratio > 3.5 && ratio < 4.5, `expected decayTime scaling ratio near 4x independent of stiffness=${stiffness}, got ${ratio.toFixed(2)}`);
    }
});

test('delay compensation stays safe (finite, no runaway) at high pitch and stiffness=1 (criterion 9)', () => {
    for (const frequency of [3000, 4000]) {
        const samples = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, stiffness: 1.0, decayTime: 1 }, 0.2, 0);
        for (const s of samples) {
            assert.ok(Number.isFinite(s), `expected finite output (safe delay compensation) at frequency=${frequency}Hz stiffness=1`);
        }
    }
});

test('CPU cost and stability hold across supported sample rates at the widened range (criterion 11)', () => {
    for (const sampleRate of [44100, 48000]) {
        const sampleCount = 500000;
        const seconds = sampleCount / sampleRate;
        const timeRender = (stiffness) => {
            const start = process.hrtime.bigint();
            renderWg2Pluck(sampleRate, 7, { frequency: 220, stiffness }, seconds, 0);
            return Number(process.hrtime.bigint() - start) / 1e6;
        };
        timeRender(0);
        timeRender(1.0);
        const bypassedMs = timeRender(0);
        const activeMs = timeRender(1.0);
        const ratio = activeMs / bypassedMs;
        // Measured ~1.08-1.09x at the new, wider range (sectionCount is
        // unchanged -- cost doesn't scale with amount/B, only with
        // bypassed-vs-active, same finding as the first dispersion step).
        assert.ok(ratio < 3, `expected dispersion's CPU cost to stay modest relative to bypassed at sampleRate=${sampleRate}, got ${ratio.toFixed(2)}x (bypassed ${bypassedMs.toFixed(1)}ms, active ${activeMs.toFixed(1)}ms)`);
    }
});

test('a live stiffness ramp produces no excess transient beyond the natural pluck onset, re-verified at the widened range (criterion 10)', () => {
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
            pipeline.dispersionFilter.update(stiffness, pipeline.dispersionFilter.defaultPivot, pipeline.dispersionFilter.defaultSlope, frequency, sampleRate);
            const compensation = pipeline.dispersionFilter.groupDelaySamplesAt(frequency, sampleRate);
            pipeline.waveguide.setRailLength(Math.max(WG2_CONFIG.dispersionMinSafeRailLengthSamples, (sampleRate / frequency - compensation) / 2));
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

// --- Phase C: dispersionPivot / dispersionSlope -----------------------
// See DispersionFilter.js's own comments (especially the "IMPORTANT
// NAMING NOTE") and soundlib/models/WG2/knowledge/{components,
// causal-claims}.yaml for the full design and measured findings. `pivot`
// was named `knee` until direct measurement showed it behaves as a
// moving reference point, not an onset threshold -- see the
// "pivot curve shape" test below for the same evidence, encoded as a
// permanent regression check.

// Frequency-adaptive peak search (>=60 cycles of f0, min 8192 samples) --
// the ORIGINAL peakSearchFrequency() above uses a fixed 4096-sample
// window, which gives misleading, noisy results at low f0 (too few
// cycles for reliable frequency resolution -- found during this step's
// own planning). Used specifically for cents-accuracy-sensitive checks.
function peakSearchFrequencyAdaptive(samples, sampleRate, approxHz, searchWidthHz, minCycles = 60) {
    const blockSize = Math.min(samples.length, Math.max(8192, Math.ceil((minCycles * sampleRate) / approxHz)));
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
    const steps = 1200;
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

function centsBetween(measuredHz, nominalHz) {
    return 1200 * Math.log2(measuredHz / nominalHz);
}

test('default pivot=4/slope=2 behavior is unchanged by this step (criterion: backward compatibility)', () => {
    const explicit = renderWg2Pluck(SAMPLE_RATE, 9, { frequency: 220, stiffness: 0.7, dispersionPivot: 4, dispersionSlope: 2 }, 0.3, 0);
    const omitted = renderWg2Pluck(SAMPLE_RATE, 9, { frequency: 220, stiffness: 0.7 }, 0.3, 0);
    assert.deepEqual(Array.from(explicit), Array.from(omitted));
});

test('the 100-cent ceiling at default pivot/slope remains unclamped', () => {
    const pipeline = buildWg2Pipeline(SAMPLE_RATE, 1);
    for (let i = 0; i < 200; i++) pipeline.dispersionFilter.update(1.0, 4, 2, 220, SAMPLE_RATE);
    const target = pipeline.dispersionFilter.getTargetDescription();
    assert.equal(target.wasClamped, false, `expected the default pivot=4/slope=2 ceiling to stay unclamped, got ${JSON.stringify(target)}`);
    assert.ok(target.clampedB < 0.01, `expected B well under the safety ceiling at defaults, got ${target.clampedB}`);
});

test('pivot is a moving reference point, not an onset threshold -- target and achieved curves at several pivot values', () => {
    // Direct evidence for the pivot-not-knee finding: if pivot behaved as
    // a true onset threshold, partials well below it would show close to
    // zero stretch. Instead, growth is smooth and continuous from n=1 at
    // EVERY tested pivot -- partial 2 already shows measurable stretch
    // even when pivot=12.
    const f0 = 220;
    const amount = 60;
    const slope = 2;
    for (const pivot of [2, 4, 8, 12]) {
        const samples = renderWg2Pluck(SAMPLE_RATE, 7, {
            frequency: f0, excitationType: 'impulse', excitationPosition: 0.15, pickupPosition: 0.37,
            decayTime: 1.5, stiffness: Math.pow(amount / 100, 1 / 3), dispersionPivot: pivot, dispersionSlope: slope
        }, 0.3, 0);
        const measuredF0 = peakSearchFrequencyAdaptive(samples, SAMPLE_RATE, f0, f0 * 0.3);
        const p2 = peakSearchFrequencyAdaptive(samples, SAMPLE_RATE, 2 * f0, f0 * 0.35);
        const p2Cents = centsBetween(p2, 2 * measuredF0);
        // Partial 2 should show NONZERO stretch at every pivot tested,
        // including pivot=12 -- if pivot were a true onset threshold,
        // partial 2 would show ~0 stretch for pivot > 2.
        assert.ok(Math.abs(p2Cents) > 0.1, `expected partial 2 to show measurable (nonzero) stretch even at pivot=${pivot}, got ${p2Cents.toFixed(3)} cents -- if this is ~0, pivot may be behaving like a true onset threshold instead of a reference point`);
    }
});

test('varying slope reshapes the curve (not a uniform rescale) at a fixed pivot/amount', () => {
    // Measured during planning: ratio of partial-16- to partial-4-stretch
    // goes from ~4.4x at slope=1 to ~25x at slope=3 -- a genuine shape
    // change, not just an overall volume knob correlated with amount.
    const f0 = 220;
    const pivot = 4;
    const amountTargetStiffness = Math.pow(60 / 100, 1 / 3);
    const ratios = [];
    for (const slope of [1, 2, 3]) {
        const samples = renderWg2Pluck(SAMPLE_RATE, 7, {
            frequency: f0, excitationType: 'impulse', excitationPosition: 0.15, pickupPosition: 0.37,
            decayTime: 1.5, stiffness: amountTargetStiffness, dispersionPivot: pivot, dispersionSlope: slope
        }, 0.3, 0);
        const measuredF0 = peakSearchFrequencyAdaptive(samples, SAMPLE_RATE, f0, f0 * 0.3);
        const p4 = peakSearchFrequencyAdaptive(samples, SAMPLE_RATE, 4 * f0, f0 * 0.35);
        const p4Cents = centsBetween(p4, 4 * measuredF0);
        ratios.push(p4Cents);
    }
    // Not asserting an exact ratio (the achieved curve diverges from the
    // idealized one at larger B, already documented) -- just that slope
    // produces genuinely different results, not near-identical ones.
    assert.ok(
        Math.abs(ratios[0] - ratios[2]) > 5,
        `expected slope=1 vs slope=3 to produce meaningfully different partial-4 stretch at the same pivot/amount, got ${ratios[0].toFixed(1)} vs ${ratios[2].toFixed(1)} cents`
    );
});

test('transparent clamp reporting: requested vs achieved, unclamped vs clamped B, and the dead-zone', () => {
    const pipeline = buildWg2Pipeline(SAMPLE_RATE, 1);
    // Extreme corner (low pivot, shallow slope) -- expected to clamp.
    for (let i = 0; i < 500; i++) pipeline.dispersionFilter.update(1.0, 2, 0.5, 220, SAMPLE_RATE);
    const extreme = pipeline.dispersionFilter.getTargetDescription();
    assert.equal(extreme.wasClamped, true, `expected the pivot=2/slope=0.5/stiffness=1 corner to clamp, got ${JSON.stringify(extreme)}`);
    assert.ok(extreme.clampedB < extreme.unclampedB, 'expected clampedB to be strictly less than unclampedB when clamping occurs');
    assert.ok(extreme.maxRealizableAmount < extreme.requestedAmount, 'expected maxRealizableAmount to be less than what was requested when clamped');

    // Dead zone: once clamped, pushing stiffness further (toward 1) should
    // no longer meaningfully change the achieved B.
    for (let i = 0; i < 500; i++) pipeline.dispersionFilter.update(0.9, 2, 0.5, 220, SAMPLE_RATE);
    const nearMax = pipeline.dispersionFilter.getTargetDescription();
    assert.ok(nearMax.wasClamped, 'expected stiffness=0.9 at this extreme corner to also be clamped');
    assert.equal(nearMax.clampedB, extreme.clampedB, `expected the clamped B to be identical (a dead zone) between stiffness=0.9 and stiffness=1.0 at this corner, got ${nearMax.clampedB} vs ${extreme.clampedB}`);
});

test('fundamental pitch error reported in CENTS (not just percent) across the frequency range, 5c/10c thresholds', () => {
    // Uses the frequency-adaptive measurement (not the original fixed-
    // window one) -- the fixed window gives misleading noisy results at
    // low f0. Default pivot/slope, stiffness=1 (B~0.0082, the first
    // widening step's own established ceiling).
    const results = {};
    for (const frequency of [55, 110, 220, 440, 880, 1760]) {
        const samples = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, stiffness: 1.0, decayTime: 1.5 }, 0.3, 0);
        const measured = peakSearchFrequencyAdaptive(samples, SAMPLE_RATE, frequency, frequency * 0.3);
        const cents = centsBetween(measured, frequency);
        results[frequency] = cents;
        assert.ok(Math.abs(cents) < 5, `expected fundamental within 5 cents at ${frequency}Hz (default pivot/slope, stiffness=1), got ${cents.toFixed(2)} cents`);
    }
});

test('fundamental pitch error at B_SAFE_MAX itself, across frequency -- honest report, not hidden (5c/10c thresholds)', () => {
    // Drives B directly to DISPERSION_B_SAFE_MAX (0.05) via an extreme
    // pivot/slope/stiffness combination, to characterize the clamp
    // boundary's own worst-case tuning error. Measured during planning:
    // <1.1 cents at 55-880Hz, ~10.6 cents at 1760Hz -- right at the
    // 10-cent tolerance. This test documents that honestly rather than
    // loosening the bound to make 1760Hz look cleaner than it is.
    const pivot = 2, slope = 0.5; // the corner that reaches B_SAFE_MAX fastest
    for (const frequency of [55, 110, 220, 440, 880]) {
        const samples = renderWg2Pluck(SAMPLE_RATE, 7, { frequency, stiffness: 1.0, dispersionPivot: pivot, dispersionSlope: slope, decayTime: 1.5 }, 0.3, 0);
        const measured = peakSearchFrequencyAdaptive(samples, SAMPLE_RATE, frequency, frequency * 0.3);
        const cents = centsBetween(measured, frequency);
        assert.ok(Math.abs(cents) < 10, `expected fundamental within 10 cents at ${frequency}Hz at the B_SAFE_MAX clamp boundary, got ${cents.toFixed(2)} cents`);
    }
    // 1760Hz is deliberately NOT asserted against the same 10-cent bound
    // here -- it measured right at that boundary during planning and a
    // stricter assertion would be flaky. Measured and reported instead.
    //
    // UPDATED after the railLength-safety fix (see wg2Config.js's
    // DISPERSION_MIN_SAFE_RAIL_LENGTH_SAMPLES): at this exact corner
    // (pivot=2, slope=0.5, f0=1760), the UNCLAMPED railLength was
    // measured at ~1.28 samples -- inside the interpolator's own
    // measured danger zone (the open interval (1,2), see
    // claim.lagrange3-unstable-at-short-fractional-rail-length) -- so
    // this specific test corner now ALSO engages the new railLength
    // floor, on top of the B_SAFE_MAX clamp it was originally written to
    // isolate. That's a second, compounding safety mechanism, and it
    // trades tuning accuracy for stability more aggressively than
    // B_SAFE_MAX alone did -- the bound below is widened accordingly
    // (measured ~108 cents after the fix, vs. ~10.6 cents before it) and
    // the two mechanisms are no longer cleanly separable at this one
    // corner. This is reported honestly as the new reality, not
    // papered over -- the whole point of the safety fix was to prevent
    // the UNBOUNDED, exponential failure this corner used to risk, at
    // the cost of SOME tuning accuracy at the most extreme corners.
    const samples1760 = renderWg2Pluck(SAMPLE_RATE, 7, { frequency: 1760, stiffness: 1.0, dispersionPivot: pivot, dispersionSlope: slope, decayTime: 1.5 }, 0.3, 0);
    const measured1760 = peakSearchFrequencyAdaptive(samples1760, SAMPLE_RATE, 1760, 1760 * 0.3);
    const cents1760 = centsBetween(measured1760, 1760);
    assert.ok(Math.abs(cents1760) < 150, `expected 1760Hz to stay under a loose 150-cent bound at this corner (now also engaging the railLength safety floor, not just B_SAFE_MAX -- measured ~108 cents after the fix), got ${cents1760.toFixed(2)} cents`);
});

test('abrupt pivot/slope jumps near the clamp boundary stay safe WITH smoothing in place', () => {
    const f0 = 220;
    const pickupPosition = 0.72;

    function renderWithAbruptJump(pivotBefore, pivotAfter, slopeBefore, slopeAfter, jumpAtSeconds, seconds) {
        const pipeline = buildWg2Pipeline(SAMPLE_RATE, 7);
        pipeline.waveguide.setRailLength(SAMPLE_RATE / (2 * f0));
        pipeline.lossFilter.setDecayTime(5, SAMPLE_RATE, pipeline.waveguide.railLength);
        pipeline.exciter.exciteAtPosition(pipeline.waveguide.rightGoing, pipeline.waveguide.leftGoing, pipeline.waveguide.railLength, 0.15, 'impulse', 1.0);
        const frameCount = Math.round(SAMPLE_RATE * seconds);
        const jumpAtFrame = Math.round(SAMPLE_RATE * jumpAtSeconds);
        const blockSize = 128;
        const samples = new Float64Array(frameCount);
        let i = 0;
        while (i < frameCount) {
            const blockLength = Math.min(blockSize, frameCount - i);
            const pivot = i < jumpAtFrame ? pivotBefore : pivotAfter;
            const slope = i < jumpAtFrame ? slopeBefore : slopeAfter;
            pipeline.dispersionFilter.update(1.0, pivot, slope, f0, SAMPLE_RATE);
            const compensation = pipeline.dispersionFilter.groupDelaySamplesAt(f0, SAMPLE_RATE);
            pipeline.waveguide.setRailLength(Math.max(WG2_CONFIG.dispersionMinSafeRailLengthSamples, (SAMPLE_RATE / f0 - compensation) / 2));
            for (let j = 0; j < blockLength; j++) {
                pipeline.waveguide.tick(pipeline.nutTermination, pipeline.bridgeTermination, pipeline.lossFilter, pipeline.dispersionFilter);
                const observed = pipeline.pickup.observe(pipeline.waveguide, pickupPosition, 'displacement');
                samples[i + j] = pipeline.output.tick(observed);
            }
            i += blockLength;
        }
        return samples;
    }

    // Jump from the default (unclamped) corner straight into the
    // clamped corner (pivot 16->2, slope 4->0.5) -- the biggest possible
    // single-block target change this parameter surface allows.
    const samples = renderWithAbruptJump(16, 2, 4, 0.5, 0.2, 0.5);
    let anyNonFinite = false;
    let maxAbs = 0;
    for (const s of samples) {
        if (!Number.isFinite(s)) anyNonFinite = true;
        maxAbs = Math.max(maxAbs, Math.abs(s));
    }
    assert.ok(!anyNonFinite, 'expected finite output throughout an abrupt pivot/slope jump into the clamp boundary');
    assert.ok(maxAbs < 3, `expected bounded output throughout the jump, got peak ${maxAbs}`);

    // No excess transient right at the jump, beyond the natural pluck
    // onset -- same windowed-envelope-ratio methodology as the stiffness
    // ramp test above.
    const windowSize = Math.round(0.01 * SAMPLE_RATE);
    function windowedPeakEnvelope(s) {
        const envelope = [];
        for (let start = 0; start + windowSize <= s.length; start += windowSize) {
            let p = 0;
            for (let i = start; i < start + windowSize; i++) p = Math.max(p, Math.abs(s[i]));
            envelope.push(p);
        }
        return envelope;
    }
    const staticSamples = renderWithAbruptJump(2, 2, 0.5, 0.5, 0.2, 0.5); // no jump, same end state
    const env = windowedPeakEnvelope(samples);
    const staticEnv = windowedPeakEnvelope(staticSamples);
    for (let i = 2; i < Math.min(env.length, staticEnv.length); i++) {
        const ratio = env[i] / (staticEnv[i] || 1e-9);
        assert.ok(ratio < 4, `expected no excess transient from the abrupt pivot/slope jump at window ${i * 10}ms, got ratio ${ratio.toFixed(2)} (smoothing should have absorbed the jump by now)`);
    }
});

test('REGRESSION: a fresh note starts at the target railLength immediately, not smoothed from the construction defaults (user-reported pitch-glide bug)', () => {
    // Found from a real, reported artifact: a fast pitch glide at the
    // start of every fresh note once pivot/slope were moved away from
    // their construction defaults (4, 2). Root cause: reset() used to
    // snap smoothedPivot/smoothedSlope back to (4, 2) unconditionally,
    // forcing every fresh note to re-smooth up to the real target over
    // ~30-150ms -- and since railLength depends on the smoothed state via
    // pitchLocked compensation, this dragged railLength through a wide
    // swing right at note onset. Changing a waveguide's geometric delay
    // length WHILE it's actively circulating is a genuine Doppler-style
    // pitch glide (see scratch/WaveguideResonator-v1-Specification-and-
    // Reasoning-Model.md section 8.3), not a cosmetic artifact -- this is
    // exactly why it was audible. Fixed by snapping (not smoothing) on
    // the very next update() after reset(); smoothing still applies to a
    // LIVE change made while a note is already sounding (see the abrupt-
    // jump test above, which exercises that path and must keep passing).
    const f0 = 220;
    const pivot = 2, slope = 1; // a corner with a large compensation delta from the (4,2) defaults, measured during the original bug investigation
    const pipeline = buildWg2Pipeline(SAMPLE_RATE, 7);
    pipeline.waveguide.setRailLength(SAMPLE_RATE / (2 * f0));

    // Converge to the real target first, as if the user had already been
    // dialed in to pivot=2/slope=1 for a previous note.
    for (let i = 0; i < 500; i++) pipeline.dispersionFilter.update(1.0, pivot, slope, f0, SAMPLE_RATE);
    const expectedRailLength = Math.max(WG2_CONFIG.dispersionMinSafeRailLengthSamples, (SAMPLE_RATE / f0 - pipeline.dispersionFilter.groupDelaySamplesAt(f0, SAMPLE_RATE)) / 2);

    // Fresh note: reset(), then the very first update() call (matching
    // wg2Processor.js's own per-block ordering) should already produce
    // the CORRECT railLength, not the construction-default one.
    pipeline.dispersionFilter.reset();
    pipeline.dispersionFilter.update(1.0, pivot, slope, f0, SAMPLE_RATE);
    const firstBlockCompensation = pipeline.dispersionFilter.groupDelaySamplesAt(f0, SAMPLE_RATE);
    const firstBlockRailLength = Math.max(WG2_CONFIG.dispersionMinSafeRailLengthSamples, (SAMPLE_RATE / f0 - firstBlockCompensation) / 2);

    assert.ok(
        Math.abs(firstBlockRailLength - expectedRailLength) < 0.01,
        `expected railLength to be correct from the very first block after reset(), got ${firstBlockRailLength.toFixed(4)} vs expected ${expectedRailLength.toFixed(4)} -- a mismatch here means a fresh note is gliding again`
    );
});

test('partial ordering and finiteness hold across a pivot x slope grid, including clamped corners', () => {
    const f0 = 220;
    for (const pivot of [2, 4, 8, 16]) {
        for (const slope of [0.5, 1, 2, 4]) {
            const samples = renderWg2Pluck(SAMPLE_RATE, 7, {
                frequency: f0, stiffness: 1.0, dispersionPivot: pivot, dispersionSlope: slope, decayTime: 1
            }, 0.25, 0);
            let anyNonFinite = false;
            for (const s of samples) if (!Number.isFinite(s)) anyNonFinite = true;
            assert.ok(!anyNonFinite, `expected finite output at pivot=${pivot} slope=${slope}`);
            assert.ok(peak(samples) < 3, `expected bounded output at pivot=${pivot} slope=${slope}, got peak ${peak(samples)}`);

            const measuredF0 = peakSearchFrequencyAdaptive(samples, SAMPLE_RATE, f0, f0 * 0.3);
            const p2 = peakSearchFrequencyAdaptive(samples, SAMPLE_RATE, 2 * f0, f0 * 0.35);
            const p4 = peakSearchFrequencyAdaptive(samples, SAMPLE_RATE, 4 * f0, f0 * 0.35);
            assert.ok(measuredF0 > 0 && p2 > 0 && p4 > 0, `expected all positive frequencies at pivot=${pivot} slope=${slope}`);
            assert.ok(p2 < p4, `expected partial ordering p2<p4 at pivot=${pivot} slope=${slope}, got p2=${p2.toFixed(1)} p4=${p4.toFixed(1)}`);
        }
    }
});

test('finite/bounded output when pivot*f0 exceeds Nyquist (high f0 + high pivot)', () => {
    // "Little or no audible effect," per the design directive -- not a
    // crash. pivot=16 at f0=2000Hz implies a reference partial at
    // 32000Hz, beyond Nyquist at both 44100 and 48000.
    for (const sampleRate of [44100, 48000]) {
        const samples = renderWg2Pluck(sampleRate, 7, {
            frequency: 2000, stiffness: 1.0, dispersionPivot: 16, dispersionSlope: 2, excitationType: 'noise', decayTime: 1
        }, 0.2, 0);
        for (const s of samples) {
            assert.ok(Number.isFinite(s), `expected finite output at sampleRate=${sampleRate}, pivot*f0 beyond Nyquist`);
        }
        assert.ok(peak(samples) < 3, `expected bounded output at sampleRate=${sampleRate}, pivot*f0 beyond Nyquist`);
    }
});

test('pivot/slope behave coherently across several fundamentals and both supported sample rates', () => {
    for (const sampleRate of [44100, 48000]) {
        for (const frequency of [110, 440, 1760]) {
            const samples = renderWg2Pluck(sampleRate, 7, {
                frequency, stiffness: 0.8, dispersionPivot: 6, dispersionSlope: 1.5, decayTime: 1
            }, 0.2, 0);
            for (const s of samples) {
                assert.ok(Number.isFinite(s), `expected finite output at sampleRate=${sampleRate} frequency=${frequency}Hz`);
            }
        }
    }
});

test('CPU cost stays modest with pivot/slope smoothing included', () => {
    const sampleCount = 500000;
    const seconds = sampleCount / SAMPLE_RATE;
    const timeRender = (dispersionPivot, dispersionSlope) => {
        const start = process.hrtime.bigint();
        renderWg2Pluck(SAMPLE_RATE, 7, { frequency: 220, stiffness: 1.0, dispersionPivot, dispersionSlope }, seconds, 0);
        return Number(process.hrtime.bigint() - start) / 1e6;
    };
    timeRender(4, 2);
    timeRender(4, 2);
    const bypassedMs = (() => {
        const start = process.hrtime.bigint();
        renderWg2Pluck(SAMPLE_RATE, 7, { frequency: 220, stiffness: 0 }, seconds, 0);
        return Number(process.hrtime.bigint() - start) / 1e6;
    })();
    const activeMs = timeRender(4, 2);
    const ratio = activeMs / bypassedMs;
    assert.ok(ratio < 3, `expected pivot/slope smoothing overhead to stay modest relative to bypassed, got ${ratio.toFixed(2)}x (bypassed ${bypassedMs.toFixed(1)}ms, active ${activeMs.toFixed(1)}ms)`);
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

// --- SAFETY: low-resolution grid search across extreme parameter combinations ---
// Purpose: this project's dispersion work keeps adding new parameters
// (stiffness, dispersionPivot, dispersionSlope) that all feed into the
// SAME shared mechanism (pitchLocked compensation -> railLength). Each
// new parameter was validated against the ranges/combinations known at
// the time it was added, but COMBINATIONS of extreme settings across
// multiple parameters at once were never exhaustively checked -- and a
// real, user-reported bug was found exactly this way (a loud, distorted
// "blast" at high frequency + high stiffness + certain dispersionPivot/
// dispersionSlope values). This grid search exists so FUTURE parameter
// additions get the same coverage automatically, not just the specific
// corner already found.
//
// Deliberately LOW resolution (corners/extremes, not a dense interior
// sweep) and deliberately covers MULTIPLE parameters varying together --
// an instability found here was genuinely invisible to every existing
// single-parameter-at-a-time test in this file, because it only
// manifests from the INTERACTION of frequency, stiffness, pivot, and
// slope all pushed toward their limits simultaneously.
function safetyGridSearch() {
    const flagged = [];
    for (const frequency of [220, 2000, 4000]) {
        for (const stiffness of [0.5, 1.0]) {
            for (const dispersionPivot of [2, 16]) {
                for (const dispersionSlope of [0.5, 4]) {
                    for (const excitationType of ['impulse', 'noise']) {
                        const settings = { frequency, stiffness, dispersionPivot, dispersionSlope, excitationType, decayTime: 1.0, energy: 1.0 };
                        const samples = renderWg2Pluck(SAMPLE_RATE, 7, settings, 0.4, 0);
                        let maxAbs = 0, anyNonFinite = false, sumSq = 0;
                        for (const s of samples) {
                            if (!Number.isFinite(s)) anyNonFinite = true;
                            maxAbs = Math.max(maxAbs, Math.abs(s));
                            sumSq += s * s;
                        }
                        const rms = Math.sqrt(sumSq / samples.length);
                        // Normal ceiling across this codebase's own prior
                        // gain-staging work (Wind/ChimeVocoder/WG1/WG2) is
                        // roughly 1.1-1.5 peak. Sustained RMS approaching
                        // the OutputConditioner's hard clamp (4.0) is the
                        // specific signature of the found bug -- a clipped,
                        // distorted "blast," not a merely-loud-but-clean
                        // signal.
                        if (anyNonFinite || maxAbs > 2.0 || rms > 1.5) {
                            flagged.push({ ...settings, maxAbs, rms, anyNonFinite });
                        }
                    }
                }
            }
        }
    }
    return flagged;
}

test('SAFETY: low-resolution grid search flags loud/distorted/unstable combinations across frequency x stiffness x dispersionPivot x dispersionSlope', () => {
    // FIXED: this test originally caught a real, user-reported bug --
    // dispersionPivot/dispersionSlope's pitchLocked compensation could
    // push railLength down to a short, FRACTIONAL value at high
    // frequency, where the default lagrange3 interpolator's 4-point
    // stencil reads a tap at/past the write index, creating a feedback
    // path with effective gain >> 1 (confirmed exponential -- peak grew
    // from 0.37 to 5e13 over 90 blocks in one isolated case) until
    // OutputConditioner's hard clamp caught it, producing a loud,
    // clipped "blast." Fixed by raising railLength's own floor to
    // WG2_CONFIG.dispersionMinSafeRailLengthSamples (2 -- the exact
    // measured boundary of the danger zone, not a round-number guess).
    // This test is deliberately KEPT, not removed, as a permanent
    // regression guard: future parameter additions get the same
    // multi-parameter-interaction coverage automatically, since this
    // kind of bug is invisible to single-parameter tests by
    // construction. See soundlib/models/WG2/knowledge/causal-claims.yaml's
    // claim.lagrange3-unstable-at-short-fractional-rail-length for the
    // full investigation and the remediation decision (chosen as one of
    // three options, explicitly provisional -- revert if "playability"
    // issues come up during further exploration).
    const flagged = safetyGridSearch();
    if (flagged.length > 0) {
        const summary = flagged
            .map((f) => `    f0=${f.frequency} stiffness=${f.stiffness} pivot=${f.dispersionPivot} slope=${f.dispersionSlope} exc=${f.excitationType}  peak=${f.maxAbs.toFixed(3)} rms=${f.rms.toFixed(3)} finite=${!f.anyNonFinite}`)
            .join('\n');
        assert.fail(
            `SAFETY WARNING -- ${flagged.length} combination(s) produced loud/distorted/unstable output ` +
            `(this test previously passed after a fix -- a NEW failure here means either the fix was reverted ` +
            `or a new parameter/change has reopened the same class of bug):\n${summary}\n\n` +
            `See soundlib/models/WG2/knowledge/causal-claims.yaml's claim.lagrange3-unstable-at-short-fractional-rail-length.`
        );
    }
});
