#!/usr/bin/env node
// Objective, automated reality-check for PhISEM sound models' "quick-start"
// scenarios (a strike, and a sustained drive approximating holding the X/Y
// pad): flags clipping/distortion, unexpected silence, and parameters that
// have little or no audible effect across their own declared range.
//
// This is deliberately NOT a subjective "does it sound good" judgment --
// only objective signals a render can actually prove. Read-only: never
// modifies any sound model or worklet. Run on demand
// (`node scripts/checkParameterSanity.js [ModelName ...]` or
// `npm run check-params`), not wired into any build/test/CI step.
//
// Renders through the exact same DSP composition as each worklet, via the
// shared Node-side pipeline cores in soundlib/worklets/test-support/ (the
// same modules soundlib/utilities/test/*Pipeline.test.js import) -- not a
// third hand-maintained copy of the worklet logic.
//
// Per-model parameter specs below (name/min/max/default) are MANUALLY kept
// in sync with each model's own addParameter() calls in soundlib/models/
// *.js -- there's no way to introspect a live SoundModel's parameters
// outside a browser AudioContext (createNodes() constructs a real
// AudioWorkletNode). Same tradeoff already accepted elsewhere in this
// codebase (worklet parameterDescriptors vs. model addParameter() calls).

import { renderMaracaStrike, renderMaracaSustained } from '../soundlib/worklets/test-support/maracaPipelineCore.js';
import { renderBambooStrike, renderBambooSustained } from '../soundlib/worklets/test-support/bambooChimePipelineCore.js';

const SAMPLE_RATE = 44100;
const SEED = 42;
const STRIKE_SECONDS = 8; // generous enough for the slowest current systemDecay (2.0s max, across all models)
const SUSTAINED_SECONDS = 2;
const SUSTAINED_DRIVE = 0.7;

// OutputConditioner's own hard clamp (soundlib/utilities/OutputConditioner.js,
// OUTPUT_CLAMP = 4) -- a raw worklet-output peak approaching this is an
// unambiguous "something is pathological" signal. Not an attempt to predict
// real-world clipping after the model's own `gain` parameter and downstream
// mixing, which this tool has no visibility into.
const CLAMP_WARNING_FRACTION = 0.9;

// Informed starting points, not derived/validated numbers. Calibrated
// once against a real case: reintroducing the collision-routing bug fixed
// earlier this session (BambooChimes' collisionDecaySeconds) produced an
// RMS ratio of only ~1.5x across its full declared range, vs. ~12.5x for
// the fixed code and 2.3x-900x for every other genuinely-working parameter
// checked -- 1.15 would have missed that bug; 2.0 catches it with margin
// below the smallest known-real effect (Cabasa's numberOfObjects, ~2.3x).
const NO_EFFECT_RMS_RATIO = 2.0;
const NO_EFFECT_ZCR_RATIO = 1.10;
const SILENCE_RMS_FLOOR = 1e-4;
// 0.05s was too tight a first pass: sparse-collision models (BambooChimes'
// low collisionDensity default) can legitimately have their first collision
// land well after 50ms, which isn't itself a problem -- widened to 0.5s,
// confirmed against several seeds this session that this stops flagging
// BambooChimes' normal sparse-strike timing as "no attack."
const ATTACK_WINDOW_SECONDS = 0.5;
const TAIL_WINDOW_SECONDS = 0.1;

function rms(samples, start = 0, length = samples.length - start) {
    let sum = 0;
    for (let i = start; i < start + length; i++) sum += samples[i] * samples[i];
    return Math.sqrt(sum / length);
}

function peakAbs(samples) {
    let peak = 0;
    for (const s of samples) {
        const a = Math.abs(s);
        if (a > peak) peak = a;
    }
    return peak;
}

function zeroCrossingRate(samples) {
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) {
        if (samples[i - 1] < 0 && samples[i] >= 0) crossings++;
    }
    return crossings / samples.length;
}

function windowSamples(seconds) {
    return Math.round(SAMPLE_RATE * seconds);
}

// --- Per-model specs -----------------------------------------------------

const MARACA_SETTING_KEYS = ['systemDecay', 'resonanceFrequency', 'resonanceBandwidth', 'collisionRateScale', 'collisionDecaySeconds'];

function maracaSettings(paramValues) {
    const settings = {};
    for (const key of MARACA_SETTING_KEYS) {
        if (paramValues[key] !== undefined) settings[key] = paramValues[key];
    }
    return settings;
}

const BAMBOO_SETTING_KEYS = ['systemDecay', 'resonanceBandwidth', 'frequencyScale', 'collisionRateScale', 'collisionDecaySeconds'];

