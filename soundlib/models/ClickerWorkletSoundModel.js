import { BaseSound } from '../BaseSound.js';

export class ClickerWorkletSoundModel extends BaseSound {
    static WORKLET_PATH = new URL('../worklets/clickTrainProcessor.js', import.meta.url).href;

    constructor(context, name) {
        super(context, name);
        this.addParameter('rate', 10, 1, 20);
        this.createNodes();
    }

    createNodes() {
        if (!this.workletNode) {
            this.workletNode = new AudioWorkletNode(this.context, 'clickTrainProcessor', {
                processorOptions: { sampleRate: this.context.sampleRate }
            });
            this.gainNode = this.context.createGain();
            this.workletNode.connect(this.gainNode);
            this.outputNode = this.gainNode;

            this.workletNode.parameters.get('active').setValueAtTime(0, this.context.currentTime);
            this.gainNode.gain.setValueAtTime(0, this.context.currentTime);
        }
    }

    startSound() {
        if (this.workletNode) {
            console.log(`${this.name}: Starting sound`);
            this.workletNode.parameters.get('active').setValueAtTime(1, this.context.currentTime);
            this.scheduleAttack(this.gainNode);
            this.startTime = this.context.currentTime;
            this.updateParameter('rate');
        }
    }

    stopSound(onReleased) {
        this.scheduleDecay(this.gainNode, () => {
            if (this.workletNode) {
                console.log(`${this.name}: Stopping sound`);
                this.workletNode.parameters.get('active').setValueAtTime(0, this.context.currentTime);
            }
            if (typeof onReleased === 'function') {
                onReleased();
            }
        });
    }

    updateParameter(name) {
        const param = this.getParameter(name);
        const now = this.context.currentTime;

        if (name === 'rate' && this.workletNode) {
            this.workletNode.parameters.get('clickRate').setValueAtTime(param.get(), now);
        } else if (name === 'gain') {
            if (this.inDecaySegment) {
                console.log("Ignoring gain update during decay.");
                return;
            }
            if (this.inAttackSegment) {
                this.updateGainDuringAttack(this.gainNode, param.get(), this.startTime, param.attackTime);
            } else {
                this.gainNode.gain.setTargetAtTime(param.get(), now, 0.05);
            }
        }
    }

    connect(destination) {
        super.connect(destination);
        if (this.gainNode && this.destination) {
            this.gainNode.connect(this.destination);
        }
    }

    disconnect() {
        if (this.gainNode && this.destination) {
            this.gainNode.disconnect(this.destination);
        }
        super.disconnect();
    }

    destroy() {
        super.destroy();
        if (this.workletNode) {
            this.workletNode.disconnect();
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
        }
    }
}
