// Node-side mirror of wg1Processor.js's DSP composition -- same rationale
// as every other pipeline-core file: AudioWorkletProcessor requires a
// browser and can't run under `node --test` or a plain Node script. Must
// be kept in sync BY HAND with wg1Processor.js's actual process() loop.

import { FractionalDelayWaveguide } from '../../utilities/FractionalDelayWaveguide.js';
import { LoopLossFilter } from '../../utilities/LoopLossFilter.js';
import { RigidTermination } from '../../utilities/RigidTermination.js';
import { InitialConditionExciter } from '../../utilities/InitialConditionExciter.js';
import { OutputConditioner } from '../../utilities/OutputConditioner.js';
import { createInterpolator, DEFAULT_INTERPOLATION_MODE } from '../../utilities/createInterpolator.js';
import { WG1_CONFIG } from './wg1Config.js';

export function buildWg1Pipeline(sampleRate, seed, interpolationMode = DEFAULT_INTERPOLATION_MODE) {
    const maxDelaySamples = Math.ceil(sampleRate / WG1_CONFIG.frequencyMinHz) + 4;
    const waveguide = new FractionalDelayWaveguide(maxDelaySamples);
    waveguide.setDelaySamples(sampleRate / WG1_CONFIG.frequencyDefaultHz);
    return {
        waveguide,
        lossFilter: new LoopLossFilter(WG1_CONFIG.decayTimeDefaultSeconds, sampleRate, waveguide.delaySamples),
        termination: new RigidTermination(WG1_CONFIG.terminationReflection),
        exciter: new InitialConditionExciter(seed),
        output: new OutputConditioner({ outputGain: WG1_CONFIG.outputGain }),
        interpolator: createInterpolator(interpolationMode),
        excitationType: WG1_CONFIG.excitationTypeDefault
    };
}

// settings: { frequency, energy, decayTime, excitationType }, all
// optional, defaulting from WG1_CONFIG. interpolationMode: 'linear'
// (default), 'linear', or 'allpass1' -- see createInterpolator.js.
// Plucks once at pluckAtSeconds (default 0).
// blockSize matches the worklet's own per-block k-rate recompute
// granularity (128 samples, the standard Web Audio render quantum).
export function renderWg1Pluck(sampleRate, seed, settings = {}, seconds, pluckAtSeconds = 0, blockSize = 128, interpolationMode = DEFAULT_INTERPOLATION_MODE) {
    const {
        frequency = WG1_CONFIG.frequencyDefaultHz,
        energy = WG1_CONFIG.energyDefault,
        decayTime = WG1_CONFIG.decayTimeDefaultSeconds,
        excitationType = WG1_CONFIG.excitationTypeDefault
    } = settings;

    const pipeline = buildWg1Pipeline(sampleRate, seed, interpolationMode);
    pipeline.excitationType = excitationType;

    const frameCount = Math.round(sampleRate * seconds);
    const pluckAtFrame = Math.round(sampleRate * pluckAtSeconds);
    const samples = new Float64Array(frameCount);

    const clampedFrequency = Math.max(WG1_CONFIG.frequencyMinHz, Math.min(frequency, WG1_CONFIG.frequencyMaxHz));
    pipeline.waveguide.setDelaySamples(sampleRate / clampedFrequency);
    pipeline.lossFilter.setDecayTime(decayTime, sampleRate, pipeline.waveguide.delaySamples);

    let i = 0;
    let plucked = false;
    while (i < frameCount) {
        const blockLength = Math.min(blockSize, frameCount - i);

        if (!plucked && i + blockLength > pluckAtFrame) {
            pipeline.exciter.excite(pipeline.waveguide, pipeline.waveguide.delaySamples, pipeline.excitationType, energy);
            plucked = true;
        }

        for (let j = 0; j < blockLength; j++) {
            const delayed = pipeline.waveguide.read(pipeline.interpolator);
            const reflected = pipeline.termination.reflect(delayed);
            const filtered = pipeline.lossFilter.process(reflected);
            pipeline.waveguide.write(filtered);
            samples[i + j] = pipeline.output.tick(filtered);
        }

        i += blockLength;
    }

    return samples;
}

export default { buildWg1Pipeline, renderWg1Pluck };
