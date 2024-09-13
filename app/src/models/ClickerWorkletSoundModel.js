import { BaseSound } from '../BaseSound.js';

export class ClickerWorkletSoundModel extends BaseSound {
    static WORKLET_PATH = '/src/worklets/clickTrainProcessor.js';

    constructor(context, name) {
        super(context, name);
        this.addParameter('rate', 10, 1, 20);
        this.workletNode = null;
        this.gainNode = null;
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

            // Explicitly set the worklet to inactive state
            this.workletNode.parameters.get('active').setValueAtTime(0, this.context.currentTime);
            
            // Set initial gain to 0
            this.gainNode.gain.setValueAtTime(0, this.context.currentTime);
        }
    }

    startSound() {
        if (this.workletNode) {
            console.log(`${this.name}: Starting sound`);
            // Activate the worklet
            this.workletNode.parameters.get('active').setValueAtTime(1, this.context.currentTime);
            console.log(`this.workletNode.parameters.get('active') is ${this.workletNode.parameters.get('active')}`)
            // Ramp up the gain
            const gainParam = this.getParameter('gain');
            this.gainNode.gain.cancelScheduledValues(this.context.currentTime);
            this.gainNode.gain.setValueAtTime(0, this.context.currentTime);
            this.gainNode.gain.linearRampToValueAtTime(gainParam.get(), this.context.currentTime + gainParam.attackTime);
            this.updateParameter('rate');
        }
    }

    stopSound() {
        if (this.workletNode) {
            console.log(`${this.name}: Stopping sound`);
            // Deactivate the worklet
            this.workletNode.parameters.get('active').setValueAtTime(0, this.context.currentTime);
            console.log(`stopSound - setting worklet 'acive' to 0!`)
            // Ramp down the gain
            const gainParam = this.getParameter('gain');
            this.gainNode.gain.cancelScheduledValues(this.context.currentTime);
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.context.currentTime);
            this.gainNode.gain.linearRampToValueAtTime(0, this.context.currentTime + gainParam.decayTime);
        }
    }

    updateParameter(name) {
        const param = this.getParameter(name);
        if (name === 'rate' && this.workletNode) {
            this.workletNode.parameters.get('clickRate').setValueAtTime(param.get(), this.context.currentTime);
        } else if (name === 'gain' && this.gainNode && this.isPlaying) {
            this.gainNode.gain.setTargetAtTime(param.get(), this.context.currentTime, param.attackTime);
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