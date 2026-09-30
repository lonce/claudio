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
import { WG2_CONFIG } from './wg2Config.js';

export function buildWg2Pipeline(sampleRate, seed) {
    const maxRailSamples = Math.ceil(sampleRate / (2 * WG2_CONFIG.frequencyMinHz)) + 4;
    const waveguide = new BidirectionalWaveguide(maxRailSamples);
    waveguide.setRailLength(sampleRate / (2 * WG2_CONFIG.frequencyDefaultHz));
    return {
        waveguide,
        nutTermination: new RigidTermination(WG2_CONFIG.terminationReflection),
        bridgeTermination: new RigidTermination(WG2_CONFIG.terminationReflection),
        lossFilter: new LoopLossFilter(WG2_CONFIG.decayTimeDefaultSeconds, sampleRate, waveguide.railLength),
        exciter: new InitialConditionExciter(seed),
        pickup: new PointPickup(),
        output: new OutputConditioner({ outputGain: WG2_CONFIG.outputGain }),
        excitationType: WG2_CONFIG.excitationTypeDefault,
        pickupType: WG2_CONFIG.pickupTypeDefault
    };
}

// settings: { frequency, energy, decayTime, excitationPosition,
// pickupPosition, excitationType, pickupType }, all optional, defaulting
// from WG2_CONFIG. Plucks once at pluckAtSeconds (default 0). blockSize
// matches the worklet's own per-block k-rate recompute granularity (128
// samples, the standard Web Audio render quantum).
export function renderWg2Pluck(sampleRate, seed, settings = {}, seconds, pluckAtSeconds = 0, blockSize = 128) {
    const {
        frequency = WG2_CONFIG.frequencyDefaultHz,
        energy = WG2_CONFIG.energyDefault,
        decayTime = WG2_CONFIG.decayTimeDefaultSeconds,
        excitationPosition = WG2_CONFIG.excitationPositionDefault,
        pickupPosition = WG2_CONFIG.pickupPositionDefault,
        excitationType = WG2_CONFIG.excitationTypeDefault,
        pickupType = WG2_CONFIG.pickupTypeDefault
    } = settings;

    const pipeline = buildWg2Pipeline(sampleRate, seed);
    pipeline.excitationType = excitationType;
    pipeline.pickupType = pickupType;

    const frameCount = Math.round(sampleRate * seconds);
    const pluckAtFrame = Math.round(sampleRate * pluckAtSeconds);
    const samples = new Float64Array(frameCount);

    const clampedFrequency = Math.max(WG2_CONFIG.frequencyMinHz, Math.min(frequency, WG2_CONFIG.frequencyMaxHz));
    pipeline.waveguide.setRailLength(sampleRate / (2 * clampedFrequency));
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
            pipeline.waveguide.tick(pipeline.nutTermination, pipeline.bridgeTermination, pipeline.lossFilter);
            const observed = pipeline.pickup.observe(pipeline.waveguide, pickupPosition, pipeline.pickupType);
            samples[i + j] = pipeline.output.tick(observed);
        }

        i += blockLength;
    }

    return samples;
}

export default { buildWg2Pipeline, renderWg2Pluck };
