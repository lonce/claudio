import { BaseSound } from '../BaseSound.js';

export class DroneModel extends BaseSound {
    constructor(context, name) {
        super(context, name);
        this.addParameter('frequency', 440, 20, 2000, 0, 0);
        //this.addStringParameter('waveform', 'sine');
        this.addIntegerParameter('waveshape', 0, 0, 3);
        this.createNodes();
    }

    waves = ['sine', 'triangle', 'sawtooth', 'square'];

    createNodes() {
        this.oscillator = null;
        this.gainNode = this.context.createGain();
        this.outputNode = this.gainNode;
    }

 startSound() {
    const now = this.context.currentTime;

    // Create per-oscillator gain and oscillator
    const voiceGain = this.context.createGain();
    const oscillator = this.context.createOscillator();
    oscillator.connect(voiceGain);
    voiceGain.connect(this.outputNode); // Connect to shared output

    const freqParam = this.getParameter('frequency');
    oscillator.frequency.setValueAtTime(freqParam.get(), now);

    const waveshapeParam = this.getParameter('waveshape');
    oscillator.type = this.waves[waveshapeParam.get()];

    const gainParam = this.getParameter('gain');
    const targetGain = gainParam.get();
    const attackTime = gainParam.attackTime;

    voiceGain.gain.setValueAtTime(0, now);
    voiceGain.gain.linearRampToValueAtTime(targetGain, now + attackTime);

    oscillator.start();

    // Save this as the current playing voice
    this.currentVoice = {
        oscillator,
        gainNode: voiceGain
    };

    console.log(`Starting new voice with gain ${targetGain}`);
}


stopSound() {
    if (!this.currentVoice) return;

    const now = this.context.currentTime;
    const gainParam = this.getParameter('gain');
    const decayTime = gainParam.decayTime;

    const { gainNode, oscillator } = this.currentVoice;

    // Begin decay ramp
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + decayTime);

    // Schedule cleanup after decay
    setTimeout(() => {
        oscillator.stop();
        oscillator.disconnect();
        gainNode.disconnect();
    }, decayTime * 1000 + 100);

    this.currentVoice = null;
    console.log(`Stopping voice with decay time ${decayTime}`);
}

    updateParameter(name) {
        const param = this.getParameter(name);
        if (name === 'frequency' && this.oscillator) {
            this.oscillator.frequency.setValueAtTime(param.get(), this.context.currentTime);
        } 
        else if (name === 'gain') {
            this.gainNode.gain.setTargetAtTime(param.get(), this.context.currentTime, param.attackTime);
        } 
        else if (name === 'waveshape' && this.oscillator) {
            this.oscillator.type = this.waves[param.get()];
        }
        else if (name === 'waveform' && this.oscillator) {
            this.oscillator.type = param.get();
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