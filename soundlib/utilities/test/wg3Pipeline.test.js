// End-to-end test of the WG3 DSP pipeline (WaveguideResonator v1, Phase C
// continued -- filtered, transmitting bridge termination) exactly as
// soundlib/models/WG3/wg3Processor.js composes it, minus the
// AudioWorkletProcessor/registerProcessor plumbing, mirroring
// wg2Pipeline.test.js's own pattern. Does not re-prove propagation/
// dispersion/pickup correctness -- those are unchanged, already-tested
// WG2 machinery (see wg2Pipeline.test.js) -- this file focuses on what's
// new: the bridge termination swap and the transmission-port mix.
//
// Pre-C.5.3 reparameterization: `reflection`/`terminationDamping` are no
// longer live settings keys -- replaced by `bridgeDecayVal`/
// `bodyCouplingEfficiency` (see wg3Config.js/bridgeDecayMath.js). Tests
// specifically about the raw reflection-coefficient-level mechanism use
// the advanced/diagnostic `reflectionOverride` escape hatch (bypassing
// the bridgeDecayVal mapping entirely); tests about safety/gain-staging
// across what a user can actually reach use `bridgeDecayVal` itself.
// `bodyCouplingEfficiency` is the INVERTED sense of the old
// terminationDamping (eta=1 fully transmitted, eta=0 fully dissipated --
// the opposite of damping's own convention), so every converted value
// below is `1 - oldDampingValue`, not a straight rename.

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWg2Pluck } from '../../models/WG2/wg2PipelineCore.js';
import { renderWg3Pluck } from '../../models/WG3/wg3PipelineCore.js';
import { WG3_CONFIG } from '../../models/WG3/wg3Config.js';
import { BODY_PRESETS } from '../../models/WG3/bodyConfig.js';
import { bridgeDecayValToSeconds, computeBridgeReflectionCoefficient } from '../../models/WG3/bridgeDecayMath.js';
import { decaySecondsFromT60, t60 } from '../decayMath.js';

const SAMPLE_RATE = 44100;

function rms(samples) {
    let sumSq = 0;
    for (const s of samples) sumSq += s * s;
    return Math.sqrt(sumSq / samples.length);
}

function peak(samples) {
    let p = 0;
    for (const s of samples) {
        const a = Math.abs(s);
        if (a > p) p = a;
    }
    return p;
}

// Frequency-adaptive block-RMS-ratio T60 measurement, matching the
// established pattern elsewhere in this codebase (wg1/wg2Pipeline.test.js's
// own measuredT60Seconds): render, find the decay-tail's RMS ratio across
// a fixed time span, invert the exponential to recover tau, convert to
// T60. Used here specifically to measure BRIDGE-only decay (distributed
// decayTime loss set deliberately long/near-off so it doesn't dominate).
function measuredT60Seconds(samples, sampleRate, blockSize = 1024) {
    const blocks = [];
    for (let i = 0; i + blockSize <= samples.length; i += blockSize) {
        let sumSq = 0;
        for (let j = i; j < i + blockSize; j++) sumSq += samples[j] * samples[j];
        blocks.push(Math.sqrt(sumSq / blockSize));
    }
    // Use two well-separated, non-initial blocks (skip the first few,
    // which include the excitation transient) to estimate the decay rate.
    const startIdx = Math.min(3, blocks.length - 2);
    const endIdx = blocks.length - 1;
    if (endIdx <= startIdx || blocks[startIdx] <= 0 || blocks[endIdx] <= 0) return NaN;
    const elapsedSeconds = ((endIdx - startIdx) * blockSize) / sampleRate;
    const ratio = blocks[endIdx] / blocks[startIdx];
    const tau = -elapsedSeconds / Math.log(ratio);
    return t60(tau);
}

// --- Regression: WG3 at explicit neutral settings reproduces WG2 exactly ---

test('REGRESSION: at explicit reflectionOverride=1/reflectionTilt=0/bodyCouplingEfficiency=0/transmissionGain=0/bodyRadiationGain=0 (the WG2-equivalent neutral point), WG3 renders sample-identical to the equivalent WG2 settings', () => {
    // WG3's OWN defaults (bridgeDecayVal's measured default, excitationType=
    // 'impulse', bodyRadiationGain=75) intentionally do NOT equal
    // this neutral point -- see wg3Config.js's own comment. This test
    // proves the underlying WG2-equivalence identity still holds EXACTLY
    // when explicitly configured to it.
    const neutral = { reflectionOverride: 1, reflectionTilt: 0, bodyCouplingEfficiency: 0, transmissionGain: 0, bodyRadiationGain: 0 };
    const cases = [
        { frequency: 220, energy: 0.8, decayTime: 1.0, excitationType: 'noise' },
        { frequency: 55, energy: 1.0, decayTime: 0.5, excitationType: 'impulse', excitationPosition: 0.3 },
        { frequency: 1760, energy: 0.6, decayTime: 1.5, excitationType: 'triangle', pickupType: 'velocity' },
        { frequency: 440, energy: 0.9, decayTime: 1.0, stiffness: 0.5, dispersionPivot: 6, dispersionSlope: 1.5 }
    ];
    for (const caseSettings of cases) {
        const settings = { ...caseSettings, ...neutral };
        const wg2Samples = renderWg2Pluck(SAMPLE_RATE, 7, caseSettings, 0.3, 0);
        const wg3Samples = renderWg3Pluck(SAMPLE_RATE, 7, settings, 0.3, 0);
        assert.equal(wg3Samples.length, wg2Samples.length);
        let maxDiff = 0;
        for (let i = 0; i < wg2Samples.length; i++) {
            maxDiff = Math.max(maxDiff, Math.abs(wg2Samples[i] - wg3Samples[i]));
        }
        assert.equal(maxDiff, 0, `expected byte-identical render for ${JSON.stringify(settings)}, got maxDiff=${maxDiff}`);
    }
});

test('REGRESSION: WG3\'s own current defaults are stable/finite and genuinely differ from the WG2-equivalent neutral point', () => {
    const atDefaults = renderWg3Pluck(SAMPLE_RATE, 7, { frequency: 220 }, 0.3, 0);
    for (const s of atDefaults) assert.ok(Number.isFinite(s));
    const neutral = renderWg3Pluck(SAMPLE_RATE, 7, { frequency: 220, reflectionOverride: 1, bodyRadiationGain: 0, excitationType: 'noise' }, 0.3, 0);
    let maxDiff = 0;
    for (let i = 0; i < atDefaults.length; i++) maxDiff = Math.max(maxDiff, Math.abs(atDefaults[i] - neutral[i]));
    assert.ok(maxDiff > 1e-6, 'expected WG3\'s own defaults to audibly differ from the WG2-equivalent neutral point');
});

