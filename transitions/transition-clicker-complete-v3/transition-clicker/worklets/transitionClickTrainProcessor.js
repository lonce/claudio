import { TransitionPhasor } from '../utilities/TransitionPhasor.js';

class TransitionClickTrainProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            {
                name: 'active',
                defaultValue: 0,
                minValue: 0,
                maxValue: 1,
                automationRate: 'k-rate'
            }
        ];
    }

    constructor(options) {
        super();

        const processorOptions = options.processorOptions ?? {};
        this.processorSampleRate = processorOptions.sampleRate ?? sampleRate;
        const eventList = Array.isArray(processorOptions.eventList)
            ? processorOptions.eventList
            : [{ id: 'click', phase: 0, event: 'click' }];
        this.phasor = new TransitionPhasor(
            processorOptions.initialRate ?? 10,
            eventList,
            processorOptions.initialPhase ?? 0
        );

        this.pendingEvents = [];
        // Long enough for short event sounds to cross render-quantum boundaries.
        this.circularBuffer = new Float32Array(
            Math.max(4096, Math.ceil(this.processorSampleRate * 2))
        );
        this.circularBufferPointer = 0;

        this.port.onmessage = ({ data }) => {
            if (data?.type === 'event' || data?.type === 'parameter') {
                this.pendingEvents.push(data);
            }
        };
    }

    process(inputs, outputs, parameters) {
        const channel = outputs[0]?.[0];
        if (!channel) return true;

        const isActive = parameters.active[0] >= 0.5;
        if (!isActive) {
            channel.fill(0);
            return true;
        }

        // All commands received since the previous quantum begin together at
        // this deterministic render boundary. Last transition wins if several
        // target the same phasor in one quantum.
        this._applyPendingEvents();

        const triggered = this.phasor.processBlock(
            channel.length,
            this.processorSampleRate
        );

        for (const event of triggered) {
            if (event.event === 'click') this._scheduleClick(event);
        }

        for (let sample = 0; sample < channel.length; sample++) {
            channel[sample] = this.circularBuffer[this.circularBufferPointer];
            this.circularBuffer[this.circularBufferPointer] = 0;
            this.circularBufferPointer =
                (this.circularBufferPointer + 1) % this.circularBuffer.length;
        }

        return true;
    }

    _applyPendingEvents() {
        for (const command of this.pendingEvents) {
            if (command.type === 'parameter') {
                if (command.name === 'freq') {
                    this.phasor.setRate(command.value);
                } else if (command.name === 'phase') {
                    this.phasor.setPhase(command.value);
                }
                continue;
            }

            if (command.name !== 'transition') continue;

            const durationFrames = Math.max(
                0,
                Math.round(command.durationSeconds * this.processorSampleRate)
            );
            this.phasor.beginTransition({
                durationFrames,
                targetRate: command.targetRate,
                targetPhase: command.targetPhase
            });
        }
        this.pendingEvents.length = 0;
    }

    _scheduleClick(event) {
        const integerOffset = Math.max(0, Math.round(event.sampleOffset));
        const durationSeconds = event.durationSeconds ?? 0.025;
        const length = Math.max(1, Math.round(durationSeconds * this.processorSampleRate));
        const frequency = event.frequency ?? 1200;
        const amplitude = event.amplitude ?? 0.28;
        const noiseMix = Math.min(1, Math.max(0, event.noiseMix ?? 0.15));

        for (let sample = 0; sample < length; sample++) {
            const index = (
                this.circularBufferPointer + integerOffset + sample
            ) % this.circularBuffer.length;
            const elapsed = sample / this.processorSampleRate;
            const envelope = Math.exp(-7 * sample / length);
            const tone = Math.sin(2 * Math.PI * frequency * elapsed);
            const noise = Math.random() * 2 - 1;
            this.circularBuffer[index] += amplitude * envelope * (
                tone * (1 - noiseMix) + noise * noiseMix
            );
        }
    }
}

registerProcessor(
    'transitionClickTrainProcessor',
    TransitionClickTrainProcessor
);
