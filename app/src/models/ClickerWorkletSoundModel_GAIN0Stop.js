// src/models/WorkletSoundModel.js
import { BaseSound } from '../BaseSound.js';

export class ClickerWorkletSoundModel extends BaseSound {
    static WORKLET_PATH = '/src/worklets/clickTrainProcessor.js';

    constructor(context, name) {
        super(context, name);
        this.addParameter('rate', 10, 0, 20);
        
        try {
          const sampleRate = this.context.sampleRate;  // Get the sample rate from the AudioContext
          console.log('Sample rate:', sampleRate);

          // Create the AudioWorkletNode, passing the sample rate to the processor
          this.workletNode = new AudioWorkletNode(this.context, 'clickTrainProcessor', {
            processorOptions: { sampleRate }
          });

          console.log('AudioWorkletNode created successfully with sample rate:', sampleRate);

          this.gainNode = this.context.createGain();
          this.gainNode.gain.setValueAtTime(0, this.context.currentTime);
          
          this.workletNode.connect(this.gainNode);
          this.outputNode = this.gainNode;
          console.log('AudioWorkletNode connected to gain node and audio context destination.');

        } catch (err) {
          console.error('Error creating AudioWorkletNode:', err);
        }


    }

    updateParameter(name) {
        const param = this.getParameter(name);

          // if (param === 'rate') {
          //   const rate = this.parameters.rate.getValue();
          //   // Ensure the parameter exists before setting its value
          //   if (this.workletNode.parameters.has('clickRate')) {
          //     this.workletNode.parameters.get('clickRate').value = rate;
          //     console.log('Setting clickRate parameter to:', rate);
          //   } else {
          //     console.error('clickRate parameter is undefined on the worklet node.');
          //   }


        if (name === 'rate') {
            this.workletNode.parameters.get('clickRate').setValueAtTime(param.get(), this.context.currentTime);
        } else if (name === 'gain') {
            this.gainNode.gain.setTargetAtTime(param.get(), this.context.currentTime, param.attackTime);
        }
    }

    startSound() {
        this.workletNode.parameters.get('active').setValueAtTime(1, this.context.currentTime);
        this.updateParameter('rate');
        this.updateParameter('gain');
    }

    stopSound() {
        this.workletNode.parameters.get('active').setValueAtTime(0, this.context.currentTime);
        const param = this.getParameter('gain');
        this.gainNode.gain.setTargetAtTime(0, this.context.currentTime, param.decayTime);
    }

    destroy() {
        super.destroy();
        this.workletNode.disconnect();
        this.gainNode.disconnect();
        console.log(`Disconnected sound model: ${this.name}`);
    }

}