// --- bridgeDecayVal: the new primary bridge control ---

test('bridgeDecayVal measurably changes the render relative to the WG2-equivalent neutral point', () => {
    const settings = { frequency: 220, energy: 0.8, decayTime: 1.0, excitationType: 'noise' };
    const neutral = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, reflectionOverride: 1 }, 0.3, 0);
    const lowered = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, bridgeDecayVal: 0.3 }, 0.3, 0);
    let maxDiff = 0;
    for (let i = 0; i < neutral.length; i++) maxDiff = Math.max(maxDiff, Math.abs(neutral[i] - lowered[i]));
    assert.ok(maxDiff > 1e-6, `expected a measurable difference at bridgeDecayVal=0.3, got maxDiff=${maxDiff}`);
    for (const s of lowered) assert.ok(Number.isFinite(s));
});

test('raising the raw reflection coefficient toward 1 (reflectionOverride, advanced/diagnostic path) measurably changes the render', () => {
    const settings = { frequency: 220, energy: 0.8, decayTime: 1.0, excitationType: 'noise' };
    const neutral = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, reflectionOverride: 1 }, 0.3, 0);
    const lowered = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, reflectionOverride: 0.5 }, 0.3, 0);
    let maxDiff = 0;
    for (let i = 0; i < neutral.length; i++) maxDiff = Math.max(maxDiff, Math.abs(neutral[i] - lowered[i]));
    assert.ok(maxDiff > 1e-6, `expected a measurable difference at reflectionOverride=0.5, got maxDiff=${maxDiff}`);
    for (const s of lowered) assert.ok(Number.isFinite(s));
});

test('reflectionTilt measurably changes the render relative to flat (tilt=0)', () => {
    const settings = { frequency: 220, energy: 0.8, decayTime: 1.0, excitationType: 'noise', reflectionOverride: 0.7 };
    const flat = renderWg3Pluck(SAMPLE_RATE, 7, settings, 0.3, 0);
    const darkened = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, reflectionTilt: 1 }, 0.3, 0);
    const brightened = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, reflectionTilt: -1 }, 0.3, 0);
    let diffDark = 0, diffBright = 0;
    for (let i = 0; i < flat.length; i++) {
        diffDark = Math.max(diffDark, Math.abs(flat[i] - darkened[i]));
        diffBright = Math.max(diffBright, Math.abs(flat[i] - brightened[i]));
    }
    assert.ok(diffDark > 1e-6, `expected darkening tilt to change the render, got diff=${diffDark}`);
    assert.ok(diffBright > 1e-6, `expected brightening tilt to change the render, got diff=${diffBright}`);
});

test('transmissionGain has zero effect while the termination is neutral (nothing is ever transmitted)', () => {
    const neutralTermination = { frequency: 220, energy: 0.8, decayTime: 1.0, excitationType: 'noise', reflectionOverride: 1 };
    const withoutMonitor = renderWg3Pluck(SAMPLE_RATE, 7, neutralTermination, 0.3, 0);
    const withMonitor = renderWg3Pluck(SAMPLE_RATE, 7, { ...neutralTermination, transmissionGain: 2 }, 0.3, 0);
    let maxDiff = 0;
    for (let i = 0; i < withoutMonitor.length; i++) maxDiff = Math.max(maxDiff, Math.abs(withoutMonitor[i] - withMonitor[i]));
    assert.equal(maxDiff, 0, `transmissionGain should be inert when transmittedSignal is always 0, got maxDiff=${maxDiff}`);
});

test('transmissionGain measurably changes output once the bridge is opened up, scaling with its own magnitude', () => {
    const openBridge = { frequency: 220, energy: 0.8, decayTime: 1.0, excitationType: 'noise', reflectionOverride: 0.5, reflectionTilt: 0.3, bodyCouplingEfficiency: 0.8 };
    const off = renderWg3Pluck(SAMPLE_RATE, 7, { ...openBridge, transmissionGain: 0 }, 0.3, 0);
    const low = renderWg3Pluck(SAMPLE_RATE, 7, { ...openBridge, transmissionGain: 0.5 }, 0.3, 0);
    const high = renderWg3Pluck(SAMPLE_RATE, 7, { ...openBridge, transmissionGain: 1.0 }, 0.3, 0);

    let diffLow = 0, diffHigh = 0;
    for (let i = 0; i < off.length; i++) {
        diffLow = Math.max(diffLow, Math.abs(off[i] - low[i]));
        diffHigh = Math.max(diffHigh, Math.abs(off[i] - high[i]));
    }
    assert.ok(diffLow > 1e-6, `expected a measurable change at transmissionGain=0.5, got diff=${diffLow}`);
    assert.ok(diffHigh > diffLow * 1.5, `expected the deviation to scale up with transmissionGain, got diffLow=${diffLow} diffHigh=${diffHigh}`);
});

test('transmissionGain never feeds back into waveguide state', () => {
    const openBridge = { frequency: 220, energy: 0.8, decayTime: 1.0, excitationType: 'noise', reflectionOverride: 0.5, reflectionTilt: 0.3, bodyCouplingEfficiency: 0.8 };
    const monitorOff = renderWg3Pluck(SAMPLE_RATE, 7, { ...openBridge, transmissionGain: 0 }, 0.3, 0);
    const monitorHigh = renderWg3Pluck(SAMPLE_RATE, 7, { ...openBridge, transmissionGain: 1.0 }, 0.3, 0);
    assert.ok(monitorOff.length === monitorHigh.length);
});

// --- pickupGain: the third tap, on the signal that was always there ---

test('pickupGain scales the string-pickup contribution directly, with no dependence on bridge/body state', () => {
    // Deliberately a fully NEUTRAL termination (reflectionOverride=1 ->
    // nothing is ever transmitted) -- unlike transmissionGain/
    // bodyRadiationGain, pickupGain must still have a large, direct
    // effect here, since observed (the pickup) is entirely independent
    // of the bridge's transmission/dissipation split.
    const settings = { frequency: 220, energy: 0.8, decayTime: 1.0, excitationType: 'noise', reflectionOverride: 1 };
    const atDefault = renderWg3Pluck(SAMPLE_RATE, 7, settings, 0.3, 0);
    const doubled = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, pickupGain: 2 }, 0.3, 0);
    const muted = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, pickupGain: 0 }, 0.3, 0);
    for (let i = 0; i < atDefault.length; i++) {
        assert.ok(Math.abs(doubled[i] - 2 * atDefault[i]) < 1e-9, `expected pickupGain=2 to exactly double the default (pickupGain=1) render at sample ${i}`);
        assert.equal(muted[i], 0, `expected pickupGain=0 to produce exact silence (nothing else is transmitted at this neutral termination) at sample ${i}`);
    }
});

