import { BaseSoundWithEvents } from '../../BaseSoundWithEvents.js';
import {
    CHORD_NAMES,
    TransitionPinger
} from './_TransitionPinger.js';

/**
 * Two rhythmic phasors that can rendezvous at a shared rate/phase relation,
 * then drift back to their independently stored natural rates.
 */
export class RendezvousPingerII extends BaseSoundWithEvents {
    static WORKLET_PATH = TransitionPinger.WORKLET_PATH;
    static CHORD_NAMES = CHORD_NAMES;

    constructor(context, name, options = {}) {
        super(context, name, options.gain ?? 0.6);

        this.addParameter('natural_freq_1', options.naturalFrequency1 ?? 1.3, 0, 20);
        this.addParameter('natural_freq_2', options.naturalFrequency2 ?? 2.1, 0, 20);
        this.addParameter('rendezvous_freq', options.rendezvousFrequency ?? 2.5, 0, 20);
        this.addParameter('rendezvous_phase_1', options.rendezvousPhase1 ?? 0, 0, 1);
        this.addParameter('rendezvous_phase_2', options.rendezvousPhase2 ?? 0.5, 0, 1);
        this.addParameter('transition_dur', options.transitionDuration ?? 5, 0, 60);
        this.addParameter('transition_sharpness', options.transitionSharpness ?? 3, 0, 6);
        this.addParameter('fundamental_1', options.fundamental1 ?? 196, 20, 1000);
        this.addParameter('fundamental_2', options.fundamental2 ?? 293.66, 20, 1000);
        this.addIntegerParameter('chord_1', options.chord1 ?? 1, 1, 4);
        this.addIntegerParameter('chord_2', options.chord2 ?? 2, 1, 4);

        this.addEvent(
            'rendezvous',
            () => this._beginRendezvous(),
            'Move both phasors to the rendezvous frequency and phases.'
        );
        this.addEvent(
            'natural',
            () => this._beginNaturalReturn(),
            'Drift both phasors back to their stored natural frequencies.'
        );

        this._createChildren(options);
    }

    _createChildren(options) {
        const shared = {
            poolSize: options.poolSize ?? 8,
            pingGateSeconds: options.pingGateSeconds ?? 0.08,
            pingDecaySeconds: options.pingDecaySeconds ?? 0.25,
            frequencyJitter: options.frequencyJitter ?? 0.005
        };
        this.child1 = new TransitionPinger(this.context, `${this.name}-child-1`, {
            ...shared,
            rootFrequency: this.getParameter('fundamental_1').get(),
            processorOptions: { initialRate: 0, initialPhase: 0 }
        });
        this.child2 = new TransitionPinger(this.context, `${this.name}-child-2`, {
            ...shared,
            rootFrequency: this.getParameter('fundamental_2').get(),
            processorOptions: { initialRate: 0, initialPhase: 0 }
        });
        this.child1.setParameter('gain', options.childGain1 ?? 0.5);
        this.child2.setParameter('gain', options.childGain2 ?? 0.42);

        this.pan1 = new StereoPannerNode(this.context, { pan: options.pan1 ?? -0.55 });
        this.pan2 = new StereoPannerNode(this.context, { pan: options.pan2 ?? 0.55 });
        this.masterGain = this.context.createGain();
        this.masterGain.gain.setValueAtTime(0, this.context.currentTime);
        this.child1.connect(this.pan1);
        this.child2.connect(this.pan2);
        this.pan1.connect(this.masterGain);
        this.pan2.connect(this.masterGain);
        this.outputNode = this.masterGain;
        this.gainNode = this.masterGain;
        this._applyChord(1);
        this._applyChord(2);
    }

    _setChildNow(child, frequency, phase = null) {
        child.setParameter('transition_dur', 0);
        if (phase !== null) child.setParameter('phase', phase);
        child.setParameter('freq', frequency);
    }

    _applyChord(number) {
        const child = number === 1 ? this.child1 : this.child2;
        if (!child) return;
        child.setParameter('chord', this.getParameter(`chord_${number}`).get() - 1);
    }

    _stage(child, frequency, duration, phase = null) {
        child.setParameter('transition_dur', duration);
        child.setParameter(
            'transition_sharpness',
            this.getParameter('transition_sharpness').get()
        );
        child.setParameter('freq', frequency);
        if (phase !== null) child.setParameter('phase', phase);
    }

    _beginRendezvous() {
        const frequency = this.getParameter('rendezvous_freq').get();
        const duration = this.getParameter('transition_dur').get();
        this._stage(this.child1, frequency, duration,
            this.getParameter('rendezvous_phase_1').get());
        this._stage(this.child2, frequency, duration,
            this.getParameter('rendezvous_phase_2').get());
        this.child1.event('transition');
        this.child2.event('transition');
    }

    _beginNaturalReturn() {
        const duration = this.getParameter('transition_dur').get();
        this._stage(this.child1, this.getParameter('natural_freq_1').get(), duration);
        this._stage(this.child2, this.getParameter('natural_freq_2').get(), duration);
        this.child1.event('transition-rate');
        this.child2.event('transition-rate');
    }

    startSound() {
        this._setChildNow(this.child1, this.getParameter('natural_freq_1').get(), 0);
        this._setChildNow(this.child2, this.getParameter('natural_freq_2').get(), 0);
        this.child1.play();
        this.child2.play();
        this.startTime = this.context.currentTime;
        this.scheduleAttack(this.masterGain);
    }

    stopSound(onReleased) {
        const playing = [this.child1, this.child2].filter((child) => child.isPlaying);
        let remaining = playing.length;
        this.inAttackSegment = false;
        this.inDecaySegment = true;
        const released = () => {
            remaining--;
            if (remaining > 0) return;
            const now = this.context.currentTime;
            this.masterGain.gain.cancelScheduledValues(now);
            this.masterGain.gain.setValueAtTime(0, now);
            this.inDecaySegment = false;
            onReleased?.();
        };
        if (remaining === 0) {
            remaining = 1;
            released();
            return;
        }
        for (const child of playing) child.stop(released);
    }

    updateParameter(name) {
        if (!this.child1 || !this.child2) return;
        if (name === 'fundamental_1' || name === 'fundamental_2') {
            const number = name.endsWith('1') ? 1 : 2;
            (number === 1 ? this.child1 : this.child2).rootFrequency =
                this.getParameter(name).get();
            return;
        }
        if (name === 'chord_1' || name === 'chord_2') {
            this._applyChord(name.endsWith('1') ? 1 : 2);
            return;
        }
        // Natural/rendezvous frequency, rendezvous phases, duration, and curve are
        // stored destinations. They take effect only through play() or events.
        if (name !== 'gain') return;
        const gain = this.getParameter('gain');
        if (this.inDecaySegment) return;
        if (this.inAttackSegment) {
            this.updateGainDuringAttack(
                this.masterGain, gain.get(), this.startTime, gain.attackTime
            );
        } else {
            this.masterGain.gain.setTargetAtTime(
                gain.get(), this.context.currentTime, 0.05
            );
        }
    }

    getTimingStats() {
        return {
            child1: this.child1.getTimingStats(),
            child2: this.child2.getTimingStats()
        };
    }

    destroy() {
        this.child1?.destroy();
        this.child2?.destroy();
        this.pan1?.disconnect();
        this.pan2?.disconnect();
        super.destroy();
    }
}

export default RendezvousPingerII;
