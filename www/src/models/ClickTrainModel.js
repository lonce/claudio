import { BaseSound } from '../BaseSound.js';

export class ClickTrainModel extends BaseSound {
    constructor(context, name) {
        super(context, name);
        this.addParameter('rate', 10, 1, 20);
        this.createNodes();
    }

    createNodes() {
        this.gainNode = this.context.createGain();
        this.outputNode = this.gainNode;
        this.clickInterval = null;
    }

    startSound() {
        this.clearClickInterval();
        this.scheduleAttack(this.gainNode);
        this.startTime = this.context.currentTime;
        this.restartClickInterval();
    }

    stopSound(onReleased) {
        this.clearClickInterval();
        this.scheduleDecay(this.gainNode, () => {
            if (typeof onReleased === 'function') {
                onReleased();
            }
        }
    }

    restartClickInterval() {
        const rate = this.getParameter('rate').get();
        this.clickInterval = setInterval(() => this.playClick(), 1000 / rate);
    }

    clearClickInterval() {
        if (this.clickInterval) {
            clearInterval(this.clickInterval);
            this.clickInterval = null;
        }
    }

    playClick() {
        const clickOsc = this.context.createOscillator();
        const clickGain = this.context.createGain();
        
        clickOsc.connect(clickGain);
        clickGain.connect(this.gainNode);
        
        clickOsc.frequency.value = 1000;
        clickGain.gain.setValueAtTime(0.5, this.context.currentTime);
        clickGain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);
        
        clickOsc.start();
        clickOsc.stop(this.context.currentTime + 0.1);

        setTimeout(() => {
            clickOsc.disconnect();
            clickGain.disconnect();
        }, 150);
    }

    updateParameter(name) {
        if (name === 'rate' && this.isPlaying) {
            this.restartClickInterval();
        } else if (name === 'gain') {
            const param = this.getParameter(name);
            if (this.inDecaySegment) {
                console.log('Ignoring gain update during decay.');
                return;
            }
            if (this.inAttackSegment) {
                this.updateGainDuringAttack(this.gainNode, param.get(), this.startTime, param.attackTime);
            } else {
                this.gainNode.gain.setTargetAtTime(param.get(), this.context.currentTime, 0.05);
            }
        }
    }

    destroy() {
        super.destroy();
        this.clearClickInterval();
        this.gainNode.disconnect();
    }
}