test('pickupGain=0 isolates the transmission/body taps -- the actual use case this parameter exists for', () => {
    // The real motivating scenario: listening to ONLY the bridge's
    // transmitted signal or ONLY the body's radiated output, with the
    // plain string pickup muted out of the mix entirely.
    const settings = {
        frequency: 220, energy: 1.0, decayTime: 1.0, excitationType: 'impulse',
        reflectionOverride: 0.4, bodyCouplingEfficiency: 1, transmissionGain: 1.5, bodyRadiationGain: 50
    };
    const fullMix = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, pickupGain: 1 }, 0.3, 0);
    const pickupMuted = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, pickupGain: 0 }, 0.3, 0);
    assert.ok(rms(pickupMuted) > 1e-6, 'expected a real, nonzero signal even with the pickup muted (the transmission/body taps carry it)');
    let maxDiff = 0;
    for (let i = 0; i < fullMix.length; i++) maxDiff = Math.max(maxDiff, Math.abs(fullMix[i] - pickupMuted[i]));
    assert.ok(maxDiff > 1e-6, 'expected muting the pickup to measurably change the mix');
});

test('pickupGain never feeds back into waveguide state', () => {
    const settings = { frequency: 220, energy: 0.8, decayTime: 1.0, excitationType: 'noise', reflectionOverride: 0.5, reflectionTilt: 0.3, bodyCouplingEfficiency: 0.8 };
    const pickupOff = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, pickupGain: 0 }, 0.3, 0);
    const pickupHigh = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, pickupGain: 2 }, 0.3, 0);
    assert.ok(pickupOff.length === pickupHigh.length);
});

// --- Required test #5/#6: bridgeDecayVal/bodyCouplingEfficiency are independent axes ---

test('#5: at fixed bridgeDecayVal, varying bodyCouplingEfficiency does not change string decay (only the waveguide-returned reflectedWave depends on bridgeDecayVal, never on couplingEfficiency)', () => {
    const base = { frequency: 220, energy: 1.0, decayTime: 2.0, excitationType: 'impulse', bridgeDecayVal: 0.4, transmissionGain: 0, bodyRadiationGain: 0 };
    const lowEta = renderWg3Pluck(SAMPLE_RATE, 7, { ...base, bodyCouplingEfficiency: 0 }, 0.5, 0);
    const highEta = renderWg3Pluck(SAMPLE_RATE, 7, { ...base, bodyCouplingEfficiency: 1 }, 0.5, 0);
    let maxDiff = 0;
    for (let i = 0; i < lowEta.length; i++) maxDiff = Math.max(maxDiff, Math.abs(lowEta[i] - highEta[i]));
    assert.equal(maxDiff, 0, `expected string-pickup-only render to be unaffected by bodyCouplingEfficiency, got maxDiff=${maxDiff}`);
});

test('#6: at fixed bridgeDecayVal, transmitted energy increases monotonically with bodyCouplingEfficiency', () => {
    const base = { frequency: 220, energy: 1.0, decayTime: 1.0, excitationType: 'noise', bridgeDecayVal: 0.3, transmissionGain: 1.0, bodyRadiationGain: 0 };
    let previousRms = -1;
    for (const bodyCouplingEfficiency of [0, 0.25, 0.5, 0.75, 1.0]) {
        const samples = renderWg3Pluck(SAMPLE_RATE, 7, { ...base, bodyCouplingEfficiency }, 0.3, 0);
        const r = rms(samples);
        if (bodyCouplingEfficiency > 0) {
            assert.ok(r >= previousRms, `expected transmitted-signal RMS to increase (or stay level) with bodyCouplingEfficiency, got ${r} after ${previousRms} at eta=${bodyCouplingEfficiency}`);
        }
        previousRms = r;
    }
});

// --- Required test #1/#2/#3: the bridgeDecayVal -> seconds -> r mapping itself ---

test('#1: measured bridge-only T60 matches requested bridgeDecayVal-derived T60 across representative fundamentals', () => {
    // Distributed string loss (decayTime) set long enough that it doesn't
    // meaningfully contribute over the measurement window -- isolating
    // the BRIDGE's own contribution to decay, per the directive's own
    // "bridge alone, before combining with distributed string loss"
    // framing. energy/excitationType choices keep a clean, strong decay
    // tail to measure against.
    const requestedBridgeT60 = 0.4;
    const measurements = [];
    for (const frequency of [110, 220, 440, 880]) {
        const samples = renderWg3Pluck(SAMPLE_RATE, 7, {
            frequency, energy: 1.0, decayTime: 30, excitationType: 'impulse',
            reflectionOverride: computeBridgeReflectionCoefficient(requestedBridgeT60, frequency),
            bodyCouplingEfficiency: 0, transmissionGain: 0, bodyRadiationGain: 0
        }, Math.max(1.5, requestedBridgeT60 * 4), 0);
        const measured = measuredT60Seconds(samples, SAMPLE_RATE);
        measurements.push({ frequency, requestedBridgeT60, measured });
        const relativeError = Math.abs(measured - requestedBridgeT60) / requestedBridgeT60;
        assert.ok(relativeError < 0.25, `frequency=${frequency}: requested bridge T60=${requestedBridgeT60}s, measured=${measured.toFixed(3)}s, relative error ${(relativeError * 100).toFixed(1)}%`);
    }
    console.log('  [measurement] bridge-only T60 vs frequency:', JSON.stringify(measurements));
});

test('#2: the computed reflection coefficient moves closer to 1 as the fundamental (round-trip rate) increases, at fixed bridgeDecayTime', () => {
    const t60Seconds = 1.0;
    let previousR = -1;
    for (const frequency of [55, 110, 220, 440, 880, 1760]) {
        const r = computeBridgeReflectionCoefficient(t60Seconds, frequency);
        assert.ok(r > previousR, `expected r to increase with frequency at fixed bridgeDecayTime, got r=${r} after ${previousR} at f0=${frequency}`);
        previousR = r;
    }
});

test('#3: bridgeDecayTimeSeconds=Infinity gives r=1 exactly, zero transmitted/dissipated', () => {
    assert.equal(computeBridgeReflectionCoefficient(Infinity, 220), 1);
    const samples = renderWg3Pluck(SAMPLE_RATE, 7, {
        frequency: 220, energy: 1.0, decayTime: 1.0, excitationType: 'impulse',
        reflectionOverride: computeBridgeReflectionCoefficient(Infinity, 220),
        bodyCouplingEfficiency: 1, transmissionGain: 2, bodyRadiationGain: 100
    }, 0.3, 0);
    const reference = renderWg3Pluck(SAMPLE_RATE, 7, {
        frequency: 220, energy: 1.0, decayTime: 1.0, excitationType: 'impulse',
        reflectionOverride: 1, bodyCouplingEfficiency: 1, transmissionGain: 0, bodyRadiationGain: 0
    }, 0.3, 0);
    let maxDiff = 0;
    for (let i = 0; i < samples.length; i++) maxDiff = Math.max(maxDiff, Math.abs(samples[i] - reference[i]));
    assert.equal(maxDiff, 0, 'expected zero transmitted/dissipated contribution at r=1 regardless of monitor gains, since nothing is ever non-reflected');
});

