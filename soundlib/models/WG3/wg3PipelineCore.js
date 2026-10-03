// Node-side mirror of wg3Processor.js's DSP composition -- same rationale
// as every other pipeline-core file: AudioWorkletProcessor requires a
// browser and can't run under `node --test` or a plain Node script.
//
// Reuses buildWg2Pipeline/renderWg2Pluck directly rather than restating
// their construction/render-loop logic -- the only genuinely new code
// here is constructing a BridgeTermination and wiring it into WG2's own
// pipeline-core functions via the bridgeTermination/onSample extension
// points those functions now expose (see wg2PipelineCore.js's own
// comment on renderWg2Pluck's overrides parameter).

import { buildWg2Pipeline, renderWg2Pluck } from '../WG2/wg2PipelineCore.js';
import { WG2_CONFIG } from '../WG2/wg2Config.js';
import { BridgeTermination } from '../../utilities/BridgeTermination.js';
import { BodyModeBank } from '../../utilities/BodyModeBank.js';
import { BODY_PRESETS } from './bodyConfig.js';
import { DEFAULT_INTERPOLATION_MODE } from '../../utilities/createInterpolator.js';
import { WG3_CONFIG } from './wg3Config.js';
import { bridgeDecayValToSeconds, computeBridgeReflectionCoefficient } from './bridgeDecayMath.js';

export function buildWg3Pipeline(sampleRate, seed, interpolationMode = DEFAULT_INTERPOLATION_MODE, bodyPreset = WG3_CONFIG.bodyPresetDefault) {
    const pipeline = buildWg2Pipeline(sampleRate, seed, interpolationMode);
    pipeline.bridgeTermination = new BridgeTermination(sampleRate, WG3_CONFIG.bridgeShelfCornerHz);
    // Phase C.5.1/C.5.2 -- attached here too (not just in renderWg3Pluck)
    // so tests driving the pipeline directly can poke at it, mirroring
    // pipeline.bridgeTermination.
    pipeline.bodyModeBank = new BodyModeBank(sampleRate, BODY_PRESETS[bodyPreset].modes);
    return pipeline;
}

// settings: everything renderWg2Pluck accepts, plus { bridgeDecayVal,
// reflectionTilt, bodyCouplingEfficiency, pickupGain, transmissionGain,
// bodyRadiationGain, bodyPreset }, all optional, defaulting from
// WG3_CONFIG. At those defaults this renders sample-identical to
// renderWg2Pluck with the same settings/seed PROVIDED bridgeDecayVal is
// also explicitly set to whatever maps to reflection=1 (bridgeDecayVal's
// own default is no longer that no-op point -- see wg3Config.js) -- see
// wg3Pipeline.test.js's own regression proof for the explicit-neutral-
// settings version of this claim.
//
// reflectionOverride (advanced/diagnostic only, matching the directive's
// own "preserve a legacy raw-reflection path for tests" instruction): if
// given, sets bridgeTermination.reflection directly, bypassing the
// bridgeDecayVal -> seconds -> r mapping entirely. Lets a test sweep the
// raw coefficient (e.g. for the passivity/energy-identity checks) without
// going through the T60 conversion.
export function renderWg3Pluck(sampleRate, seed, settings = {}, seconds, pluckAtSeconds = 0, blockSize = 128, interpolationMode = DEFAULT_INTERPOLATION_MODE) {
    const {
        bridgeDecayVal = WG3_CONFIG.bridgeDecayValDefault,
        reflectionOverride,
        reflectionTilt = WG3_CONFIG.terminationReflectionTiltDefault,
        bodyCouplingEfficiency = WG3_CONFIG.bodyCouplingEfficiencyDefault,
        pickupGain = WG3_CONFIG.pickupGainDefault,
        transmissionGain = WG3_CONFIG.transmissionGainDefault,
        bodyRadiationGain = WG3_CONFIG.bodyRadiationGainDefault,
        bodyPreset = WG3_CONFIG.bodyPresetDefault,
        frequency = WG2_CONFIG.frequencyDefaultHz,
        ...wg2SettingsRest
    } = settings;
    const wg2Settings = { ...wg2SettingsRest, frequency };

    const bridgeTermination = new BridgeTermination(sampleRate, WG3_CONFIG.bridgeShelfCornerHz);
    if (reflectionOverride !== undefined) {
        bridgeTermination.reflection = reflectionOverride;
    } else {
        const clampedFrequency = Math.max(WG2_CONFIG.frequencyMinHz, Math.min(frequency, WG2_CONFIG.frequencyMaxHz));
        const bridgeDecayTimeSeconds = bridgeDecayValToSeconds(bridgeDecayVal, WG3_CONFIG.bridgeDecayTimeMinSeconds, WG3_CONFIG.bridgeDecayTimeMaxSeconds);
        bridgeTermination.reflection = computeBridgeReflectionCoefficient(bridgeDecayTimeSeconds, clampedFrequency);
    }
    bridgeTermination.reflectionTilt = reflectionTilt;
    bridgeTermination.couplingEfficiency = bodyCouplingEfficiency;

    // renderWg2Pluck's own `pipeline` argument to onSample is WG2's
    // pipeline object (from buildWg2Pipeline) and carries no bodyModeBank
    // field -- kept as a closure-local variable here rather than
    // threading a further extension point through wg2PipelineCore.js, a
    // small, deliberate exception (see wg3PipelineCore.js's own plan
    // notes).
    const bodyModeBank = new BodyModeBank(sampleRate, BODY_PRESETS[bodyPreset].modes);

    return renderWg2Pluck(sampleRate, seed, wg2Settings, seconds, pluckAtSeconds, blockSize, interpolationMode, {
        bridgeTermination,
        onSample: (observed, pipeline) => {
            const transmitted = pipeline.waveguide.lastTransmittedSignal;
            bodyModeBank.excite(transmitted);
            const bodyRadiation = bodyModeBank.tick();
            return pickupGain * observed + transmissionGain * transmitted + bodyRadiationGain * bodyRadiation;
        }
    });
}

export default { buildWg3Pipeline, renderWg3Pluck };
