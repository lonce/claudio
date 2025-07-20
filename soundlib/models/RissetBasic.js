import { BaseSound } from '../BaseSound.js';

export class RissetBasic extends BaseSound {
    constructor(context, name) {
        super(context, name, 0.3); // set gain a bit lower than the usual default

        this.numOscs = 10;
        this.oscillators = [];

        this.addParameter('frequency', 60, 20, 100);
        this.addParameter('spacing', 0.05, 0, 0.25);
        this.addIntegerParameter('waveshape', 1, 0, 2);

        this.createNodes();
    }

    waves = ['triangle', 'sawtooth', 'square'];

    createNodes() {
        this.oscillators = [] ;
        this.gainNode = this.context.createGain();
        this.outputNode = this.gainNode;
    }

    startSound() {

        // Disconnect and clear existing oscillators
        this.oscillators.forEach(osc => {
            try {
                osc.disconnect();
            } catch (e) {}
        });
        this.oscillators = [] 


        const freq = this.getParameter('frequency').get();
        const spacing = this.getParameter('spacing').get();
        const wave = this.waves[this.getParameter('waveshape').get()];

        for (let i = 0; i < this.numOscs; i++) {
            const osc = this.context.createOscillator();
            osc.connect(this.gainNode);

            osc.type = wave;
            osc.frequency.setValueAtTime(freq + i * spacing, this.context.currentTime);
            
            osc.start();
            this.oscillators.push(osc);
        }

        this.scheduleAttack(this.gainNode);
        this.startTime = this.context.currentTime;

    }

    stopSound(onReleased) {
        this.scheduleDecay(this.gainNode, () => {
            this.oscillators.forEach(osc => {
                try {
                    osc.stop();
                    osc.disconnect();
                } catch (e) {}
            });
            this.oscillators = [];
            if (typeof onReleased === 'function') {
                onReleased();
            }
        });
    }

    updateParameter(name) {
        const param = this.getParameter(name);
        const now = this.context.currentTime;

        if (name === 'frequency' || name === 'spacing') {
            const baseFreq = this.getParameter('frequency').get();
            const spacing = this.getParameter('spacing').get();
            this.oscillators.forEach((osc, i) => {
                osc.frequency.setValueAtTime(baseFreq + i * spacing, now);
            });
        } else if (name === 'waveshape') {
            const wave = this.waves[param.get()];
            this.oscillators.forEach(osc => {
                osc.type = wave;
            });
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
        } 
    }

    destroy() {
        super.destroy();
        this.oscillators.forEach(osc => {
                try {
                    osc.stop();
                    osc.disconnect();
                } catch (e) {}
            });
        this.oscillators = [];
        this.gainNode.disconnect();
    }
} 