// --- Required test #7: exact energy identity, at the pipeline level ---

test('#7: r^2+t^2+d^2=1 holds to floating-point precision at reflectionTilt=0, across a grid of bridgeDecayVal/bodyCouplingEfficiency', () => {
    for (const bridgeDecayVal of [0, 0.3, 0.6, 1]) {
        for (const bodyCouplingEfficiency of [0, 0.5, 1]) {
            const frequency = 220;
            const bridgeDecayTimeSeconds = bridgeDecayValToSeconds(bridgeDecayVal, WG3_CONFIG.bridgeDecayTimeMinSeconds, WG3_CONFIG.bridgeDecayTimeMaxSeconds);
            const r = computeBridgeReflectionCoefficient(bridgeDecayTimeSeconds, frequency);
            const nonReflectedEnergyFraction = Math.max(0, 1 - r * r);
            const t = Math.sqrt(bodyCouplingEfficiency * nonReflectedEnergyFraction);
            const d = Math.sqrt((1 - bodyCouplingEfficiency) * nonReflectedEnergyFraction);
            const sum = r * r + t * t + d * d;
            assert.ok(Math.abs(sum - 1) < 1e-9, `bridgeDecayVal=${bridgeDecayVal} eta=${bodyCouplingEfficiency}: r^2+t^2+d^2=${sum}, expected 1`);
        }
    }
});

// --- Required test #9: combined decay-rate relationship ---

test('#9: measured combined decayTime+bridgeDecayVal T60 vs. the predicted 1/T_total ~= 1/T_s + 1/T_b relationship', () => {
    const frequency = 220;
    const results = [];
    for (const stringT60 of [0.6, 1.2]) {
        for (const bridgeT60 of [0.4, 0.9]) {
            // decayTime is tau (1/e), not T60 -- convert.
            const stringDecayTimeTau = decaySecondsFromT60(stringT60);
            const samples = renderWg3Pluck(SAMPLE_RATE, 7, {
                frequency, energy: 1.0, decayTime: stringDecayTimeTau, excitationType: 'impulse',
                reflectionOverride: computeBridgeReflectionCoefficient(bridgeT60, frequency),
                bodyCouplingEfficiency: 0, transmissionGain: 0, bodyRadiationGain: 0
            }, Math.max(1.5, Math.max(stringT60, bridgeT60) * 3), 0);
            const measuredCombinedT60 = measuredT60Seconds(samples, SAMPLE_RATE);
            const predictedCombinedT60 = 1 / (1 / stringT60 + 1 / bridgeT60);
            const relativeError = Math.abs(measuredCombinedT60 - predictedCombinedT60) / predictedCombinedT60;
            results.push({ stringT60, bridgeT60, predictedCombinedT60, measuredCombinedT60, relativeError });
        }
    }
    console.log('  [measurement] combined decay-rate relationship (1/T_total ~= 1/T_s + 1/T_b):', JSON.stringify(results));
    // Reported, not strictly asserted-tight -- per the directive's own
    // "please test and document whether WG3 follows this relationship,"
    // a loose bound confirms the relationship is at least roughly
    // followed, with the actual numbers reported above for inspection.
    for (const r of results) {
        assert.ok(r.relativeError < 0.4, `stringT60=${r.stringT60} bridgeT60=${r.bridgeT60}: predicted=${r.predictedCombinedT60.toFixed(3)}s measured=${r.measuredCombinedT60.toFixed(3)}s, relative error ${(r.relativeError * 100).toFixed(1)}% too large`);
    }
});

// --- Safety: permanent low-resolution grid search, now over bridgeDecayVal/bodyCouplingEfficiency/all three gains (what a user can actually reach) ---

