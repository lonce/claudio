import { Phasor, Burst } from '../utils.js';

class WorkletProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            {name: 'clickRate', defaultValue: 10, minValue: 0, maxValue: 20},
            {name: 'active', defaultValue: 0, minValue: 0, maxValue: 1}
        ];
    }

    constructor(options) {
        super();
        this.sampleRate = options.processorOptions.sampleRate;
        console.log(`WORKLET CONSTRUCTOR, this.sampleRate=${this.sampleRate}`);

        this.bufferDuration = 128 / this.sampleRate;  // Assuming buffer length is always 128 samples

        // Create the Phasor with a default rate of 1 click per second
        this.phasor = new Phasor(1.0, [{ phase: 0.0, event: 'click' }]);
        console.log(`construcing a new phasor`)

        this.clickLength = 0.001;  // Click length of 10 milliseconds (0.01 seconds)
        this.clickAmplitude = 0.5;  // Default amplitude for the burst

        // Circular buffer setup
        this.circularBufferSize = options.processorOptions.circularBufferSize || 44100; // Default size, or use provided size
        this.circularBuffer = new Float32Array(this.circularBufferSize);
        this.circularBufferPointer = 0;

        this.phase = 0;

        this.active = true;
        this.port.onmessage = (event) => {
            if (event.data.action === 'stop') {
                this.active = false;
            }
        };
    }

    process(inputs, outputs, parameters) {
        console.log(`in process(), parameters.active[0] is ${parameters.active[0]}, and this.active is ${this.active}`)
        if (parameters.active[0] < 0.5) {
        //if (!this.active) {
            console.log('false')
            return false; // This will remove the worklet from the rendering graph
        }

        const output = outputs[0];
        const channel = output[0];
        const clickRate = parameters.clickRate.length > 0 ? parameters.clickRate[0] : 1.0;
        const active = parameters.active[0];

        this.phasor.setRate(clickRate);

        let triggeredEvents = this.phasor.increment(this.bufferDuration);

        const clickSamples = Math.floor(this.clickLength * this.sampleRate);
        const burst = new Burst(clickSamples, this.clickAmplitude);

        // Handle events triggered by the phasor
        for (let event of triggeredEvents) {
            if (event.event === 'click') {
                console.log(`CLICK, channel.length=${channel.length}, and  clickSamples = ${clickSamples}`);

                // Generate new noise burst
                let noiseArray = burst.generate();

                // Add the burst to the circular buffer
                for (let i = 0; i < noiseArray.length; i++) {
                    this.circularBuffer[(this.circularBufferPointer + i) % this.circularBufferSize] += noiseArray[i];
                }
            }
        }

        // Copy from circular buffer to output channel
        for (let i = 0; i < channel.length; i++) {
            channel[i] = this.circularBuffer[this.circularBufferPointer];
            this.circularBuffer[this.circularBufferPointer] = 0; // Zero out after reading
            this.circularBufferPointer = (this.circularBufferPointer + 1) % this.circularBufferSize;
        }

        return true;  // Keep the processor alive
    }
}

registerProcessor('clickTrainProcessor', WorkletProcessor);
