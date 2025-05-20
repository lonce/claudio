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
        console.log("DRONE startSound")
        if (this.oscillator) {
            this.oscillator.disconnect();
        }

        this.oscillator = this.context.createOscillator();
        this.oscillator.connect(this.gainNode);

        const freqParam = this.getParameter('frequency');
        this.oscillator.frequency.setValueAtTime(freqParam.get(), this.context.currentTime);

        const waveshapeParam = this.getParameter('waveshape');
        this.oscillator.type = this.waves[waveshapeParam.get()];

        this.scheduleAttack(this.gainNode);
        this.startTime = this.context.currentTime;

        this.oscillator.start();
    }

    stopSound(onReleased) {
        this.scheduleDecay(this.gainNode, () => {
            if (this.oscillator) {
                this.oscillator.stop();
                this.oscillator.disconnect();
                this.oscillator = null;
            }
            if (typeof onReleased === 'function') {
                onReleased();
            }
        });
    }

    updateParameter(name) {
        console.log("DRONE updateParameter")
        const param = this.getParameter(name);
        const now = this.context.currentTime;

        if (name === 'frequency' && this.oscillator) {
            this.oscillator.frequency.setValueAtTime(param.get(), now);
        } else if (name === 'gain') {
            if (this.inDecaySegment) {
                console.log("Ignoring gain update during decay.");
                return;
            }
            if (this.inAttackSegment) {
                this.updateGainDuringAttack(this.gainNode, param.get(), this.startTime, param.attackTime);
            } else {
                const gain = this.gainNode.gain;
                gain.setTargetAtTime(param.get(), now, 0.05);
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
    }
} 