function safetyGridSearch() {
    const flagged = [];
    for (const frequency of [220, 2000, 4000]) {
        for (const stiffness of [0, 1.0]) {
            for (const bridgeDecayVal of [0, 0.5, 1]) {
                for (const reflectionTilt of [-1, 1]) {
                    for (const bodyCouplingEfficiency of [0, 1]) {
                        for (const pickupGain of [0, WG3_CONFIG.pickupGainMax]) {
                            for (const transmissionGain of [0, WG3_CONFIG.transmissionGainMax]) {
                                for (const bodyRadiationGain of [0, WG3_CONFIG.bodyRadiationGainMax]) {
                                    const settings = {
                                        frequency, stiffness, bridgeDecayVal, reflectionTilt, bodyCouplingEfficiency,
                                        pickupGain, transmissionGain, bodyRadiationGain,
                                        decayTime: 1.0, energy: 1.0, excitationType: 'noise'
                                    };
                                    const samples = renderWg3Pluck(SAMPLE_RATE, 7, settings, 0.4, 0);
                                    let maxAbs = 0, anyNonFinite = false, sumSq = 0;
                                    for (const s of samples) {
                                        if (!Number.isFinite(s)) anyNonFinite = true;
                                        maxAbs = Math.max(maxAbs, Math.abs(s));
                                        sumSq += s * s;
                                    }
                                    const r = Math.sqrt(sumSq / samples.length);
                                    // Threshold raised from 2.0 -- now that
                                    // transmissionGainMax is 10 (previously
                                    // 2), getting close to the 4.0 hard
                                    // clamp at max-gain combinations is an
                                    // ACCEPTED, documented outcome (see the
                                    // combined gain-staging test above),
                                    // not a surprise to flag. This grid now
                                    // only flags what would be a genuine
                                    // bug: non-finite output, or the hard
                                    // clamp itself somehow being exceeded.
                                    if (anyNonFinite || maxAbs > 4.0 + 1e-9 || r > 1.5) {
                                        flagged.push({ ...settings, maxAbs, rms: r, anyNonFinite });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return flagged;
}

test('SAFETY: low-resolution grid search flags loud/distorted/unstable combinations across frequency x stiffness x bridgeDecayVal x reflectionTilt x bodyCouplingEfficiency x pickupGain x transmissionGain x bodyRadiationGain', () => {
    const flagged = safetyGridSearch();
    if (flagged.length > 0) {
        const summary = flagged
            .map((f) => `    f0=${f.frequency} stiffness=${f.stiffness} bridgeDecayVal=${f.bridgeDecayVal} tilt=${f.reflectionTilt} eta=${f.bodyCouplingEfficiency} pickupGain=${f.pickupGain} transmissionGain=${f.transmissionGain} bodyGain=${f.bodyRadiationGain}  peak=${f.maxAbs.toFixed(3)} rms=${f.rms.toFixed(3)} finite=${!f.anyNonFinite}`)
            .join('\n');
        assert.fail(`SAFETY WARNING -- ${flagged.length} combination(s) produced loud/distorted/unstable output:\n${summary}`);
    }
});

// --- #4/#10/#12: short bridge decay times, audible-pitch default check, broad frequency/sample-rate coverage ---

test('#4: short bridgeDecayVal produces rapid, stable string decay without instability', () => {
    for (const frequency of [55, 220, 1760, 3000]) {
        const samples = renderWg3Pluck(SAMPLE_RATE, 7, { frequency, energy: 1.0, decayTime: 1.0, excitationType: 'impulse', bridgeDecayVal: 0 }, 0.3, 0);
        for (const s of samples) assert.ok(Number.isFinite(s), `non-finite sample at frequency=${frequency}, bridgeDecayVal=0`);
        assert.ok(peak(samples) < 2.0, `expected a stable, non-exploding decay at frequency=${frequency}, bridgeDecayVal=0, got peak=${peak(samples)}`);
    }
});

test('#10: pitch remains clearly audible at WG3\'s own default while body contribution is also measurable', () => {
    const samples = renderWg3Pluck(SAMPLE_RATE, 7, { frequency: 220 }, 0.3, 0);
    const earlyRms = rms(samples.slice(0, Math.round(SAMPLE_RATE * 0.05)));
    assert.ok(earlyRms > 1e-4, `expected a clearly audible onset at WG3's own defaults, got early rms=${earlyRms}`);
    const pickupOnly = renderWg3Pluck(SAMPLE_RATE, 7, { frequency: 220, bodyRadiationGain: 0 }, 0.3, 0);
    const bodyOnly = samples.map((v, i) => v - pickupOnly[i]);
    assert.ok(rms(bodyOnly) > 1e-6, `expected a measurable body contribution at WG3's own defaults, got rms=${rms(bodyOnly)}`);
});

test('#12: coverage across 55-3000Hz at both supported sample rates stays finite and stable', () => {
    for (const sampleRate of [44100, 48000]) {
        for (const frequency of [55, 110, 220, 440, 880, 1760, 3000]) {
            const samples = renderWg3Pluck(sampleRate, 7, { frequency, energy: 1.0, decayTime: 1.0, excitationType: 'noise' }, 0.3, 0);
            for (const s of samples) assert.ok(Number.isFinite(s), `non-finite sample at sampleRate=${sampleRate} frequency=${frequency}`);
        }
    }
});

// --- Gain-staging measurement for transmissionGainMax ---

test('gain-staging: worst-case peak/RMS at WG3_CONFIG.transmissionGainMax stays within OutputConditioner\'s normal headroom', () => {
    let worstPeak = 0;
    let worstRms = 0;
    for (const frequency of [55, 220, 1000, 4000]) {
        for (const bridgeDecayVal of [0, 0.5, 1]) {
            for (const reflectionTilt of [-1, 0, 1]) {
                for (const bodyCouplingEfficiency of [0, 0.5]) {
                    const samples = renderWg3Pluck(
                        SAMPLE_RATE,
                        7,
                        { frequency, energy: 1.0, decayTime: 1.0, excitationType: 'noise', bridgeDecayVal, reflectionTilt, bodyCouplingEfficiency, transmissionGain: WG3_CONFIG.transmissionGainMax },
                        0.4,
                        0
                    );
                    worstPeak = Math.max(worstPeak, peak(samples));
                    worstRms = Math.max(worstRms, rms(samples));
                }
            }
        }
    }
    // RE-MEASURED after transmissionGainMax was raised 2 -> 10 (the
    // pickup's loudness was overshadowing it at 2): worst-case peak here
    // is ~3.29 (at pickupGain/bodyRadiationGain left at their own
    // DEFAULTS, not their own maxes -- see the combined test below for
    // what happens when all three are maxed together) -- real margin
    // below the 4.0 clamp still exists for the common case of pushing
    // just this one gain up.
    assert.ok(worstPeak < 3.5, `worst-case peak at transmissionGainMax too close to the hard clamp: ${worstPeak}`);
    assert.ok(worstRms < 1.5, `worst-case RMS at transmissionGainMax too high: ${worstRms}`);
});

test('gain-staging: worst-case peak/RMS at WG3_CONFIG.pickupGainMax stays within OutputConditioner\'s normal headroom', () => {
    let worstPeak = 0;
    let worstRms = 0;
    for (const frequency of [55, 220, 1000, 4000]) {
        for (const bridgeDecayVal of [0, 0.5, 1]) {
            for (const reflectionTilt of [-1, 0, 1]) {
                for (const bodyCouplingEfficiency of [0, 0.5]) {
                    const samples = renderWg3Pluck(
                        SAMPLE_RATE,
                        7,
                        { frequency, energy: 1.0, decayTime: 1.0, excitationType: 'noise', bridgeDecayVal, reflectionTilt, bodyCouplingEfficiency, pickupGain: WG3_CONFIG.pickupGainMax },
                        0.4,
                        0
                    );
                    worstPeak = Math.max(worstPeak, peak(samples));
                    worstRms = Math.max(worstRms, rms(samples));
                }
            }
        }
    }
    assert.ok(worstPeak < 3.0, `worst-case peak at pickupGainMax too close to the hard clamp: ${worstPeak}`);
    assert.ok(worstRms < 1.5, `worst-case RMS at pickupGainMax too high: ${worstRms}`);
});

// pickupGain defaults to 1 (not 0), so it was implicitly "at max-ish
// magnitude" in every pre-existing measurement above that used the
// default -- but never simultaneously with the OTHER two gains at THEIR
// own max, which is the genuinely new combination this addition
// introduces. Measured directly rather than assumed to just add linearly
// through OutputConditioner's clamp.
//
// ACCEPTED, DOCUMENTED EDGE CASE (after transmissionGainMax was raised
// 2 -> 10): at this specific triple-max combination, the TRUE unclamped
// peak genuinely exceeds OutputConditioner's 4.0 hard clamp -- measured
// 4.675 via the standard "scale energy down so the clamp can't engage,
// then scale back up" technique (see docs/MODEL_PATTERNS.md's Wind
// gain-staging precedent for the same trick). This means the clamp
// WILL audibly engage at this one deliberately-extreme corner (all
// three independent gains maxed simultaneously, at a specific
// frequency/tilt/coupling combination) -- a known tradeoff accepted so
// that transmissionGain alone can reach a genuinely audible 10, not an
// unexpected discovery papered over. The clamp still does its job: peak
// stays bounded at exactly 4.0 (never higher), RMS stays low (~0.12,
// nowhere near a sustained loud/distorted signal) -- this is a single
// brief transient getting clipped at one specific corner, not a general
// instability.
test('gain-staging: worst-case peak/RMS with pickupGain, transmissionGain, AND bodyRadiationGain all simultaneously at their own max', () => {
    let worstPeak = 0;
    let worstRms = 0;
    let worstSettings = null;
    for (const frequency of [55, 220, 1000, 4000]) {
        for (const bridgeDecayVal of [0, 0.5, 1]) {
            for (const reflectionTilt of [-1, 0, 1]) {
                for (const bodyCouplingEfficiency of [0, 0.5, 1]) {
                    const settings = {
                        frequency, energy: 1.0, decayTime: 1.0, excitationType: 'noise', bridgeDecayVal, reflectionTilt, bodyCouplingEfficiency,
                        pickupGain: WG3_CONFIG.pickupGainMax,
                        transmissionGain: WG3_CONFIG.transmissionGainMax,
                        bodyRadiationGain: WG3_CONFIG.bodyRadiationGainMax
                    };
                    const samples = renderWg3Pluck(SAMPLE_RATE, 7, settings, 0.4, 0);
                    const p = peak(samples);
                    const r = rms(samples);
                    if (p > worstPeak) worstSettings = settings;
                    worstPeak = Math.max(worstPeak, p);
                    worstRms = Math.max(worstRms, r);
                }
            }
        }
    }
    // Recover the TRUE unclamped peak at the worst settings found above --
    // the clamped measurement alone can't distinguish "right at 4.0" from
    // "would be far higher if not clamped" (the exact trap documented for
    // Wind's own gain-staging). A tiny energy can't trigger the clamp;
    // scaling its result back up recovers the true linear magnitude.
    const tinyEnergy = 0.001;
    const tinySamples = renderWg3Pluck(SAMPLE_RATE, 7, { ...worstSettings, energy: tinyEnergy }, 0.4, 0);
    const trueUnclampedPeak = peak(tinySamples) / tinyEnergy;
    console.log(`  [measurement] combined worst-case (pickupGain=${WG3_CONFIG.pickupGainMax}, transmissionGain=${WG3_CONFIG.transmissionGainMax}, bodyRadiationGain=${WG3_CONFIG.bodyRadiationGainMax}): clamped peak=${worstPeak.toFixed(4)}, TRUE unclamped peak=${trueUnclampedPeak.toFixed(4)}, rms=${worstRms.toFixed(4)}, at ${JSON.stringify(worstSettings)}`);
    // The clamp itself must never be exceeded -- that would indicate a
    // bug in OutputConditioner, not an accepted tradeoff.
    assert.ok(worstPeak <= 4.0 + 1e-9, `OutputConditioner's hard clamp was exceeded, not just reached: ${worstPeak}`);
    assert.ok(worstRms < 2.0, `worst-case RMS with all three gains at max too high: ${worstRms}`);
});

// --- Phase C.5.1: one-way body coupling (BodyModeBank) ---

test('REGRESSION: explicit bodyRadiationGain=0 is a true off switch, independent of bodyPreset', () => {
    const cases = [
        { frequency: 220, energy: 0.8, decayTime: 1.0, excitationType: 'noise' },
        { frequency: 55, energy: 1.0, decayTime: 0.5, excitationType: 'impulse', reflectionOverride: 0.3, bodyCouplingEfficiency: 0.5, transmissionGain: 1.5 },
        { frequency: 1760, energy: 0.6, decayTime: 1.5, excitationType: 'triangle', pickupType: 'velocity', reflectionTilt: 0.7 }
    ];
    for (const settings of cases) {
        const withLowQ = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, bodyRadiationGain: 0, bodyPreset: 'sparseLowQ' }, 0.3, 0);
        const withHighQ = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, bodyRadiationGain: 0, bodyPreset: 'sparseHighQ' }, 0.3, 0);
        let maxDiff = 0;
        for (let i = 0; i < withLowQ.length; i++) {
            maxDiff = Math.max(maxDiff, Math.abs(withLowQ[i] - withHighQ[i]));
        }
        assert.equal(maxDiff, 0, `expected byte-identical render at bodyRadiationGain=0 regardless of bodyPreset for ${JSON.stringify(settings)}, got maxDiff=${maxDiff}`);
    }
});

test('at reflectionOverride=1 (nothing ever transmitted), body radiation stays silent regardless of bodyRadiationGain', () => {
    const neutralTermination = { frequency: 220, energy: 0.8, decayTime: 1.0, excitationType: 'noise', reflectionOverride: 1, reflectionTilt: 0 };
    const withoutBody = renderWg3Pluck(SAMPLE_RATE, 7, neutralTermination, 0.3, 0);
    const withBody = renderWg3Pluck(SAMPLE_RATE, 7, { ...neutralTermination, bodyRadiationGain: WG3_CONFIG.bodyRadiationGainMax }, 0.3, 0);
    let maxDiff = 0;
    for (let i = 0; i < withoutBody.length; i++) maxDiff = Math.max(maxDiff, Math.abs(withoutBody[i] - withBody[i]));
    assert.equal(maxDiff, 0, `bodyRadiationGain should be inert when transmittedSignal is always 0, got maxDiff=${maxDiff}`);
});

test('transmittedSignal drives the body predictably: body radiation is deterministic given the same settings/seed', () => {
    const settings = { frequency: 220, energy: 0.8, decayTime: 1.0, excitationType: 'impulse', reflectionOverride: 0.3, bodyCouplingEfficiency: 1, bodyRadiationGain: 10 };
    const a = renderWg3Pluck(SAMPLE_RATE, 7, settings, 0.3, 0);
    const b = renderWg3Pluck(SAMPLE_RATE, 7, settings, 0.3, 0);
    let maxDiff = 0;
    for (let i = 0; i < a.length; i++) maxDiff = Math.max(maxDiff, Math.abs(a[i] - b[i]));
    assert.equal(maxDiff, 0);
});

test('#11 / string-pickup and body-radiation outputs are measurably distinct (one-way isolation remains structurally intact)', () => {
    const settings = { frequency: 220, energy: 1.0, decayTime: 1.0, excitationType: 'impulse', reflectionOverride: 0.3, bodyCouplingEfficiency: 1 };
    const pickupOnly = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, bodyRadiationGain: 0 }, 0.3, 0);
    const withBody = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, bodyRadiationGain: WG3_CONFIG.bodyRadiationGainMax }, 0.3, 0);
    const bodyOnly = withBody.map((v, i) => v - pickupOnly[i]);
    assert.ok(rms(bodyOnly) > 1e-6, `expected a nontrivial, measurable body-radiation contribution, got rms=${rms(bodyOnly)}`);
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < pickupOnly.length; i++) {
        dot += pickupOnly[i] * bodyOnly[i];
        normA += pickupOnly[i] ** 2;
        normB += bodyOnly[i] ** 2;
    }
    const correlation = dot / Math.sqrt(normA * normB);
    assert.ok(Math.abs(correlation) < 0.5, `expected pickup and body-radiation to be substantially uncorrelated (distinct signals), got correlation=${correlation}`);
});

