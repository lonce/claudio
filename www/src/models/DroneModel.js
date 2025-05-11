import { BaseSound } from '../BaseSound.js';

export class DroneModel extends BaseSound {
    constructor(context, name) {
        super(context, name);
        this.addParameter('frequency', 440, 20, 2000, 0, 0);
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

        if (this.oscillator) {
            this.oscillator.disconnect();
        }

        this.oscillator = this.context.createOscillator();
        this.oscillator.connect(this.gainNode);

        const freqParam = this.getParameter('frequency');
        this.oscillator.frequency.setValueAtTime(freqParam.get(), now);

        const waveshapeParam = this.getParameter('waveshape');
        this.oscillator.type = this.waves[waveshapeParam.get()];

        const gainParam = this.getParameter('gain');
        const attackTime = gainParam.attackTime;
        const targetGain = gainParam.get();

        // Smooth start using cancelAndHoldAtTime if supported
        const gain = this.gainNode.gain;
        if (typeof gain.cancelAndHoldAtTime === 'function') {
            gain.cancelAndHoldAtTime(now);
        } else {
            gain.cancelScheduledValues(now);
            gain.setValueAtTime(gain.value, now); // fallback for older browsers
        }

        gain.linearRampToValueAtTime(targetGain, now + attackTime);

        console.log(`Starting sound with gain ${targetGain}`);
        this.oscillator.start(now);
    }

   stopSound() {
    const now = this.context.currentTime;
    const gainParam = this.getParameter('gain');
    const decayTime = gainParam.decayTime;

    const gain = this.gainNode.gain;

    if (typeof gain.cancelAndHoldAtTime === 'function') {
        gain.cancelAndHoldAtTime(now);
        gain.setValueAtTime(gain.value, now); // ⬅ ensures ramp starts from actual held value
    } else {
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value, now); // fallback
    }

    gain.linearRampToValueAtTime(0, now + decayTime);

    this.timeoutID = setTimeout(() => {
        if (this.oscillator && !this.isPlaying) {
            this.oscillator.stop();
            this.oscillator.disconnect();
            this.oscillator = null;
        }
        this.timeoutID = 0;
    }, decayTime * 1000 + 100);

    console.log(`stopSound`);
}

    updateParameter(name) {
        const param = this.getParameter(name);
        const now = this.context.currentTime;

        if (name === 'frequency' && this.oscillator) {
            this.oscillator.frequency.setValueAtTime(param.get(), now);
        } 
        else if (name === 'gain') {
            this.gainNode.gain.setTargetAtTime(param.get(), now, param.attackTime || 0.01);
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
        console.log(`gain disconnected`);
    }
}
