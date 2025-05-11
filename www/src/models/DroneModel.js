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

        // Create new voice
        const voiceGain = this.context.createGain();
        const oscillator = this.context.createOscillator();
        oscillator.connect(voiceGain);
        voiceGain.connect(this.outputNode);

        const freqParam = this.getParameter('frequency');
        oscillator.frequency.setValueAtTime(freqParam.get(), now);

        const waveshapeParam = this.getParameter('waveshape');
        oscillator.type = this.waves[waveshapeParam.get()];

        const gainParam = this.getParameter('gain');
        const targetGain = gainParam.get();
        const attackTime = gainParam.attackTime;

        // Ramp up from 0 to targetGain
        voiceGain.gain.setValueAtTime(0, now);
        voiceGain.gain.linearRampToValueAtTime(targetGain, now + attackTime);

        // Save ramp metadata for use by stopSound()
        voiceGain.gain._scheduledTime = now;
        voiceGain.gain._scheduledTarget = {
            time: now + attackTime,
            value: targetGain
        };

        oscillator.start();

        // Save this voice for stopping later
        this.currentVoice = {
            oscillator,
            gainNode: voiceGain
        };

        console.log(`Started oscillator with gain ${targetGain}`);
    }


    stopSound() {
        if (!this.currentVoice) return;

        const now = this.context.currentTime;
        const gainParam = this.getParameter('gain');
        const decayTime = gainParam.decayTime;

        const { gainNode, oscillator } = this.currentVoice;

        // Estimate current gain if ramp was in progress
        const scheduledTime = gainNode.gain._scheduledTime || now;
        const scheduledTarget = gainNode.gain._scheduledTarget || { time: now, value: gainNode.gain.value };

        let currentGain = gainNode.gain.value;
        const elapsed = now - scheduledTime;
        const rampDuration = scheduledTarget.time - scheduledTime;

        if (rampDuration > 0 && elapsed < rampDuration) {
            currentGain = (elapsed / rampDuration) * scheduledTarget.value;
        }

        // Smooth decay from estimated current value
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(currentGain, now);
        gainNode.gain.linearRampToValueAtTime(0, now + decayTime);

        setTimeout(() => {
            oscillator.stop();
            oscillator.disconnect();
            gainNode.disconnect();
        }, decayTime * 1000 + 100);

        this.currentVoice = null;
        console.log(`Stopped oscillator with decay time ${decayTime}`);
    }

    updateParameter(name) {
        const param = this.getParameter(name);

        if (!this.currentVoice) return;

        const now = this.context.currentTime;
        const { oscillator, gainNode } = this.currentVoice;

        if (name === 'frequency' && oscillator) {
            oscillator.frequency.setValueAtTime(param.get(), now);
        } 
        else if (name === 'gain' && gainNode) {
            const target = param.get();
            const timeConstant = param.attackTime || 0.01;
            gainNode.gain.setTargetAtTime(target, now, timeConstant);
        } 
        else if (name === 'waveshape' && oscillator) {
            oscillator.type = this.waves[param.get()];
        } 
        else if (name === 'waveform' && oscillator) {
            oscillator.type = param.get();
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