import { Phasor, Burst } from '../utils.js';  // Import Phasor and Burst from utils.js

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
        console.log(`WORKLET CONSTRUCTOR, this.sampleRate=${this.sampleRate}`)

        this.bufferDuration = 128 / this.sampleRate;  // Assuming buffer length is always 128 samples

        // Create the Phasor with a default rate of 1 click per second
        this.phasor = new Phasor(1.0, [{ phase: 0.0, event: 'click' }]);

        this.clickLength = 0.5;  // Click length of 10 milliseconds (0.01 seconds)
        this.clickAmplitude = 0.5;  // Default amplitude for the burst


        this.phase = 0;
    }

    process(inputs, outputs, parameters) {
        //console.log(`click train process`)
        const output = outputs[0];
        const channel = output[0];
        const clickRate = parameters.clickRate.length > 0 ? parameters.clickRate[0] : 1.0;
        const active = parameters.active[0];

        this.phasor.setRate(clickRate);  // Update the phasor rate dynamically based on clickRate

        // Increment the phasor based on buffer duration and get triggered events
        let triggeredEvents = this.phasor.increment(this.bufferDuration);
        // if (triggeredEvents != [])
        //   console.log(`trigger events : ${triggeredEvents}`)

        const clickSamples = Math.floor(this.clickLength * this.sampleRate);  // Number of samples for the click
        const burst = new Burst(clickSamples, this.clickAmplitude);  // Create a new burst

        // Clear the buffer first (silence)
        for (let i = 0; i < channel.length; i++) {
          channel[i] = 0.0;
        }

        //Handle events triggered by the phasor
        for (let event of triggeredEvents) {
          if (event.event === 'click') {
          //   console.log(`CLICK`);
            console.log(`CLICK, channel.length=${channel.length}, and  clickSamples = ${clickSamples}`);


            // Compute the start position of the click in the buffer
            let clickPosition = Math.floor((this.phasor.phase * channel.length));  // Relative to the buffer length

            // Get the noise burst array
            let noiseArray = burst.generate();

            // Add the burst to the buffer over the specified click length
            for (let j = 0; j < noiseArray.length; j++) {
              if (clickPosition + j < channel.length) {
                channel[clickPosition + j] += noiseArray[j];  // Add the random noise to the buffer
              }
            }
          }
      }

        return true;  // Keep the processor alive
  }

}

registerProcessor('clickTrainProcessor', WorkletProcessor);