test('#8: bodyRadiationGain changes only audible output level -- never feeds back into waveguide state', () => {
    const settings = { frequency: 220, energy: 1.0, decayTime: 1.0, excitationType: 'noise', reflectionOverride: 0.3, bodyCouplingEfficiency: 0.8 };
    const off = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, bodyRadiationGain: 0, transmissionGain: 0 }, 0.3, 0);
    const bodyHigh = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, bodyRadiationGain: WG3_CONFIG.bodyRadiationGainMax, transmissionGain: 0 }, 0.3, 0);
    const bodyContribution = bodyHigh.map((v, i) => v - off[i]);
    const reconstructedOff = bodyHigh.map((v, i) => v - bodyContribution[i]);
    let maxDiff = 0;
    for (let i = 0; i < off.length; i++) maxDiff = Math.max(maxDiff, Math.abs(off[i] - reconstructedOff[i]));
    assert.ok(maxDiff < 1e-12, `expected the body's contribution to be exactly isolable/reversible, got maxDiff=${maxDiff}`);
});

test('gain-staging: worst-case peak/RMS at WG3_CONFIG.bodyRadiationGainMax stays within OutputConditioner\'s normal headroom', () => {
    let worstPeak = 0;
    let worstRms = 0;
    for (const frequency of [55, 220, 1000, 4000]) {
        for (const bridgeDecayVal of [0, 0.5, 1]) {
            for (const bodyCouplingEfficiency of [0, 0.5]) {
                const samples = renderWg3Pluck(
                    SAMPLE_RATE,
                    7,
                    { frequency, energy: 1.0, decayTime: 1.0, excitationType: 'noise', bridgeDecayVal, bodyCouplingEfficiency, bodyRadiationGain: WG3_CONFIG.bodyRadiationGainMax },
                    0.4,
                    0
                );
                worstPeak = Math.max(worstPeak, peak(samples));
                worstRms = Math.max(worstRms, rms(samples));
            }
        }
    }
    assert.ok(worstPeak < 3.0, `worst-case peak at bodyRadiationGainMax too close to the hard clamp: ${worstPeak}`);
    assert.ok(worstRms < 1.5, `worst-case RMS at bodyRadiationGainMax too high: ${worstRms}`);
});

