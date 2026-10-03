import test from 'node:test';
import assert from 'node:assert/strict';
import { BodyModeBank } from '../BodyModeBank.js';
import { ResonatorBank } from '../ResonatorBank.js';
import { decaySecondsFromQ, discreteResonatorGainAtCenter } from '../decayMath.js';
import { BODY_PRESETS } from '../../models/WG3/bodyConfig.js';

const SAMPLE_RATE = 48000;
const Q = 4;

function modes(frequencies) {
    return frequencies.map((frequencyHz, i) => ({
        frequencyHz,
        decaySeconds: decaySecondsFromQ(frequencyHz, Q),
        relativeGain: 1 - i * 0.1
    }));
}

const TEST_MODES = modes([185, 340, 505, 710]);

function peakSearchFrequency(samples, sampleRate, approxHz, searchWidthHz, blockSize = 4096) {
    const n = Math.min(samples.length, blockSize);
    const magnitudeAt = (hz) => {
        let re = 0;
        let im = 0;
        for (let i = 0; i < n; i++) {
            const angle = (2 * Math.PI * hz * i) / sampleRate;
            re += samples[i] * Math.cos(angle);
            im -= samples[i] * Math.sin(angle);
        }
        return Math.sqrt(re * re + im * im);
    };
    let bestHz = approxHz;
    let bestMag = -Infinity;
    const steps = 200;
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

test('silent without excitation', () => {
    const body = new BodyModeBank(SAMPLE_RATE, TEST_MODES);
    for (let i = 0; i < 1000; i++) {
        assert.ok(body.tick() === 0, `expected 0 at sample ${i} with no excitation`);
    }
});

test('deterministic: two identically-constructed, identically-driven instances produce identical output', () => {
    const a = new BodyModeBank(SAMPLE_RATE, TEST_MODES);
    const b = new BodyModeBank(SAMPLE_RATE, TEST_MODES);
    let maxDiff = 0;
    for (let i = 0; i < 2000; i++) {
        const x = Math.sin(i * 0.07) * 0.6 + (i % 11 === 0 ? 0.4 : 0);
        a.excite(x);
        b.excite(x);
        maxDiff = Math.max(maxDiff, Math.abs(a.tick() - b.tick()));
    }
    assert.equal(maxDiff, 0);
});

test('stays finite under sustained and extreme-magnitude drive', () => {
    const body = new BodyModeBank(SAMPLE_RATE, TEST_MODES);
    for (let i = 0; i < 10000; i++) {
        const x = Math.sin(i * 0.37) * 50 + Math.cos(i * 2.1) * 50;
        body.excite(x);
        const y = body.tick();
        assert.ok(Number.isFinite(y), `non-finite output at sample ${i}`);
    }
});

test('reset() clears state back to a fresh instance\'s own response', () => {
    const fresh = new BodyModeBank(SAMPLE_RATE, TEST_MODES);
    const reused = new BodyModeBank(SAMPLE_RATE, TEST_MODES);

    for (let i = 0; i < 500; i++) reused.excite(Math.sin(i * 0.3) * 0.9), reused.tick();
    reused.reset();

    let maxDiff = 0;
    for (let i = 0; i < 500; i++) {
        const x = Math.sin(i * 0.05) * 0.5;
        fresh.excite(x);
        reused.excite(x);
        maxDiff = Math.max(maxDiff, Math.abs(fresh.tick() - reused.tick()));
    }
    assert.equal(maxDiff, 0);
});

// --- Phase C.5.2: every mode of every registered preset, not just one fixed Q=4 set ---

test('every preset\'s every mode: impulse response peaks near its own declared frequency (config-to-ResonatorBank wiring is correct)', () => {
    // A loose tolerance (+-5%) -- low-Q modes have genuinely broad
    // resonance peaks; the per-mode frequency-accuracy math itself is
    // already ResonatorBank's own proven responsibility, this confirms
    // BodyModeBank's/the preset config's wiring only.
    for (const [presetName, preset] of Object.entries(BODY_PRESETS)) {
        for (const mode of preset.modes) {
            const solo = new BodyModeBank(SAMPLE_RATE, [mode]);
            solo.excite(1.0);
            const n = Math.round(SAMPLE_RATE * 0.3);
            const samples = new Float64Array(n);
            for (let i = 0; i < n; i++) samples[i] = solo.tick();
            const measured = peakSearchFrequency(samples, SAMPLE_RATE, mode.frequencyHz, mode.frequencyHz * 0.3);
            const relativeError = Math.abs(measured - mode.frequencyHz) / mode.frequencyHz;
            assert.ok(relativeError < 0.05, `${presetName} mode ${mode.frequencyHz}Hz: measured peak at ${measured.toFixed(1)}Hz, error ${(relativeError * 100).toFixed(1)}%`);
        }
    }
});

test('every preset\'s every mode: decay roughly matches its own declared decaySeconds (derived from q)', () => {
    // Loose tolerance (a factor of ~2) -- same rationale as the frequency
    // check above: ResonatorBank's own per-sample decay math is already
    // proven; this confirms the configured decaySeconds (derived from
    // each preset's own q) actually reaches it.
    for (const [presetName, preset] of Object.entries(BODY_PRESETS)) {
        for (const mode of preset.modes) {
            const solo = new BodyModeBank(SAMPLE_RATE, [mode]);
            solo.excite(1.0);
            const n = Math.round(SAMPLE_RATE * Math.max(0.3, mode.decaySeconds * 10));
            const samples = new Float64Array(n);
            for (let i = 0; i < n; i++) samples[i] = solo.tick();

            const blockLen = Math.max(32, Math.round(SAMPLE_RATE * 0.002));
            const rmsAt = (start) => {
                let sumSq = 0;
                for (let i = start; i < start + blockLen; i++) sumSq += samples[i] * samples[i];
                return Math.sqrt(sumSq / blockLen);
            };
            const early = rmsAt(blockLen);
            const tauSamples = Math.round(mode.decaySeconds * SAMPLE_RATE);
            const lateStart = Math.min(early > 0 ? blockLen + tauSamples : blockLen, n - blockLen - 1);
            const late = rmsAt(lateStart);
            const ratio = late / early;
            assert.ok(ratio > 0.15 && ratio < 0.7, `${presetName} mode ${mode.frequencyHz}Hz (q=${mode.q}): decay ratio after 1 tau was ${ratio.toFixed(3)}, expected roughly 0.37`);
        }
    }
});

// --- Gain-compensation formula validation: exact closed-form, confirmed by direct simulation ---
//
// discreteResonatorGainAtCenter() is an EXACT algebraic evaluation of
// ResonatorBank's own literal difference equation's transfer function at
// z=e^(j*theta) -- not an empirical fit. Re-validated here (not just
// trusted from its C.5.1 derivation) across the FULL C.5.2 range: every
// modal frequency used by every preset, both supported sample rates.

function simulateSteadyStateGain(f0Hz, decaySeconds, sampleRate) {
    const bank = new ResonatorBank(sampleRate, 1);
    bank.setMode(0, f0Hz, decaySeconds, 1.0);
    // Settle well past the mode's own time constant before measuring.
    const settle = Math.max(Math.round(sampleRate * 2), Math.round(decaySeconds * sampleRate * 30));
    const measure = Math.round(sampleRate * 0.05);
    let maxIn = 0;
    let maxOut = 0;
    for (let i = 0; i < settle + measure; i++) {
        const x = Math.sin((2 * Math.PI * f0Hz * i) / sampleRate);
        bank.excite(0, x);
        const y = bank.tick();
        if (i >= settle) {
            maxIn = Math.max(maxIn, Math.abs(x));
            maxOut = Math.max(maxOut, Math.abs(y));
        }
    }
    return maxOut / maxIn;
}

test('discreteResonatorGainAtCenter() is exact: matches direct simulation across every preset\'s modal frequency x both supported sample rates', () => {
    let worstRelErr = 0;
    let worstCase = null;
    for (const sampleRate of [44100, 48000]) {
        for (const [presetName, preset] of Object.entries(BODY_PRESETS)) {
            for (const mode of preset.modes) {
                const formula = discreteResonatorGainAtCenter(mode.frequencyHz, mode.decaySeconds, sampleRate);
                const sim = simulateSteadyStateGain(mode.frequencyHz, mode.decaySeconds, sampleRate);
                const relErr = Math.abs(formula - sim) / sim;
                if (relErr > worstRelErr) {
                    worstRelErr = relErr;
                    worstCase = { presetName, frequencyHz: mode.frequencyHz, q: mode.q, sampleRate, formula, sim };
                }
            }
        }
    }
    // The formula is exact; the small residual here is simulation
    // measurement noise (finite settle time, discrete sampling of a
    // continuous sinusoid's true peak), not formula error -- a tight
    // tolerance (well under 1%) confirms "exact," not "approximately
    // exact in a range happened to be checked before."
    assert.ok(worstRelErr < 0.001, `worst relative error ${worstRelErr} too large to call the formula exact; worst case: ${JSON.stringify(worstCase)}`);
});

// --- Modal-frequency-scale preservation (Comparison B's own correctness check) ---

test('sparseLowQLarge/sparseLowQSmall preserve sparseLowQ\'s modal-frequency ratios exactly, and its Q (not its absolute decaySeconds)', () => {
    const base = BODY_PRESETS.sparseLowQ;
    for (const [scaledName, expectedFactor] of [['sparseLowQLarge', 0.5], ['sparseLowQSmall', 2.0]]) {
        const scaled = BODY_PRESETS[scaledName];
        assert.equal(scaled.modes.length, base.modes.length);
        for (let i = 0; i < base.modes.length; i++) {
            const ratio = scaled.modes[i].frequencyHz / base.modes[i].frequencyHz;
            assert.ok(Math.abs(ratio - expectedFactor) < 1e-9, `${scaledName} mode ${i}: frequency ratio ${ratio}, expected exactly ${expectedFactor}`);
            // Q preserved (not decaySeconds copied) -- q*pi*f recovers
            // the SAME q at the new, scaled frequency.
            assert.equal(scaled.modes[i].q, base.modes[i].q);
            const expectedDecaySeconds = decaySecondsFromQ(scaled.modes[i].frequencyHz, scaled.modes[i].q);
            assert.ok(Math.abs(scaled.modes[i].decaySeconds - expectedDecaySeconds) < 1e-12);
            // relativeGain untouched by scaling.
            assert.equal(scaled.modes[i].relativeGain, base.modes[i].relativeGain);
        }
    }
});
