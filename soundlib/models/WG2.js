import { BaseSoundWithEvents } from '../BaseSoundWithEvents.js';
import { WG2_CONFIG } from './WG2/wg2Config.js';

/**
 * WaveguideResonator v1, Phase B -- a real-time digital-waveguide plucked
 * string with genuine spatial meaning: a true bidirectional two-rail
 * waveguide (not WG1's single lumped loop), so excitation position, pickup
 * position, and pickup type (displacement/velocity/bridgeForce) are
 * physically meaningful, not just extra numbers. See
 * scratch/WaveguideResonator-v1-Specification-and-Reasoning-Model.md and
 * docs/MODEL_PATTERNS.md's digital-waveguide archetype.
 *
 * A genuinely different DSP graph from WG1 (its own worklet, not a WG1
 * subclass), even though most of the underlying components
 * (LoopLossFilter, RigidTermination, InitialConditionExciter) are shared.
 *
 * play() starts silent (an unexcited loop) rather than auto-plucking --
 * call pluck() to actually hear anything, same as WG1.pluck().
 */
export class WG2 extends BaseSoundWithEvents {
    static WORKLET_PATH = new URL('./WG2/wg2Processor.js', import.meta.url).href;

    constructor(context, name, options = {}) {
        super(context, name, options.gain ?? 0.6);

        this.seed = options.seed ?? 1;

        this.addParameter('frequency', WG2_CONFIG.frequencyDefaultHz, WG2_CONFIG.frequencyMinHz, WG2_CONFIG.frequencyMaxHz, 0, 0);
        this.addParameter('energy', WG2_CONFIG.energyDefault, 0, 1, 0, 0);
        this.addParameter('decayTime', WG2_CONFIG.decayTimeDefaultSeconds, WG2_CONFIG.decayTimeMinSeconds, WG2_CONFIG.decayTimeMaxSeconds, 0, 0);
        this.addParameter('excitationPosition', WG2_CONFIG.excitationPositionDefault, WG2_CONFIG.excitationPositionMin, WG2_CONFIG.excitationPositionMax, 0, 0);
        this.addParameter('pickupPosition', WG2_CONFIG.pickupPositionDefault, WG2_CONFIG.pickupPositionMin, WG2_CONFIG.pickupPositionMax, 0, 0);
        this.addParameter('stiffness', WG2_CONFIG.stiffnessDefault, WG2_CONFIG.stiffnessMin, WG2_CONFIG.stiffnessMax, 0, 0);
        this.addParameter('dispersionPivot', WG2_CONFIG.dispersionPivotDefault, WG2_CONFIG.dispersionPivotMin, WG2_CONFIG.dispersionPivotMax, 0, 0);
        this.addParameter('dispersionSlope', WG2_CONFIG.dispersionSlopeDefault, WG2_CONFIG.dispersionSlopeMin, WG2_CONFIG.dispersionSlopeMax, 0, 0);
        this.addStringParameter('excitationType', WG2_CONFIG.excitationTypeDefault, WG2_CONFIG.excitationTypeChoices);
        this.addStringParameter('pickupType', WG2_CONFIG.pickupTypeDefault, WG2_CONFIG.pickupTypeChoices);

        this.addEvent(
            'pluck',
            () => this._submitPluck(),
            'Excite the string at excitationPosition with a fresh initial condition (a pluck/strike).'
        );

        // Near-instant attack -- same reasoning as WG1.js/Maraca.js: the
        // audible attack of a pluck already comes from the worklet's own
        // excitation/loop response, not from this outer gain node.
        this.getParameter('gain').attackTime = 0.005;

        this.docstringPub = 'Pluck the string -- move excitation and pickup position to hear different overtones.';

        this.acceptingPlucks = false;
        this.createNodes();
    }

    play() {
        if (this.isPlaying && this.inDecaySegment) {
            // Same reasoning as WG1.js's play() override.
            this.acceptingPlucks = true;
        }
        super.play();
    }

    createNodes() {
        this.workletNode = new AudioWorkletNode(this.context, 'wg2Processor', {
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
        // construction -- same reasoning as WG1.js/Maraca.js.
        this.workletNode.port.postMessage({ type: 'reset' });

        this.acceptingPlucks = true;
        this.workletNode.parameters.get('active').setValueAtTime(1, now);
        this.scheduleAttack(this.gainNode);
        this.startTime = now;

        ['frequency', 'energy', 'decayTime', 'excitationPosition', 'pickupPosition', 'stiffness', 'dispersionPivot', 'dispersionSlope', 'excitationType', 'pickupType']
            .forEach((name) => this.updateParameter(name));
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
            case 'excitationPosition':
            case 'pickupPosition':
            case 'stiffness':
            case 'dispersionPivot':
            case 'dispersionSlope':
                if (this.workletNode) {
                    this.workletNode.parameters.get(name).setValueAtTime(param.get(), now);
                }
                break;
            case 'excitationType':
                if (this.workletNode) {
                    this.workletNode.port.postMessage({ type: 'set-excitation-type', excitationType: param.get() });
                }
                break;
            case 'pickupType':
                if (this.workletNode) {
                    this.workletNode.port.postMessage({ type: 'set-pickup-type', pickupType: param.get() });
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

export default WG2;
