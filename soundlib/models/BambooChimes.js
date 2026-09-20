import { BaseSoundWithEvents } from '../BaseSoundWithEvents.js';
import { bandwidthFromDecay } from '../utilities/decayMath.js';
import { BAMBOO_CHIME_CONFIG } from '../worklets/bambooChimeConfig.js';

/**
 * A worklet-native PhISEM (Cook/STK "Tuned Bamboo Chimes", type 22) bamboo
 * chime cluster -- structural reference is Maraca.js (attack/decay
 * lifecycle, strike event, per-play reset), but with its own worklet:
 * each collision excites ONE randomly-chosen tube (of 7 tuned pitches)
 * rather than a single shared body resonance, so struck tubes keep ringing
 * independently while later collisions hit other tubes. This is the
 * Phase G structural-generalization test of the PhISEM architecture -- see
 * docs/MODEL_PATTERNS.md archetype 5.1 and
 * fromChat/energy/Claudio-PhISEM-Architecture-and-Maraca-First-Pass.md.
 *
 * play() starts silent (zero stored energy) rather than auto-striking --
 * call strike() to actually hear anything, same as Maraca.
 */
export class BambooChimes extends BaseSoundWithEvents {
    static WORKLET_PATH = new URL('../worklets/bambooChimeProcessor.js', import.meta.url).href;

    constructor(context, name, options = {}) {
        super(context, name, options.gain ?? 0.6);

        this.seed = options.seed ?? 1;

        this.addParameter('shakeEnergy', 0, 0, 1, 0, 0);
        this.addParameter('systemDecay', BAMBOO_CHIME_CONFIG.systemDecayDefault, 0.01, 2.0, 0, 0);
        this.addParameter('collisionDensity', BAMBOO_CHIME_CONFIG.collisionDensityDefault, 0.1, 20, 0, 0);
        this.addParameter(
            'resonanceBandwidth',
            bandwidthFromDecay(BAMBOO_CHIME_CONFIG.tubeModeDecaySeconds),
            2, 100, 0, 0
        );
        this.addParameter('frequencyScale', 1.0, 0.5, 2.0, 0, 0);
        this.addParameter(
            'collisionDecaySeconds',
            BAMBOO_CHIME_CONFIG.collisionDecaySeconds,
            0.0001, 0.01, 0, 0
        );
        this.addParameter('collisionRateScale', BAMBOO_CHIME_CONFIG.collisionRateScaleDefault, 0.5, 64, 0, 0);

        this.addEvent(
            'strike',
            (data) => this._submitStrike(data?.amount ?? 1),
            'Inject a discrete energy impulse (one tube clack).'
        );

        // Near-instant attack -- same reasoning as Maraca.js: the audible
        // "attack" of a strike already comes from the worklet's own
        // energy/collision/resonator response, not from this outer gain
        // node.
        this.getParameter('gain').attackTime = 0.005;

        this.docstringPub = 'Strike the tuned bamboo tubes!';

        this.acceptingStrikes = false;
        this.createNodes();
    }

    play() {
        if (this.isPlaying && this.inDecaySegment) {
            // Same reasoning as Maraca.js's play() override.
            this.acceptingStrikes = true;
        }
        super.play();
    }

    createNodes() {
        this.workletNode = new AudioWorkletNode(this.context, 'bambooChimeProcessor', {
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

    _submitStrike(amount) {
        if (!this.acceptingStrikes) return;
        this.workletNode.port.postMessage({ type: 'strike', amount });
    }

    startSound() {
        const now = this.context.currentTime;

        // Reset all synthesis state explicitly on every play, not just at
        // construction -- same reasoning as Maraca.js.
        this.workletNode.port.postMessage({ type: 'reset' });

        this.acceptingStrikes = true;
        this.workletNode.parameters.get('active').setValueAtTime(1, now);
        this.scheduleAttack(this.gainNode);
        this.startTime = now;

        [
            'shakeEnergy', 'systemDecay', 'collisionDensity',
            'resonanceBandwidth', 'frequencyScale',
            'collisionDecaySeconds', 'collisionRateScale'
        ].forEach((name) => this.updateParameter(name));
    }

    stopSound(onReleased) {
        this.acceptingStrikes = false;
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
            case 'collisionDensity':
            case 'resonanceBandwidth':
            case 'frequencyScale':
            case 'collisionDecaySeconds':
            case 'collisionRateScale':
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

export default BambooChimes;