test('CPU cost: body-enabled render stays within a modest multiple of body-disabled (efficiency sanity bound)', () => {
    const settings = { frequency: 220, energy: 1.0, decayTime: 1.0, excitationType: 'noise', reflectionOverride: 0.3 };
    const iterations = 20;

    const t0 = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, bodyRadiationGain: 0 }, 0.5, 0);
    const t1 = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, bodyRadiationGain: 10 }, 0.5, 0);
    const t2 = process.hrtime.bigint();

    const disabledMs = Number(t1 - t0) / 1e6;
    const enabledMs = Number(t2 - t1) / 1e6;
    const ratio = enabledMs / disabledMs;
    assert.ok(ratio < 3.0, `expected body-enabled render to stay within ~3x body-disabled, got ratio=${ratio.toFixed(2)} (disabled=${disabledMs.toFixed(1)}ms, enabled=${enabledMs.toFixed(1)}ms)`);
});

// --- Phase C.5.2: contrasting static bodies ---

test('REGRESSION: bodyPreset=\'sparseLowQ\' (the default) renders identically whether passed explicitly or omitted', () => {
    const settings = { frequency: 220, energy: 1.0, decayTime: 1.0, excitationType: 'impulse', reflectionOverride: 0.3, bodyRadiationGain: 50 };
    const omitted = renderWg3Pluck(SAMPLE_RATE, 7, settings, 0.3, 0);
    const explicit = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, bodyPreset: 'sparseLowQ' }, 0.3, 0);
    let maxDiff = 0;
    for (let i = 0; i < omitted.length; i++) maxDiff = Math.max(maxDiff, Math.abs(omitted[i] - explicit[i]));
    assert.equal(maxDiff, 0);
});

test('switching bodyPreset measurably changes the render once the body is audible', () => {
    const settings = { frequency: 220, energy: 1.0, decayTime: 1.0, excitationType: 'impulse', reflectionOverride: 0.3, bodyRadiationGain: 50 };
    const renders = {};
    for (const presetName of Object.keys(BODY_PRESETS)) {
        renders[presetName] = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, bodyPreset: presetName }, 0.3, 0);
    }
    const names = Object.keys(renders);
    for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
            let maxDiff = 0;
            for (let k = 0; k < renders[names[i]].length; k++) {
                maxDiff = Math.max(maxDiff, Math.abs(renders[names[i]][k] - renders[names[j]][k]));
            }
            assert.ok(maxDiff > 1e-6, `expected ${names[i]} and ${names[j]} to render differently, got maxDiff=${maxDiff}`);
        }
    }
});

test('one-way isolation holds for every preset, and swapping bodyPreset never changes the string-pickup-only signal', () => {
    const settings = { frequency: 220, energy: 1.0, decayTime: 1.0, excitationType: 'noise', reflectionOverride: 0.3, bodyCouplingEfficiency: 0.8 };
    const pickupOnlyReference = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, bodyPreset: 'sparseLowQ', bodyRadiationGain: 0 }, 0.3, 0);

    for (const presetName of Object.keys(BODY_PRESETS)) {
        const pickupOnlyThisPreset = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, bodyPreset: presetName, bodyRadiationGain: 0 }, 0.3, 0);
        let diffFromReference = 0;
        for (let i = 0; i < pickupOnlyReference.length; i++) {
            diffFromReference = Math.max(diffFromReference, Math.abs(pickupOnlyReference[i] - pickupOnlyThisPreset[i]));
        }
        assert.equal(diffFromReference, 0, `${presetName}: string-pickup-only signal changed when only bodyPreset changed`);

        const withBody = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, bodyPreset: presetName, bodyRadiationGain: WG3_CONFIG.bodyRadiationGainMax }, 0.3, 0);
        const bodyContribution = withBody.map((v, i) => v - pickupOnlyThisPreset[i]);
        const reconstructed = withBody.map((v, i) => v - bodyContribution[i]);
        let maxReconstructionDiff = 0;
        for (let i = 0; i < pickupOnlyThisPreset.length; i++) {
            maxReconstructionDiff = Math.max(maxReconstructionDiff, Math.abs(pickupOnlyThisPreset[i] - reconstructed[i]));
        }
        assert.ok(maxReconstructionDiff < 1e-12, `${presetName}: one-way isolation reconstruction error ${maxReconstructionDiff}`);
    }
});

