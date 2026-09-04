import { TransitionPhasor } from '../TransitionPhasor.js';

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

        this.processorSampleRate = options.processorOptions?.sampleRate ?? sampleRate;
        this.phasor = new TransitionPhasor(
            10,
            [{ id: 'click', phase: 0, event: 'click' }]
        );

        this.pendingEvents = [];
        this.clickLengthSamples = Math.max(1, Math.round(0.001 * this.processorSampleRate));
        this.clickAmplitude = 0.5;

        // Long enough for click tails to cross render-quantum boundaries.
        this.circularBuffer = new Float32Array(
            Math.max(1024, Math.ceil(this.processorSampleRate))
        );
        this.circularBufferPointer = 0;

        this.port.onmessage = ({ data }) => {
            if (data?.type === 'event') this.pendingEvents.push(data);
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
            if (event.event === 'click') this._scheduleClick(event.sampleOffset);
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

    _scheduleClick(sampleOffset) {
        const integerOffset = Math.max(0, Math.round(sampleOffset));
        for (let sample = 0; sample < this.clickLengthSamples; sample++) {
            const index = (
                this.circularBufferPointer + integerOffset + sample
            ) % this.circularBuffer.length;
            const noise = (Math.random() * 2 - 1) * this.clickAmplitude;
            this.circularBuffer[index] += noise;
        }
    }
}

registerProcessor(
    'transitionClickTrainProcessor',
    TransitionClickTrainProcessor
);
