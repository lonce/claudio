import { BaseSoundWithEvents } from '../../BaseSoundWithEvents.js';
import {
    CHORD_NAMES,
    PSPinger
} from './_PSPinger.js';

/**
 * Two rhythmic phasors that can rendezvous at a shared rate/weight/phase
 * relation, then drift back to their independently stored natural
 * rates/weights. Structural sibling of RendezvousPingerII, built on
 * PSPinger (PlusSimplexPhasor) instead of PhaseEventPinger
 * (TransitionPhasor) -- adds natural_weight_1/natural_weight_2/
 * rendezvous_weight, PS's simplex-driven timing-irregularity control, all
 * defaulting to 0 so this plays identically to RendezvousPingerII until
 * dialed up. Also picks up PlusSimplexPhasor's nearest-first,
 * early-exiting transition-branch search "for free" -- TransitionPhasor's
 * own search evaluates its full candidate window unconditionally, a known,
 * separately-tracked inefficiency this model sidesteps rather than fixes.
 */
export class RendezvousPingerIII extends BaseSoundWithEvents {
    static WORKLET_PATH = PSPinger.WORKLET_PATH;
    static CHORD_NAMES = CHORD_NAMES;

    constructor(context, name, options = {}) {
        super(context, name, options.gain ?? 0.6);

        this.addParameter('natural_freq_1', options.naturalFrequency1 ?? 1.3, 0, 20);
        this.addParameter('natural_freq_2', options.naturalFrequency2 ?? 2.1, 0, 20);
        this.addParameter('natural_weight_1', options.naturalWeight1 ?? 0, 0, 3);
        this.addParameter('natural_weight_2', options.naturalWeight2 ?? 0, 0, 3);
        this.addParameter('rendezvous_freq', options.rendezvousFrequency ?? 2.5, 0, 20);
        this.addParameter('rendezvous_weight', options.rendezvousWeight ?? 0, 0, 3);
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
            'Move both phasors to the rendezvous frequency, weight, and phases.'
        );
        this.addEvent(
            'natural',
            () => this._beginNaturalReturn(),
            'Drift both phasors back to their stored natural frequencies and weights.'
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
        // PlusSimplexPhasor's default planningSteps (1024) makes a
        // phase-targeted beginTransition's bisection search take several ms
        // -- measured well over a single audio callback's budget (~2.67ms at
        // 128 samples/48kHz) on its own, so the 'rendezvous' event (which
        // fires it on both children in the same render quantum) can produce
        // an audible glitch. 128 measured ~20x cheaper with no loss of
        // landing accuracy (only the interior glide's resolution, ~1
        // point/39ms over a multi-second transition, is coarser).
        this.child1 = new PSPinger(this.context, `${this.name}-child-1`, {
            ...shared,
            rootFrequency: this.getParameter('fundamental_1').get(),
            processorOptions: {
                initialRate: 0, initialPhase: 0, initialWeight: 0,
                seed: options.seed1 ?? 1, planningSteps: options.planningSteps1 ?? 128
            }
        });
        this.child2 = new PSPinger(this.context, `${this.name}-child-2`, {
            ...shared,
            rootFrequency: this.getParameter('fundamental_2').get(),
            processorOptions: {
                initialRate: 0, initialPhase: 0, initialWeight: 0,
                seed: options.seed2 ?? 2, planningSteps: options.planningSteps2 ?? 128
            }
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

    _setChildNow(child, frequency, weight, phase = null) {
        child.setParameter('transition_dur', 0);
        if (phase !== null) child.setParameter('phase', phase);
        child.setParameter('weight', weight);
        child.setParameter('freq', frequency);
    }

    _applyChord(number) {
        const child = number === 1 ? this.child1 : this.child2;
        if (!child) return;
        child.setParameter('chord', this.getParameter(`chord_${number}`).get() - 1);
    }

    _stage(child, frequency, weight, duration, phase = null) {
        child.setParameter('transition_dur', duration);
        child.setParameter(
            'transition_sharpness',
            this.getParameter('transition_sharpness').get()
        );
        child.setParameter('freq', frequency);
        child.setParameter('weight', weight);
        if (phase !== null) child.setParameter('phase', phase);
    }

    _beginRendezvous() {
        const frequency = this.getParameter('rendezvous_freq').get();
        const weight = this.getParameter('rendezvous_weight').get();
        const duration = this.getParameter('transition_dur').get();
        this._stage(this.child1, frequency, weight, duration,
            this.getParameter('rendezvous_phase_1').get());
        this._stage(this.child2, frequency, weight, duration,
            this.getParameter('rendezvous_phase_2').get());
        this.child1.event('transition');
        this.child2.event('transition');
    }

    _beginNaturalReturn() {
        const duration = this.getParameter('transition_dur').get();
        this._stage(this.child1, this.getParameter('natural_freq_1').get(),
            this.getParameter('natural_weight_1').get(), duration);
        this._stage(this.child2, this.getParameter('natural_freq_2').get(),
            this.getParameter('natural_weight_2').get(), duration);
        this.child1.event('transition-natural');
        this.child2.event('transition-natural');
    }

    startSound() {
        this._setChildNow(this.child1, this.getParameter('natural_freq_1').get(),
            this.getParameter('natural_weight_1').get(), 0);
        this._setChildNow(this.child2, this.getParameter('natural_freq_2').get(),
            this.getParameter('natural_weight_2').get(), 0);
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
        // Natural/rendezvous frequency, weight, rendezvous phases, duration, and
        // curve are stored destinations. They take effect only through play() or
        // events.
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

export default RendezvousPingerIII;