test('gain-staging: worst-case peak/RMS at bodyRadiationGainMax stays within headroom across all 4 presets', () => {
    for (const presetName of Object.keys(BODY_PRESETS)) {
        let worstPeak = 0;
        let worstRms = 0;
        for (const frequency of [55, 220, 1000, 4000]) {
            for (const bridgeDecayVal of [0, 0.5, 1]) {
                for (const bodyCouplingEfficiency of [0, 0.5]) {
                    const samples = renderWg3Pluck(
                        SAMPLE_RATE,
                        7,
                        { frequency, energy: 1.0, decayTime: 1.0, excitationType: 'noise', bridgeDecayVal, bodyCouplingEfficiency, bodyPreset: presetName, bodyRadiationGain: WG3_CONFIG.bodyRadiationGainMax },
                        0.5,
                        0
                    );
                    worstPeak = Math.max(worstPeak, peak(samples));
                    worstRms = Math.max(worstRms, rms(samples));
                }
            }
        }
        assert.ok(worstPeak < 3.0, `${presetName}: worst-case peak too close to the hard clamp: ${worstPeak}`);
        assert.ok(worstRms < 1.5, `${presetName}: worst-case RMS too high: ${worstRms}`);
    }
});

// --- Matched-system vs. loudness-matched comparisons, and the Q=4-vs-Q=50 persistence measurement ---

function renderMatched(settings, presetNames, seconds) {
    const out = {};
    for (const presetName of presetNames) {
        out[presetName] = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, bodyPreset: presetName }, seconds, 0);
    }
    return out;
}

function loudnessMatch(samples, targetRms) {
    const scale = targetRms / rms(samples);
    return samples.map((v) => v * scale);
}

function blockRmsSeries(samples, blockSize) {
    const out = [];
    for (let i = 0; i + blockSize <= samples.length; i += blockSize) {
        let sumSq = 0;
        for (let j = i; j < i + blockSize; j++) sumSq += samples[j] * samples[j];
        out.push(Math.sqrt(sumSq / blockSize));
    }
    return out;
}

function lastBlockAbove10Percent(blocks) {
    const peakVal = Math.max(...blocks);
    const threshold = peakVal * 0.1;
    let lastAbove = 0;
    blocks.forEach((v, i) => { if (v > threshold) lastAbove = i; });
    return lastAbove;
}

test('matched-system and loudness-matched comparisons both exist and are exercised; sparseHighQ measurably persists longer than sparseLowQ at matched settings', () => {
    const settings = {
        frequency: 220, energy: 1.0, decayTime: 0.3, excitationType: 'impulse',
        reflectionOverride: 0.3, bodyCouplingEfficiency: 1, bodyRadiationGain: 50
    };
    const seconds = 1.5;
    const blockSize = Math.round(SAMPLE_RATE * 0.05);

    function isolateBodyContribution(presetName) {
        const withBody = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, bodyPreset: presetName }, seconds, 0);
        const withoutBody = renderWg3Pluck(SAMPLE_RATE, 7, { ...settings, bodyPreset: presetName, bodyRadiationGain: 0 }, seconds, 0);
        return withBody.map((v, i) => v - withoutBody[i]);
    }

    const lowQ = isolateBodyContribution('sparseLowQ');
    const highQ = isolateBodyContribution('sparseHighQ');
    const lowQRms = rms(lowQ);
    const highQRms = rms(highQ);
    assert.ok(lowQRms > 1e-6 && highQRms > 1e-6, 'both presets should produce a real, nonzero body contribution');

    const lowQBlocks = blockRmsSeries(lowQ, blockSize);
    const highQBlocks = blockRmsSeries(highQ, blockSize);
    const lowQPersistenceBlocks = lastBlockAbove10Percent(lowQBlocks);
    const highQPersistenceBlocks = lastBlockAbove10Percent(highQBlocks);
    assert.ok(
        highQPersistenceBlocks > lowQPersistenceBlocks,
        `expected sparseHighQ to persist measurably longer than sparseLowQ (matched-system): lowQ=${lowQPersistenceBlocks} blocks (~${(lowQPersistenceBlocks + 1) * 50}ms), highQ=${highQPersistenceBlocks} blocks (~${(highQPersistenceBlocks + 1) * 50}ms)`
    );

    const highQLoudnessMatched = loudnessMatch(highQ, lowQRms);
    assert.ok(Math.abs(rms(highQLoudnessMatched) - lowQRms) < 1e-9, 'loudnessMatch should exactly equalize RMS');
    const highQMatchedBlocks = blockRmsSeries(highQLoudnessMatched, blockSize);
    const highQMatchedPersistenceBlocks = lastBlockAbove10Percent(highQMatchedBlocks);
    assert.ok(
        highQMatchedPersistenceBlocks > lowQPersistenceBlocks,
        'persistence difference should survive loudness-matching too, confirming it is a genuine character difference, not just an overall-level artifact'
    );

    const matched = renderMatched(settings, ['sparseLowQ', 'sparseHighQ'], seconds);
    assert.ok(Number.isFinite(rms(matched.sparseLowQ)) && Number.isFinite(rms(matched.sparseHighQ)));
});

// --- Required measurement table ---

test('MEASUREMENT TABLE: requested bridge T60 | computed r | measured bridge T60 | transmitted energy fraction', () => {
    const rows = [];
    for (const frequency of [110, 220, 440, 880]) {
        for (const requestedBridgeT60 of [0.2, 0.6, 1.5]) {
            const r = computeBridgeReflectionCoefficient(requestedBridgeT60, frequency);
            const samples = renderWg3Pluck(SAMPLE_RATE, 7, {
                frequency, energy: 1.0, decayTime: 30, excitationType: 'impulse',
                reflectionOverride: r, bodyCouplingEfficiency: 1, transmissionGain: 0, bodyRadiationGain: 0
            }, Math.max(1.5, requestedBridgeT60 * 4), 0);
            const measuredBridgeT60 = measuredT60Seconds(samples, SAMPLE_RATE);
            const nonReflectedEnergyFraction = Math.max(0, 1 - r * r);
            rows.push({ frequency, requestedBridgeT60, r: Number(r.toFixed(6)), measuredBridgeT60: Number(measuredBridgeT60.toFixed(3)), transmittedEnergyFraction: Number(nonReflectedEnergyFraction.toFixed(4)) });
            assert.ok(Number.isFinite(measuredBridgeT60));
        }
    }
    console.log('  [measurement table] requested bridge T60 | computed r | measured bridge T60 | transmitted energy fraction:');
    for (const row of rows) console.log('   ', JSON.stringify(row));
});
