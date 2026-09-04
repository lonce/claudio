import { BaseSoundWithEvents } from '../BaseSoundWithEvents.js';

export class TransitionClickerWorkletSoundModel extends BaseSoundWithEvents {
    static WORKLET_PATH = new URL(
        '../worklets/transitionClickTrainProcessor.js',
        import.meta.url
    ).href;

    constructor(context, name) {
        super(context, name);

        // These are staged targets. Updating them does not alter the running
        // phasor until the transition event is fired.
        this.addParameter('freq', 10, 0, 20);
        this.addParameter('phase', 0, 0, 1);
        this.addParameter('transition_dur', 1, 0, 60);

        this.addEvent(
            'transition',
            () => this._submitTransition(),
            'Move the phasor to the staged frequency and phase.'
        );

        this.createNodes();
    }

    createNodes() {
        if (this.workletNode) return;

        this.workletNode = new AudioWorkletNode(
            this.context,
            'transitionClickTrainProcessor',
            { processorOptions: { sampleRate: this.context.sampleRate } }
        );
        this.gainNode = this.context.createGain();
        this.workletNode.connect(this.gainNode);
        this.outputNode = this.gainNode;

        const now = this.context.currentTime;
        this.workletNode.parameters.get('active').setValueAtTime(0, now);
        this.gainNode.gain.setValueAtTime(0, now);
    }

    _submitTransition() {
        if (!this.workletNode) return;

        // Snapshot all three parameters together. Subsequent parameter edits
        // affect the next transition, not this one.
        this.workletNode.port.postMessage({
            type: 'event',
            name: 'transition',
            targetRate: this.getParameter('freq').get(),
            targetPhase: this.getParameter('phase').get(),
            durationSeconds: this.getParameter('transition_dur').get()
        });
    }

    startSound() {
        if (!this.workletNode) return;

        const now = this.context.currentTime;
        this.workletNode.parameters.get('active').setValueAtTime(1, now);
        this.scheduleAttack(this.gainNode);
        this.startTime = now;
    }

    stopSound(onReleased) {
        this.scheduleDecay(this.gainNode, () => {
            if (this.workletNode) {
                this.workletNode.parameters
                    .get('active')
                    .setValueAtTime(0, this.context.currentTime);
            }
            if (typeof onReleased === 'function') onReleased();
        });
    }

    updateParameter(name) {
        if (name !== 'gain') return; // Transition parameters are staged only.

        const parameter = this.getParameter('gain');
        const now = this.context.currentTime;
        if (this.inDecaySegment) return;

        if (this.inAttackSegment) {
            this.updateGainDuringAttack(
                this.gainNode,
                parameter.get(),
                this.startTime,
                parameter.attackTime
            );
        } else {
            this.gainNode.gain.setTargetAtTime(parameter.get(), now, 0.05);
        }
    }

    destroy() {
        super.destroy();
        this.workletNode?.disconnect();
        this.gainNode?.disconnect();
    }
}

export default TransitionClickerWorkletSoundModel;