function bambooSettings(paramValues) {
    const settings = {};
    for (const key of BAMBOO_SETTING_KEYS) {
        if (paramValues[key] !== undefined) settings[key] = paramValues[key];
    }
    return settings;
}

const MODELS = {
    Maraca: {
        driveParam: 'shakeEnergy',
        parameters: {
            shakeEnergy: { min: 0, max: 1, default: 0 },
            systemDecay: { min: 0.01, max: 2.0, default: 0.022664397202380334 },
            numberOfObjects: { min: 4, max: 256, default: 64 },
            resonanceFrequency: { min: 500, max: 8000, default: 3200 }
        },
        renderStrike: (paramValues, seconds) =>
            renderMaracaStrike(SAMPLE_RATE, SEED, maracaSettings(paramValues), paramValues.numberOfObjects, seconds).samples,
        renderSustained: (paramValues, driveLevel, seconds) =>
            renderMaracaSustained(SAMPLE_RATE, SEED, maracaSettings(paramValues), paramValues.numberOfObjects, driveLevel, seconds)
    },
    Cabasa: {
        driveParam: 'shakeEnergy',
        parameters: {
            shakeEnergy: { min: 0, max: 1, default: 0 },
            systemDecay: { min: 0.001, max: 2.0, default: 0.007547235441215851 },
            numberOfObjects: { min: 32, max: 1024, default: 512 },
            resonanceFrequency: { min: 100, max: 8000, default: 3000 },
            resonanceBandwidth: { min: 15, max: 6000, default: 5006.81239170988 },
            collisionRateScale: { min: 0.5, max: 64, default: 8 },
            collisionDecaySeconds: { min: 0.0001, max: 0.01, default: 0.0005554784186304259 }
        },
        renderStrike: (paramValues, seconds) =>
            renderMaracaStrike(SAMPLE_RATE, SEED, maracaSettings(paramValues), paramValues.numberOfObjects, seconds).samples,
        renderSustained: (paramValues, driveLevel, seconds) =>
            renderMaracaSustained(SAMPLE_RATE, SEED, maracaSettings(paramValues), paramValues.numberOfObjects, driveLevel, seconds)
    },
    BambooChimes: {
        driveParam: 'shakeEnergy',
        parameters: {
            shakeEnergy: { min: 0, max: 1, default: 0 },
            systemDecay: { min: 0.01, max: 2.0, default: 0.9 },
            collisionDensity: { min: 0.1, max: 20, default: 1.2 },
            resonanceBandwidth: { min: 2, max: 100, default: 56.262464017889606 },
            frequencyScale: { min: 0.5, max: 2.0, default: 1.0 },
            collisionDecaySeconds: { min: 0.0001, max: 0.01, default: 0.00044207994889396086 },
            collisionRateScale: { min: 0.5, max: 64, default: 15 }
        },
        renderStrike: (paramValues, seconds) =>
            renderBambooStrike(SAMPLE_RATE, SEED, bambooSettings(paramValues), paramValues.collisionDensity, seconds),
        renderSustained: (paramValues, driveLevel, seconds) =>
            renderBambooSustained(SAMPLE_RATE, SEED, bambooSettings(paramValues), paramValues.collisionDensity, driveLevel, seconds)
    }
};

// --- Checking logic --------------------------------------------------------

function defaultsOf(spec) {
    const out = {};
    for (const [name, { default: d }] of Object.entries(spec.parameters)) out[name] = d;
    return out;
}

function describeLevel(samples) {
    const peak = peakAbs(samples);
    const clamped = peak >= 4 * CLAMP_WARNING_FRACTION;
    return { peak, clamped };
}

