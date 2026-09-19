import { BaseSoundWithEvents } from '../BaseSoundWithEvents.js';
import { decaySecondsFromCoefficient } from '../utilities/decayMath.js';

// STK/Cook mechanical-system decay coefficient (~0.999 per sample @44.1kHz)
// -> decaySeconds ~= 0.0227s, T60 ~= 0.157s (see docs/MODEL_PATTERNS.md,
// "Decay constants must be derived, not transcribed"). PROVISIONAL: the
// old default of 0.35s (T60 ~2.4s) let shake energy persist across
// closely-spaced taps, so each shake's audible "attack" depended on how
// much energy happened to still be around from recent taps -- reported
// as the sound getting stuck in a louder or softer mode for several
// shakes at a time before switching. This much faster decay means
// consecutive shakes' residual energy clears before the next one
// typically arrives, so each impulse produces a more consistent jump
// from near-zero. Revisit (and possibly revert toward the old default)
// if this removes a wanted "shakes held close together build energy"
// character, or if it turns out not to fully explain the reported
// inconsistency (the collision generator is genuinely stochastic, so
// some shake-to-shake variation is expected and not a bug).
const SYSTEM_DECAY_DEFAULT = decaySecondsFromCoefficient(0.999, 44100);
const SYSTEM_DECAY_MIN = 0.01;

/**
 * A worklet-native PhISEM (Cook) maraca -- mechanical energy accumulation,
 * stochastic bean-collision generation, and one resonant gourd-body mode
 * all run inside maracaProcessor.js's process(), sample by sample. This
 * wrapper contains no per-collision DSP; it only exposes performance
 * parameters and the public strike() action. See
 * fromChat/energy/Claudio-PhISEM-Architecture-and-Maraca-First-Pass.md and
 * docs/MODEL_PATTERNS.md archetype 5.
 *
 * play() starts silent (zero stored energy) rather than auto-shaking --
 * call strike() to actually hear anything. All Cook/STK-derived constants
 * (resonanceFrequency's default among them) are provisional placeholders
 * pending listening-based refinement, not verified measured figures.
 */
export class Maraca extends BaseSoundWithEvents {
    static WORKLET_PATH = new URL('../worklets/maracaProcessor.js', import.meta.url).href;

    constructor(context, name, options = {}) {
        super(context, name, options.gain ?? 0.6);

        this.seed = options.seed ?? 1;

        this.addParameter('shakeEnergy', 0, 0, 1, 0, 0);
        this.addParameter('systemDecay', SYSTEM_DECAY_DEFAULT, SYSTEM_DECAY_MIN, 2.0, 0, 0);
        this.addIntegerParameter('numberOfObjects', 64, 4, 256);
        this.addParameter('resonanceFrequency', 3200, 500, 8000, 0, 0);

        this.addEvent(
            'strike',
            (data) => this._submitShake(data?.amount ?? 1),
            'Inject a discrete energy impulse (one bean shake).'
        );

        // Near-instant attack, matching _ChimeStrike.js's identical reasoning:
        // the audible "attack" of a shake already comes from the worklet's
        // own energy/collision/resonator response, not from this outer gain
        // node. BaseSound's generic 150ms default attackTime (meant for
        // models with no natural attack of their own) was audibly layering a
        // second, slower fade-in on top of it whenever scheduleAttack() ran
        // (a fresh Play, or a Play that resumed from decay) -- but not on a
        // Play that was a no-op (already playing, not decaying), which left
        // the worklet's real attack unshaped. That inconsistency, not
        // randomness, was the "sometimes soft" attack. decayTime (250ms, only
        // used on an explicit stop) is untouched.
        this.getParameter('gain').attackTime = 0.005;

        this.acceptingShakes = false;
        this.createNodes();
    }

    play() {
        if (this.isPlaying && this.inDecaySegment) {
            // BaseSound.play()'s resume-from-decay path calls scheduleAttack
            // directly and never re-invokes startSound(), so acceptingShakes
            // (only ever set true there) would otherwise stay false and
            // silently drop a shake fired right after resuming. Now that
            // attackTime is negligible (see constructor), there's no longer
            // a reason to force a full startSound()/DSP reset just to make
            // the gain ramp consistent -- that would also fight the natural
            // shake-during-decay blending EnergyAccumulator.setEnergy() (see
            // maracaProcessor.js) is meant to control on its own terms.
            this.acceptingShakes = true;
        }
        super.play();
    }

    createNodes() {
        this.workletNode = new AudioWorkletNode(this.context, 'maracaProcessor', {
            processorOptions: {
                sampleRate: this.context.sampleRate,
                seed: this.seed
            }
        });

        this.gainNode = this.context.createGain();
        this.workletNode.connect(this.gainNode);
        this.outputNode = this.gainNode;

        this.workletNode.parameters.get('active').setValueAtTime(0, this.context.currentTime);
        this.gainNode.gain.setValueAtTime(0, this.context.currentTime);
    }

    _submitShake(amount) {
        if (!this.acceptingShakes) return;
        this.workletNode.port.postMessage({ type: 'shake', amount });
    }

    startSound() {
        const now = this.context.currentTime;

        // Reset all synthesis state explicitly on every play, not just at
        // construction -- otherwise a fast stop-then-replay could resume
        // from whatever energy/resonator/DC-blocker state a prior shake
        // left behind (the 'active' gate stops output, it does not clear
        // internal state).
        this.workletNode.port.postMessage({ type: 'reset' });

        this.acceptingShakes = true;
        this.workletNode.parameters.get('active').setValueAtTime(1, now);
        this.scheduleAttack(this.gainNode);
        this.startTime = now;

        ['shakeEnergy', 'systemDecay', 'numberOfObjects', 'resonanceFrequency']
            .forEach((name) => this.updateParameter(name));
    }

    stopSound(onReleased) {
        this.acceptingShakes = false;
        this.scheduleDecay(this.gainNode, () => {
            this.workletNode.parameters.get('active').setValueAtTime(0, this.context.currentTime);
            if (typeof onReleased === 'function') onReleased();
        });
    }

    updateParameter(name) {
        const param = this.getParameter(name);
        const now = this.context.currentTime;

        switch (name) {
            case 'shakeEnergy':
            case 'systemDecay':
            case 'numberOfObjects':
            case 'resonanceFrequency':
                if (this.workletNode) {
                    this.workletNode.parameters.get(name).setValueAtTime(param.get(), now);
                }
                break;
            case 'gain':
                if (this.inDecaySegment) return;
                if (this.inAttackSegment) {
                    this.updateGainDuringAttack(this.gainNode, param.get(), this.startTime, param.attackTime);
                } else {
                    this.gainNode.gain.setTargetAtTime(param.get(), now, 0.05);
                }
                break;
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
        this.workletNode?.disconnect();
        this.gainNode?.disconnect();
    }
}

export default Maraca;
