import { BaseSoundWithEvents } from '../BaseSoundWithEvents.js';
import {
    CHORD_NAMES,
    TransitionPinger
} from './TransitionPinger.js';

/**
 * A musical "meta model" containing two independent TransitionPingers.
 *
 * The model deliberately preserves the notification slop of two ordinary
 * SoundModels: each child owns its own timing worklet and its own Ping pool.
 * RendezvousPinger coordinates them through their public, immediate APIs.
 */
export class RendezvousPinger extends BaseSoundWithEvents {
    static WORKLET_PATH = TransitionPinger.WORKLET_PATH;
    static CHORD_NAMES = CHORD_NAMES;

    constructor(context, name, options = {}) {
        super(context, name, options.gain ?? 0.6);

        this.addParameter('phasor_freq_1', options.phasorFrequency1 ?? 1.3, 0, 20);
        this.addParameter('phasor_freq_2', options.phasorFrequency2 ?? 2.1, 0, 20);
        this.addParameter('final_freq', options.finalFrequency ?? 2.5, 0, 20);
        this.addParameter('target_phase', options.targetPhase ?? 0.5, 0, 1);
        this.addParameter('transition_dur', options.transitionDuration ?? 5, 0, 60);
        this.addParameter('fundamental_1', options.fundamental1 ?? 196, 20, 4000);
        this.addParameter('fundamental_2', options.fundamental2 ?? 293.66, 20, 4000);

        // Public chord numbers are 1-4, a friendlier convention than the
        // zero-based array index used internally by TransitionPinger.
        this.addIntegerParameter('chord_1', options.chord1 ?? 1, 1, 4);
        this.addIntegerParameter('chord_2', options.chord2 ?? 2, 1, 4);

        this.addEvent(
            'rendezvous',
            () => this._beginRendezvous(),
            'Move both phasors to a common frequency and chosen phase relationship.'
        );

        this._createChildren(options);
    }

    _createChildren(options) {
        const sharedChildOptions = {
            poolSize: options.poolSize ?? 8,
            pingGateSeconds: options.pingGateSeconds ?? 0.08,
            pingDecaySeconds: options.pingDecaySeconds ?? 0.25,
            frequencyJitter: options.frequencyJitter ?? 0.005
        };

        this.child1 = new TransitionPinger(this.context, `${this.name}-child-1`, {
            ...sharedChildOptions,
            rootFrequency: this.getParameter('fundamental_1').get(),
            processorOptions: { initialRate: 0, initialPhase: 0 }
        });
        this.child2 = new TransitionPinger(this.context, `${this.name}-child-2`, {
            ...sharedChildOptions,
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
        // BaseSound uses gainNode when play() interrupts a release.
        this.gainNode = this.masterGain;

        this._applyChord(1);
        this._applyChord(2);
    }

    /** Set an immediate phasor state before starting or after a manual edit. */
    _setChildPhasorNow(child, frequency, phase = null) {
        child.setParameter('transition_dur', 0);
        if (phase !== null) child.setParameter('phase', phase);
        child.setParameter('freq', frequency);
    }

    _applyChord(childNumber) {
        const child = childNumber === 1 ? this.child1 : this.child2;
        if (!child) return;
        const publicChordNumber = this.getParameter(`chord_${childNumber}`).get();
        child.setParameter('chord', publicChordNumber - 1);
    }

    _beginRendezvous() {
        const finalFrequency = this.getParameter('final_freq').get();
        const duration = this.getParameter('transition_dur').get();
        const secondTargetPhase = this.getParameter('target_phase').get();

        // Each child receives a coherent set of staged values before its event.
        // The two event calls remain intentionally independent: this model is
        // measuring ordinary cross-model jitter, not hiding it with timestamps.
        this._stageTransition(this.child1, finalFrequency, 0, duration);
        this._stageTransition(this.child2, finalFrequency, secondTargetPhase, duration);
        this.child1.event('transition');
        this.child2.event('transition');
    }

    _stageTransition(child, frequency, phase, duration) {
        // Set duration first so frequency and phase remain staged rather than
        // taking immediate effect when a previous duration happened to be zero.
        child.setParameter('transition_dur', duration);
        child.setParameter('freq', frequency);
        child.setParameter('phase', phase);
    }

    startSound() {
        // Every play is a fresh rhythmic origin, regardless of where either
        // child phasor was frozen by the preceding stop.
        this._setChildPhasorNow(
            this.child1,
            this.getParameter('phasor_freq_1').get(),
            0
        );
        this._setChildPhasorNow(
            this.child2,
            this.getParameter('phasor_freq_2').get(),
            0
        );
        this.child1.play();
        this.child2.play();

        this.startTime = this.context.currentTime;
        this.scheduleAttack(this.masterGain);
    }

    stopSound(onReleased) {
        // Each TransitionPinger first stops accepting new notifications, then
        // waits for every active Ping voice to finish its own release. Only
        // after both complete do we silently reset this outer master gain.
        const playingChildren = [this.child1, this.child2]
            .filter((child) => child.isPlaying);
        let remaining = playingChildren.length;

        this.inAttackSegment = false;
        this.inDecaySegment = true;

        const childReleased = () => {
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
            childReleased();
            return;
        }
        for (const child of playingChildren) child.stop(childReleased);
    }

    updateParameter(name) {
        if (!this.child1 || !this.child2) return;

        if (name === 'phasor_freq_1' || name === 'phasor_freq_2') {
            const childNumber = name.endsWith('1') ? 1 : 2;
            const child = childNumber === 1 ? this.child1 : this.child2;
            this._setChildPhasorNow(child, this.getParameter(name).get());
            return;
        }
        if (name === 'fundamental_1' || name === 'fundamental_2') {
            const childNumber = name.endsWith('1') ? 1 : 2;
            const child = childNumber === 1 ? this.child1 : this.child2;
            child.rootFrequency = this.getParameter(name).get();
            return;
        }
        if (name === 'chord_1' || name === 'chord_2') {
            this._applyChord(name.endsWith('1') ? 1 : 2);
            return;
        }

        // final_freq, target_phase, and transition_dur are staged meta-model
        // values. They intentionally do nothing until rendezvous is fired.
        if (name !== 'gain') return;
        const gain = this.getParameter('gain');
        if (this.inDecaySegment) return;
        if (this.inAttackSegment) {
            this.updateGainDuringAttack(
                this.masterGain,
                gain.get(),
                this.startTime,
                gain.attackTime
            );
        } else {
            this.masterGain.gain.setTargetAtTime(
                gain.get(),
                this.context.currentTime,
                0.05
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

export default RendezvousPinger;