function checkModel(modelName, spec) {
    const findings = [];
    const defaults = defaultsOf(spec);

    // 1. Strike scenario at defaults.
    const strikeSamples = spec.renderStrike(defaults, STRIKE_SECONDS);
    const attackRms = rms(strikeSamples, 0, windowSamples(ATTACK_WINDOW_SECONDS));
    const tailRms = rms(strikeSamples, strikeSamples.length - windowSamples(TAIL_WINDOW_SECONDS));
    const { peak: strikePeak, clamped: strikeClamped } = describeLevel(strikeSamples);
    console.log(`  Strike (defaults):    peak=${strikePeak.toFixed(4)}  attackRMS=${attackRms.toFixed(4)}  tailRMS=${tailRms.toExponential(2)}`);
    if (attackRms < SILENCE_RMS_FLOOR) findings.push(`Strike produced no audible attack (RMS ${attackRms.toExponential(2)})`);
    if (tailRms > 1e-3) findings.push(`Strike never decayed to near-silence within ${STRIKE_SECONDS}s (tail RMS ${tailRms.toExponential(2)})`);
    if (strikeClamped) findings.push(`Strike hit the output's hard clamp (peak ${strikePeak.toFixed(3)}) -- likely distortion`);

    // 2. Sustained scenario (approximates holding the X/Y pad).
    const sustainedSamples = spec.renderSustained(defaults, SUSTAINED_DRIVE, SUSTAINED_SECONDS);
    const steadyRms = rms(sustainedSamples, sustainedSamples.length - windowSamples(0.5));
    const { peak: sustainedPeak, clamped: sustainedClamped } = describeLevel(sustainedSamples);
    console.log(`  Sustained (drive=${SUSTAINED_DRIVE}): peak=${sustainedPeak.toFixed(4)}  steadyRMS=${steadyRms.toFixed(4)}`);
    if (steadyRms < SILENCE_RMS_FLOOR) findings.push(`Sustained drive at ${SUSTAINED_DRIVE} produced no audible output (RMS ${steadyRms.toExponential(2)})`);
    if (sustainedClamped) findings.push(`Sustained drive hit the output's hard clamp (peak ${sustainedPeak.toFixed(3)}) -- likely distortion`);

    // 3. Per-parameter min/max sweep (drive parameter already covered above).
    console.log('  Parameter sweep:');
    for (const [paramName, { min, max, default: def }] of Object.entries(spec.parameters)) {
        if (paramName === spec.driveParam) continue;

        const lowSamples = spec.renderStrike({ ...defaults, [paramName]: min }, STRIKE_SECONDS);
        const highSamples = spec.renderStrike({ ...defaults, [paramName]: max }, STRIKE_SECONDS);
        const lowRms = rms(lowSamples);
        const highRms = rms(highSamples);
        const lowZcr = zeroCrossingRate(lowSamples);
        const highZcr = zeroCrossingRate(highSamples);
        const { peak: lowPeak, clamped: lowClamped } = describeLevel(lowSamples);
        const { peak: highPeak, clamped: highClamped } = describeLevel(highSamples);

        const rmsRatio = Math.max(lowRms, highRms) / Math.max(1e-9, Math.min(lowRms, highRms));
        const zcrRatio = Math.max(lowZcr, highZcr) / Math.max(1e-9, Math.min(lowZcr, highZcr));

        const bothNearSilent = lowRms < SILENCE_RMS_FLOOR && highRms < SILENCE_RMS_FLOOR;
        let status = 'OK';
        if (bothNearSilent) {
            status = 'WARNING: near-silent across its whole range';
            findings.push(`${paramName}: near-silent at both min (${min}) and max (${max})`);
        } else if (rmsRatio < NO_EFFECT_RMS_RATIO && zcrRatio < NO_EFFECT_ZCR_RATIO) {
            status = 'WARNING: little/no audible difference';
            findings.push(`${paramName}: little/no audible difference between min (${min}) and max (${max}) -- RMS ratio ${rmsRatio.toFixed(2)}, ZCR ratio ${zcrRatio.toFixed(2)}`);
        }
        if (lowClamped || highClamped) {
            status = (status === 'OK' ? 'WARNING: clamp hit' : `${status}; clamp hit`);
            findings.push(`${paramName}: hit the output's hard clamp at ${lowClamped ? 'min' : 'max'} (peak ${(lowClamped ? lowPeak : highPeak).toFixed(3)})`);
        }

        console.log(
            `    ${paramName.padEnd(22)} [${min} .. ${max}] default=${def}` +
            `  rmsRatio=${rmsRatio.toFixed(2)} zcrRatio=${zcrRatio.toFixed(2)}  ${status}`
        );
    }

    return findings;
}

// --- Entry point -----------------------------------------------------------

const requested = process.argv.slice(2);
const modelNames = requested.length > 0
    ? requested.filter((name) => MODELS[name])
    : Object.keys(MODELS);

if (requested.length > 0 && modelNames.length === 0) {
    console.error(`No matching models. Known models: ${Object.keys(MODELS).join(', ')}`);
    process.exit(1);
}

let totalFindings = 0;
for (const modelName of modelNames) {
    console.log(`\n=== ${modelName} ===`);
    const findings = checkModel(modelName, MODELS[modelName]);
    totalFindings += findings.length;
    if (findings.length > 0) {
        console.log(`  ${findings.length} finding(s):`);
        for (const f of findings) console.log(`    - ${f}`);
    }
}

console.log(`\n${modelNames.length} model(s) checked, ${totalFindings} finding(s) total.`);
process.exit(totalFindings > 0 ? 1 : 0);
