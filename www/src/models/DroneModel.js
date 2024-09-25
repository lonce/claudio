import { BaseSound } from '../BaseSound.js';

export class DroneModel extends BaseSound {
    constructor(context, name) {
        super(context, name);
        this.addParameter('frequency', 440, 20, 2000, 0, 0);
        this.addStringParameter('waveform', 'sine');
        this.createNodes();
    }

    createNodes() {
        this.oscillator = null;
        this.gainNode = this.context.createGain();
        this.outputNode = this.gainNode;
    }

    startSound() {
        if (this.oscillator) {
            this.oscillator.disconnect();
        }
        this.oscillator = this.context.createOscillator();
        this.oscillator.connect(this.gainNode);
        
        const freqParam = this.getParameter('frequency');
        this.oscillator.frequency.setValueAtTime(freqParam.get(), this.context.currentTime);
        
        const gainParam = this.getParameter('gain');
        this.gainNode.gain.cancelScheduledValues(this.context.currentTime);
        this.gainNode.gain.setValueAtTime(0, this.context.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(gainParam.get(), this.context.currentTime + gainParam.attackTime);

        console.log(`Starting sound with gain of ${gainParam.get()}`)
        let foo = this.oscillator.start();
        console.log(`foo  ${foo}`)
    }

    stopSound() {
        const gainParam = this.getParameter('gain');
        this.gainNode.gain.cancelScheduledValues(this.context.currentTime);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.context.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(0, this.context.currentTime + gainParam.decayTime);
        
        this.timeoutID = setTimeout(() => {
            console.log(`stopSound timeout called, disconnecting oscilator`)
            if (this.oscillator && !this.isPlaying) {
                this.oscillator.stop();
                this.oscillator.disconnect();
                this.oscillator = null;
            }
            this.timeoutID=0;
        }, gainParam.decayTime * 1000 + 100);
        console.log(`stopSound`)
    }

    updateParameter(name) {
        const param = this.getParameter(name);
        if (name === 'frequency' && this.oscillator) {
            this.oscillator.frequency.setValueAtTime(param.get(), this.context.currentTime);
        } else if (name === 'gain') {
            this.gainNode.gain.setTargetAtTime(param.get(), this.context.currentTime, param.attackTime);
            console.log(`updateParameter, gain = ${param.get()}`)
        } 
    }

    updateStringParameter(name) {
        const param = this.getStringParameter(name);
        if (name === 'waveform' && this.oscillator) {
            this.oscillator.type = param.get();
            console.log(`updateParameter, waveform = ${param.get()}`)   
        }
    }


    destroy() {
        super.destroy();
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
        }
        this.gainNode.disconnect();
        console.log(`gain disconnected`)
    }
}