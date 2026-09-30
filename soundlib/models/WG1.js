import { BaseSoundWithEvents } from '../BaseSoundWithEvents.js';
import { WG1_CONFIG } from './WG1/wg1Config.js';

/**
 * WaveguideResonator v1, Phase A -- a real-time digital-waveguide plucked
 * string: a single fractional-delay feedback loop, seeded noise/impulse
 * excitation, an explicit broadband loop-loss stage, a rigid (near-
 * lossless, non-inverting round-trip) termination, and a fixed pickup.
 * See scratch/WaveguideResonator-v1-Specification-and-Reasoning-Model.md
 * and docs/MODEL_PATTERNS.md's digital-waveguide archetype.
 *
 * A structurally different propagation primitive from every other
 * resonant model in this library (which all use ResonatorBank's 2-pole
 * IIR topology) -- this is delay-line wave propagation instead.
 *
 * play() starts silent (an unexcited loop) rather than auto-plucking --
 * call pluck() to actually hear anything, same as Maraca.strike().
 * frequency retunes continuously/live ("stable" mode, per the spec's own
 * section 8.3) -- there is no separate discrete retrigger mode in Phase A.
 */
export class WG1 extends BaseSoundWithEvents {
    static WORKLET_PATH = new URL('./WG1/wg1Processor.js', import.meta.url).href;

    constructor(context, name, options = {}) {
        super(context, name, options.gain ?? 0.6);

        this.seed = options.seed ?? 1;

        this.addParameter('frequency', WG1_CONFIG.frequencyDefaultHz, WG1_CONFIG.frequencyMinHz, WG1_CONFIG.frequencyMaxHz, 0, 0);
        this.addParameter('energy', WG1_CONFIG.energyDefault, 0, 1, 0, 0);
        this.addParameter('decayTime', WG1_CONFIG.decayTimeDefaultSeconds, WG1_CONFIG.decayTimeMinSeconds, WG1_CONFIG.decayTimeMaxSeconds, 0, 0);
        this.addStringParameter('excitationType', WG1_CONFIG.excitationTypeDefault);

        this.addEvent(
            'pluck',
            () => this._submitPluck(),
            'Excite the loop with a fresh initial condition (a pluck/strike).'
        );

        // Near-instant attack -- same reasoning as Maraca.js/_ChimeStrike.js:
        // the audible attack of a pluck already comes from the worklet's
        // own excitation/loop response, not from this outer gain node.
        this.getParameter('gain').attackTime = 0.005;

        this.docstringPub = 'Pluck the string!';

        this.acceptingPlucks = false;
        this.createNodes();
    }

    play() {
        if (this.isPlaying && this.inDecaySegment) {
            // Same reasoning as Maraca.js's play() override.
            this.acceptingPlucks = true;
        }
        super.play();
    }

    createNodes() {
        this.workletNode = new AudioWorkletNode(this.context, 'wg1Processor', {
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

    _submitPluck() {
        if (!this.acceptingPlucks) return;
        this.workletNode.port.postMessage({ type: 'pluck' });
    }

    startSound() {
        const now = this.context.currentTime;

        // Reset all synthesis state explicitly on every play, not just at
        // construction -- same reasoning as Maraca.js.
        this.workletNode.port.postMessage({ type: 'reset' });

        this.acceptingPlucks = true;
        this.workletNode.parameters.get('active').setValueAtTime(1, now);
        this.scheduleAttack(this.gainNode);
        this.startTime = now;

        ['frequency', 'energy', 'decayTime', 'excitationType'].forEach((name) => this.updateParameter(name));
    }

    stopSound(onReleased) {
        this.acceptingPlucks = false;
        this.scheduleDecay(this.gainNode, () => {
            this.workletNode.parameters.get('active').setValueAtTime(0, this.context.currentTime);
            if (typeof onReleased === 'function') onReleased();
        });
    }

    updateParameter(name) {
        const param = this.getParameter(name);
        const now = this.context.currentTime;

        switch (name) {
            case 'frequency':
            case 'energy':
            case 'decayTime':
                if (this.workletNode) {
                    this.workletNode.parameters.get(name).setValueAtTime(param.get(), now);
                }
                break;
            case 'excitationType':
                if (this.workletNode) {
                    this.workletNode.port.postMessage({ type: 'set-excitation-type', excitationType: param.get() });
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

export default WG1;
