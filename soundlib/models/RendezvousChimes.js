import { BaseSoundWithEvents } from '../BaseSoundWithEvents.js';
import { PSChimePinger } from './RendezvousChimes/_PSChimePinger.js';

const CHILD_COUNT = 4;
const DEFAULT_PITCHES = [60, 62, 64, 65]; // adjacent major-scale degrees (do-re-mi-fa)
const DEFAULT_PANS = [-0.6, -0.2, 0.2, 0.6];
const DEFAULT_PHASES = [0, 0.125, 0.25, 0.375];

function mod1(value) {
    return ((value % 1) + 1) % 1;
}

// The phasor's own `phase` means "how far already advanced into this cycle",
// so its *next* crossing is `1 - phase` away, not `phase` away -- a phase of
// .25 crosses at t=0.75, .125 seconds *before* a phase of 0's own crossing
// at t=1, not after it. delayPhaseToNative() inverts that so this model's
// own phase_N parameters read as an intuitive delay: after this conversion,
// a child with phase_N = P crosses at t = P, 1+P, 2+P, ... -- exactly P
// seconds after the phase_N = 0 child's own t = 1, 2, 3, ... crossings.
function delayPhaseToNative(delayPhase) {
    return mod1(-delayPhase);
}

/**
 * Four rhythmic phasors, each striking its own wind-chime tube (ChimeStrike,
 * via PSChimePinger), that can rendezvous at shared slider-set targets, then
 * return to a separately-set "natural" configuration -- both are just
 * "transition to whatever freq_N/weight_N(/phase_N) are set to right now",
 * differing only in whether an endpoint phase is imposed. Unlike
 * RendezvousPingerII/III, there is no baked-in doubled natural/rendezvous
 * parameter set: the app's Snapshots feature (localStorage-backed slider
 * recall) already covers "save and recall a named configuration," so the
 * model only needs to remember one destination per child at a time.
 */
export class RendezvousChimes extends BaseSoundWithEvents {
    static WORKLET_PATH = PSChimePinger.WORKLET_PATH;

    constructor(context, name, options = {}) {
        super(context, name, options.gain ?? 0.6);

        for (let i = 1; i <= CHILD_COUNT; i++) {
            this.addParameter(`freq_${i}`, options[`frequency${i}`] ?? 1, 0, 20);
            this.addParameter(`weight_${i}`, options[`weight${i}`] ?? 0, 0, 3);
            this.addParameter(`phase_${i}`, options[`phase${i}`] ?? DEFAULT_PHASES[i - 1], 0, 1);
            this.addParameter(`pitch_${i}`, options[`pitch${i}`] ?? DEFAULT_PITCHES[i - 1], 54, 90);
        }
        this.addParameter('transition_dur', options.transitionDuration ?? 5, 0, 60);
        this.addParameter('transition_sharpness', options.transitionSharpness ?? 3, 0, 6);

        this.addEvent(
            'rendezvous w/phase',
            () => this._beginTransition(true),
            'Move all four phasors to the current frequency, weight, and phase sliders.'
        );
        this.addEvent(
            'rendezvous natural',
            () => this._beginTransition(false),
            'Move all four phasors to the current frequency and weight sliders, phase left free.'
        );

        this._createChildren(options);
    }

    _createChildren(options) {
        this.children = [];
        for (let i = 1; i <= CHILD_COUNT; i++) {
            const child = new PSChimePinger(this.context, `${this.name}-child-${i}`, {
                pitch: this.getParameter(`pitch_${i}`).get(),
                processorOptions: {
                    initialRate: 0,
                    initialPhase: 0,
                    initialWeight: 0,
                    seed: options[`seed${i}`] ?? i,
                    // PlusSimplexPhasor's default planningSteps (1024) makes a
                    // phase-targeted beginTransition's bisection search take
                    // several ms -- fine for one phasor, but 'rendezvous
                    // w/phase' fires it on all 4 children in the same render
                    // quantum, which measured well over an audio callback's
                    // budget and produced an audible glitch. 128 measured
                    // ~20x cheaper with no loss of landing accuracy (only the
                    // interior glide's resolution, ~1 point/39ms over a
                    // multi-second transition, is coarser).
                    planningSteps: options[`planningSteps${i}`] ?? 128
                }
            });
            child.setParameter('gain', options[`childGain${i}`] ?? 0.45);
            this.children.push(child);
        }

        this.pans = DEFAULT_PANS.map((pan, index) =>
            new StereoPannerNode(this.context, { pan: options[`pan${index + 1}`] ?? pan })
        );
        this.masterGain = this.context.createGain();
        this.masterGain.gain.setValueAtTime(0, this.context.currentTime);
        this.children.forEach((child, index) => {
            child.connect(this.pans[index]);
            this.pans[index].connect(this.masterGain);
        });
        this.outputNode = this.masterGain;
        this.gainNode = this.masterGain;
    }

    _setChildNow(child, frequency, weight, delayPhase) {
        child.setParameter('transition_dur', 0);
        child.setParameter('phase', delayPhaseToNative(delayPhase));
        child.setParameter('weight', weight);
        child.setParameter('freq', frequency);
    }

    _stage(child, frequency, weight, duration, delayPhase = null) {
        child.setParameter('transition_dur', duration);
        child.setParameter(
            'transition_sharpness',
            this.getParameter('transition_sharpness').get()
        );
        child.setParameter('freq', frequency);
        child.setParameter('weight', weight);
        if (delayPhase !== null) {
            child.setParameter('phase', delayPhaseToNative(delayPhase));
        }
    }

    _beginTransition(withPhase) {
        const duration = this.getParameter('transition_dur').get();
        this.children.forEach((child, index) => {
            const i = index + 1;
            const frequency = this.getParameter(`freq_${i}`).get();
            const weight = this.getParameter(`weight_${i}`).get();
            const delayPhase = withPhase ? this.getParameter(`phase_${i}`).get() : null;
            this._stage(child, frequency, weight, duration, delayPhase);
            child.event(withPhase ? 'transition' : 'transition-natural');
        });
    }

    startSound() {
        this.children.forEach((child, index) => {
            const i = index + 1;
            this._setChildNow(
                child,
                this.getParameter(`freq_${i}`).get(),
                this.getParameter(`weight_${i}`).get(),
                this.getParameter(`phase_${i}`).get()
            );
            child.play();
        });
        this.startTime = this.context.currentTime;
        this.scheduleAttack(this.masterGain);
    }

    stopSound(onReleased) {
        const playing = this.children.filter((child) => child.isPlaying);
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
        if (!this.children) return;
        const pitchMatch = /^pitch_(\d+)$/.exec(name);
        if (pitchMatch) {
            const index = Number(pitchMatch[1]) - 1;
            this.children[index]?.setParameter('pitch', this.getParameter(name).get());
            return;
        }
        // freq_N/weight_N/phase_N, transition_dur, and transition_sharpness are
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
        return Object.fromEntries(
            this.children.map((child, index) => [`child${index + 1}`, child.getTimingStats()])
        );
    }

    destroy() {
        this.children?.forEach((child) => child.destroy());
        this.pans?.forEach((pan) => pan.disconnect());
        super.destroy();
    }
}

export default RendezvousChimes;
