import { BaseSound } from '../BaseSound.js';

export class DroneModel extends BaseSound {
    constructor(context, name) {
        super(context, name);
        this.addParameter('frequency', 440, 20, 2000, 0, 0);
        //this.addStringParameter('waveform', 'sine');
        this.addIntegerParameter('waveshape', 0, 0, 3);
        this.createNodes();
        this.inAttackSegment = false;
        this.inDecaySegment = false;
    }

    waves = ['sine', 'triangle', 'sawtooth', 'square'];

    createNodes() {
        this.oscillator = null;
        this.gainNode = this.context.createGain();
        this.outputNode = this.gainNode;
    }

    logging = false

    startSound() {
        if (this.oscillator) {
            this.oscillator.disconnect();
        }

        this.oscillator = this.context.createOscillator();
        this.oscillator.connect(this.gainNode);

        const freqParam = this.getParameter('frequency');
        this.oscillator.frequency.setValueAtTime(freqParam.get(), this.context.currentTime);

        const waveshapeParam = this.getParameter('waveshape');
        this.oscillator.type = this.waves[waveshapeParam.get()];

        const gainParam = this.getParameter('gain');
        const gain = this.gainNode.gain;
        const now = this.context.currentTime;

        // Cancel any previous ramp (e.g., leftover decay)
        if (typeof gain.cancelAndHoldAtTime === 'function') {
            gain.cancelAndHoldAtTime(now);
        } else {
            gain.cancelScheduledValues(now);
            gain.setValueAtTime(gain.value, now);
        }

        // Start new attack
        gain.setValueAtTime(0, now);
        gain.linearRampToValueAtTime(gainParam.get(), now + gainParam.attackTime);
        console.log(`Attack - ramp to ${gainParam.get()}`)

        this.inAttackSegment = true;
        this.inDecaySegment = false;

        // Schedule end of attack
        setTimeout(() => {
            this.inAttackSegment = false;
            console.log(`END of attach -  gainParm=${this.getParameter('gain').get()}, and gain.value=${gain.value}`)
        }, gainParam.attackTime * 1000);

        this.oscillator.start();
        this.startTime = now;
    }

    stopSound(onReleased) {
        const now = this.context.currentTime;
        const gain = this.gainNode.gain;
        const decayTime = this.getParameter('gain').decayTime;

        if (this.inDecaySegment) {
            console.log(`Stop called during decay — ignored.`);
            return;
        }


    // Always cancel automation before ramping down
        if (typeof gain.cancelAndHoldAtTime === 'function') {
            gain.cancelAndHoldAtTime(now);
        } else {
            gain.cancelScheduledValues(now);
        }

        gain.setValueAtTime(gain.value, now);  // THIS is the key
        gain.linearRampToValueAtTime(0, now + decayTime);
        console.log(`Decay - ramp from gainParm=${this.getParameter('gain').get()}, and gain.value=${gain.value}`)


        this.inDecaySegment = true;

        this.timeoutID = setTimeout(() => {
            this.inDecaySegment = false;
            if (this.oscillator) {
                this.oscillator.stop();
                this.oscillator.disconnect();
                this.oscillator = null;
            }
            this.timeoutID = 0;
            if (typeof onReleased === 'function') {
                onReleased();
            }
        }, decayTime * 1000);
    }

    updateParameter(name) {
        const param = this.getParameter(name);
        const now = this.context.currentTime;

        if (name === 'frequency' && this.oscillator) {
            this.oscillator.frequency.setValueAtTime(param.get(), now);
        } else if (name === 'gain') {
            const gain = this.gainNode.gain;
            const newGain = param.get();
            const timeSinceStart = now - (this.startTime ?? 0);
            const attackTime = param.attackTime;

            console.log("Update GAIN")

            if (this.inDecaySegment) {
                // Ignore changes during decay
                console.log("Ignoring gain update during decay.");
            } else if (this.inAttackSegment) {
                const timeLeft = Math.max(0.01, attackTime - timeSinceStart);

                if (typeof gain.cancelAndHoldAtTime === 'function') {
                    gain.cancelAndHoldAtTime(now);
                } else {
                    gain.cancelScheduledValues(now);
                    gain.setValueAtTime(gain.value, now);
                }
                gain.setValueAtTime(gain.value, now);//----
                gain.linearRampToValueAtTime(newGain, now + timeLeft);
                console.log(`update,  - ramp to newGain = ${newGain}`)
            } else {
                gain.setTargetAtTime(newGain, now, 0.05);  // Smooth change post-attack
            }
        } else if (name === 'waveshape' && this.oscillator) {
            this.oscillator.type = this.waves[param.get()];
        } else if (name === 'waveform' && this.oscillator) {
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