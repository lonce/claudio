import { PlusSimplexPhasor } from '../utilities/PlusSimplexPhasor.js';

/**
 * Timing-only AudioWorklet wrapper for PlusSimplexPhasor.
 *
 * It intentionally outputs silence. SoundModels decide what each phase-event
 * notification should trigger.
 */
class PlusSimplexPhaseEventProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [{
            name: 'active',
            defaultValue: 0,
            minValue: 0,
            maxValue: 1,
            automationRate: 'k-rate'
        }];
    }

    constructor(options) {
        super();
        const processorOptions = options.processorOptions ?? {};
        this.processorSampleRate = processorOptions.sampleRate ?? sampleRate;
        this.phasor = new PlusSimplexPhasor(
            processorOptions.initialRate ?? 2,
            processorOptions.eventList ?? [
                { id: 'ping', phase: 0, event: 'ping' }
            ],
            processorOptions.initialPhase ?? 0,
            {
                weight: processorOptions.initialWeight ?? 0,
                seed: processorOptions.seed ?? 1,
                fixedY: processorOptions.fixedY,
                octaveWeights: processorOptions.octaveWeights,
                initialNoiseCoordinate: processorOptions.initialNoiseCoordinate,
                noiseCoordinateScale: processorOptions.noiseCoordinateScale,
                planningSteps: processorOptions.planningSteps
            }
        );
        this.pendingCommands = [];
        this.eventSequence = 0;
        this.port.onmessage = ({ data }) => {
            if (data?.type === 'event' || data?.type === 'parameter') {
                this.pendingCommands.push(data);
            }
        };
    }

    process(inputs, outputs, parameters) {
        const channel = outputs[0]?.[0];
        channel?.fill(0);
        if (parameters.active[0] < 0.5) return true;

        this._applyPendingCommands();
        const frameCount = channel?.length ?? 128;
        const occurrences = this.phasor.processBlock(
            frameCount,
            this.processorSampleRate
        );

        for (const occurrence of occurrences) {
            this.port.postMessage({
                type: 'phase-event',
                eventId: occurrence.id,
                event: occurrence.event,
                phase: occurrence.phase,
                sampleOffset: occurrence.sampleOffset,
                audioFrame: currentFrame + occurrence.sampleOffset,
                sequence: this.eventSequence++
            });
        }
        return true;
    }

    _applyPendingCommands() {
        for (const command of this.pendingCommands) {
            if (command.type === 'parameter') {
                if (command.name === 'freq') this.phasor.setRate(command.value);
                if (command.name === 'weight') this.phasor.setWeight(command.value);
                if (command.name === 'phase') this.phasor.setPhase(command.value);
                continue;
            }

            const durationFrames = Math.max(
                0,
                Math.round(command.durationSeconds * this.processorSampleRate)
            );

            if (command.name === 'transition-natural') {
                this.phasor.beginNaturalTransition({
                    durationFrames,
                    targetRate: command.targetRate,
                    targetWeight: command.targetWeight,
                    sharpness: command.transitionSharpness ?? 0
                });
                continue;
            }

            if (command.name !== 'transition') continue;
            this.phasor.beginTransition({
                durationFrames,
                targetRate: command.targetRate,
                targetWeight: command.targetWeight,
                targetPhase: command.targetPhase,
                sharpness: command.transitionSharpness ?? 0
            });
        }
        this.pendingCommands.length = 0;
    }
}

registerProcessor(
    'plus-simplex-phase-event-processor',
    PlusSimplexPhaseEventProcessor
);
