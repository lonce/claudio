import { TransitionPhasor } from '../utilities/TransitionPhasor.js';

/**
 * Timing-only AudioWorklet processor.
 *
 * It advances the phasor on the audio rendering clock and reports crossings
 * to the main thread. It intentionally generates silence: a separate
 * SoundModel decides what each notification should sound like.
 */
class TransitionNotifierProcessor extends AudioWorkletProcessor {
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
        this.phasor = new TransitionPhasor(
            processorOptions.initialRate ?? 2,
            processorOptions.eventList ?? [
                { id: 'ping', phase: 0, event: 'ping' }
            ],
            processorOptions.initialPhase ?? 0
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
        // A silent connected output keeps this timing processor in the active
        // Web Audio graph across browsers.
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
                // This records when the crossing occurred on the audio clock,
                // even though the main thread necessarily receives it later.
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
                if (command.name === 'phase') this.phasor.setPhase(command.value);
                continue;
            }

            if (command.name === 'transition-rate') {
                const durationFrames = Math.max(
                    0,
                    Math.round(command.durationSeconds * this.processorSampleRate)
                );
                this.phasor.beginRateTransition({
                    durationFrames,
                    targetRate: command.targetRate,
                    sampleRate: this.processorSampleRate,
                    sharpness: command.transitionSharpness ?? 0
                });
                continue;
            }

            if (command.name !== 'transition') continue;
            this.phasor.beginTransition({
                durationFrames: Math.max(
                    0,
                    Math.round(command.durationSeconds * this.processorSampleRate)
                ),
                targetRate: command.targetRate,
                targetPhase: command.targetPhase,
                sharpness: command.transitionSharpness ?? 0
            });
        }
        this.pendingCommands.length = 0;
    }
}

registerProcessor('transitionNotifierProcessor', TransitionNotifierProcessor);
