// Node-side mirror of wg2Processor.js's DSP composition -- same rationale
// as every other pipeline-core file: AudioWorkletProcessor requires a
// browser and can't run under `node --test` or a plain Node script. Must
// be kept in sync BY HAND with wg2Processor.js's actual process() loop.

import { BidirectionalWaveguide } from '../../utilities/BidirectionalWaveguide.js';
import { LoopLossFilter } from '../../utilities/LoopLossFilter.js';
import { RigidTermination } from '../../utilities/RigidTermination.js';
import { InitialConditionExciter } from '../../utilities/InitialConditionExciter.js';
import { PointPickup } from '../../utilities/PointPickup.js';
import { OutputConditioner } from '../../utilities/OutputConditioner.js';
import { DispersionFilter } from '../../utilities/DispersionFilter.js';
import { DEFAULT_INTERPOLATION_MODE } from '../../utilities/createInterpolator.js';
import { WG2_CONFIG } from './wg2Config.js';

export function buildWg2Pipeline(sampleRate, seed, interpolationMode = DEFAULT_INTERPOLATION_MODE) {
    const maxRailSamples = Math.ceil(sampleRate / (2 * WG2_CONFIG.frequencyMinHz)) + 4;
    const waveguide = new BidirectionalWaveguide(maxRailSamples, interpolationMode);
    waveguide.setRailLength(sampleRate / (2 * WG2_CONFIG.frequencyDefaultHz));
    return {
        waveguide,
        nutTermination: new RigidTermination(WG2_CONFIG.terminationReflection),
        bridgeTermination: new RigidTermination(WG2_CONFIG.terminationReflection),
        lossFilter: new LoopLossFilter(WG2_CONFIG.decayTimeDefaultSeconds, sampleRate, waveguide.railLength),
        exciter: new InitialConditionExciter(seed),
        pickup: new PointPickup(),
        output: new OutputConditioner({ outputGain: WG2_CONFIG.outputGain }),
        dispersionFilter: new DispersionFilter(
            WG2_CONFIG.dispersionSectionCount,
            WG2_CONFIG.dispersionKnee,
            WG2_CONFIG.dispersionSlope,
            WG2_CONFIG.dispersionAmountMaxCents,
            WG2_CONFIG.dispersionStiffnessCurveExponent
        ),
        excitationType: WG2_CONFIG.excitationTypeDefault,
        pickupType: WG2_CONFIG.pickupTypeDefault
    };
}

// settings: { frequency, energy, decayTime, excitationPosition,
// pickupPosition, excitationType, pickupType, stiffness }, all optional,
// defaulting from WG2_CONFIG. interpolationMode: 'lagrange3' (default),
// 'linear', or 'allpass1' -- see createInterpolator.js. Plucks once at
// pluckAtSeconds (default 0). blockSize matches the worklet's own
// per-block k-rate recompute granularity (128 samples, the standard Web
// Audio render quantum).
export function renderWg2Pluck(sampleRate, seed, settings = {}, seconds, pluckAtSeconds = 0, blockSize = 128, interpolationMode = DEFAULT_INTERPOLATION_MODE) {
    const {
        frequency = WG2_CONFIG.frequencyDefaultHz,
        energy = WG2_CONFIG.energyDefault,
        decayTime = WG2_CONFIG.decayTimeDefaultSeconds,
        excitationPosition = WG2_CONFIG.excitationPositionDefault,
        pickupPosition = WG2_CONFIG.pickupPositionDefault,
        excitationType = WG2_CONFIG.excitationTypeDefault,
        pickupType = WG2_CONFIG.pickupTypeDefault,
        stiffness = WG2_CONFIG.stiffnessDefault
    } = settings;

    const pipeline = buildWg2Pipeline(sampleRate, seed, interpolationMode);
    pipeline.excitationType = excitationType;
    pipeline.pickupType = pickupType;

    const frameCount = Math.round(sampleRate * seconds);
    const pluckAtFrame = Math.round(sampleRate * pluckAtSeconds);
    const samples = new Float64Array(frameCount);

    const clampedFrequency = Math.max(WG2_CONFIG.frequencyMinHz, Math.min(frequency, WG2_CONFIG.frequencyMaxHz));
    // Matches wg2Processor.js's own per-block ordering: dispersion state
    // first, then the pitchLocked-compensated rail length derived from it,
    // then the loss filter (which depends on the now-compensated rail
    // length). A static settings object means this only needs computing
    // once here, unlike the real worklet's per-block recompute.
    pipeline.dispersionFilter.setStiffness(stiffness, clampedFrequency, sampleRate);
    const compensationSamples = pipeline.dispersionFilter.groupDelaySamplesAt(clampedFrequency, sampleRate);
    const railLength = Math.max(1, (sampleRate / clampedFrequency - compensationSamples) / 2);
    pipeline.waveguide.setRailLength(railLength);
    pipeline.lossFilter.setDecayTime(decayTime, sampleRate, pipeline.waveguide.railLength);

    let i = 0;
    let plucked = false;
    while (i < frameCount) {
        const blockLength = Math.min(blockSize, frameCount - i);

        if (!plucked && i + blockLength > pluckAtFrame) {
            pipeline.exciter.exciteAtPosition(
                pipeline.waveguide.rightGoing,
                pipeline.waveguide.leftGoing,
                pipeline.waveguide.railLength,
                excitationPosition,
                pipeline.excitationType,
                energy
            );
            plucked = true;
        }

        for (let j = 0; j < blockLength; j++) {
            pipeline.waveguide.tick(pipeline.nutTermination, pipeline.bridgeTermination, pipeline.lossFilter, pipeline.dispersionFilter);
            const observed = pipeline.pickup.observe(pipeline.waveguide, pickupPosition, pipeline.pickupType);
            samples[i + j] = pipeline.output.tick(observed);
        }

        i += blockLength;
    }

    return samples;
}

export default { buildWg2Pipeline, renderWg2Pluck };
