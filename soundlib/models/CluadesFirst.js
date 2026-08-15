import { BaseSound } from '../BaseSound.js';

export class CluadesFirst extends BaseSound {
    constructor(context, name) {
        super(context, name);

        this.addParameter('frequency1', 440, 20, 2000, 0, 0);
        this.addParameter('frequency2', 554.37, 20, 2000, 0, 0);
        this.addParameter('frequency3', 659.25, 20, 2000, 0, 0);
        this.addParameter('amplitude1', 0.33, 0, 1, 0, 0);
        this.addParameter('amplitude2', 0.33, 0, 1, 0, 0);
        this.addParameter('amplitude3', 0.33, 0, 1, 0, 0);
        this.addParameter('decayTime', 0.25, 0, 1, 0, 0);

        // Fixed 10ms attack; decayTime (seconds) drives the BaseSound decay envelope.
        const gainParam = this.getParameter('gain');
        gainParam.attackTime = 0.01;
        gainParam.decayTime = this.getParameter('decayTime').get();

        this.createNodes();
    }

    createNodes() {
        this.osc1 = null;
        this.osc2 = null;
        this.osc3 = null;

        const now = this.context.currentTime;

        this.amp1Gain = this.context.createGain();
        this.amp2Gain = this.context.createGain();
        this.amp3Gain = this.context.createGain();

        this.amp1Gain.gain.setValueAtTime(this.getParameter('amplitude1').get(), now);
        this.amp2Gain.gain.setValueAtTime(this.getParameter('amplitude2').get(), now);
        this.amp3Gain.gain.setValueAtTime(this.getParameter('amplitude3').get(), now);

        this.gainNode = this.context.createGain();

        this.amp1Gain.connect(this.gainNode);
        this.amp2Gain.connect(this.gainNode);
        this.amp3Gain.connect(this.gainNode);

        this.outputNode = this.gainNode;
    }

    startSound() {
        if (this.osc1) this.osc1.disconnect();
        if (this.osc2) this.osc2.disconnect();
        if (this.osc3) this.osc3.disconnect();

        const now = this.context.currentTime;

        this.osc1 = this.context.createOscillator();
        this.osc1.type = 'sine';
        this.osc1.frequency.setValueAtTime(this.getParameter('frequency1').get(), now);
        this.osc1.connect(this.amp1Gain);

        this.osc2 = this.context.createOscillator();
        this.osc2.type = 'sine';
        this.osc2.frequency.setValueAtTime(this.getParameter('frequency2').get(), now);
        this.osc2.connect(this.amp2Gain);

        this.osc3 = this.context.createOscillator();
        this.osc3.type = 'sine';
        this.osc3.frequency.setValueAtTime(this.getParameter('frequency3').get(), now);
        this.osc3.connect(this.amp3Gain);

        this.scheduleAttack(this.gainNode);
        this.startTime = now;

        this.osc1.start();
        this.osc2.start();
        this.osc3.start();
    }

    stopSound(onReleased) {
        this.scheduleDecay(this.gainNode, () => {
            [this.osc1, this.osc2, this.osc3].forEach(osc => {
                if (osc) {
                    osc.stop();
                    osc.disconnect();
                }
            });
            this.osc1 = null;
            this.osc2 = null;
            this.osc3 = null;

            if (typeof onReleased === 'function') {
                onReleased();
            }
        });
    }

    updateParameter(name) {
        const param = this.getParameter(name);
        const now = this.context.currentTime;

        switch (name) {
            case 'frequency1':
                if (this.osc1) this.osc1.frequency.setValueAtTime(param.get(), now);
                break;
            case 'frequency2':
                if (this.osc2) this.osc2.frequency.setValueAtTime(param.get(), now);
                break;
            case 'frequency3':
                if (this.osc3) this.osc3.frequency.setValueAtTime(param.get(), now);
                break;
            case 'amplitude1':
                this.amp1Gain.gain.setTargetAtTime(param.get(), now, 0.02);
                break;
            case 'amplitude2':
                this.amp2Gain.gain.setTargetAtTime(param.get(), now, 0.02);
                break;
            case 'amplitude3':
                this.amp3Gain.gain.setTargetAtTime(param.get(), now, 0.02);
                break;
            case 'decayTime':
                this.getParameter('gain').decayTime = param.get();
                break;
            case 'gain':
                if (this.inDecaySegment) {
                    console.log('Ignoring gain update during decay.');
                    return;
                }
                if (this.inAttackSegment) {
                    this.updateGainDuringAttack(this.gainNode, param.get(), this.startTime, param.attackTime);
                } else {
                    this.gainNode.gain.setTargetAtTime(param.get(), now, 0.05);
                }
                break;
        }
    }

    destroy() {
        super.destroy();
        [this.osc1, this.osc2, this.osc3].forEach(osc => {
            if (osc) {
                osc.stop();
                osc.disconnect();
            }
        });
        this.amp1Gain.disconnect();
        this.amp2Gain.disconnect();
        this.amp3Gain.disconnect();
        this.gainNode.disconnect();
    }
}
