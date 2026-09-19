import { BaseSoundWithEvents } from '../BaseSoundWithEvents.js';

/**
 * A worklet-native PhISEM (Cook) maraca -- mechanical energy accumulation,
 * stochastic bean-collision generation, and one resonant gourd-body mode
 * all run inside maracaProcessor.js's process(), sample by sample. This
 * wrapper contains no per-collision DSP; it only exposes performance
 * parameters and the public shake() action. See
 * fromChat/energy/Claudio-PhISEM-Architecture-and-Maraca-First-Pass.md and
 * docs/MODEL_PATTERNS.md archetype 5.
 *
 * play() starts silent (zero stored energy) rather than auto-shaking --
 * call shake() to actually hear anything. All Cook/STK-derived constants
 * (resonanceFrequency's default among them) are provisional placeholders
 * pending listening-based refinement, not verified measured figures.
 */
export class Maraca extends BaseSoundWithEvents {
    static WORKLET_PATH = new URL('../worklets/maracaProcessor.js', import.meta.url).href;

    constructor(context, name, options = {}) {
        super(context, name, options.gain ?? 0.6);

        this.seed = options.seed ?? 1;

        this.addParameter('shakeEnergy', 0, 0, 1, 0, 0);
        this.addParameter('systemDecay', 0.35, 0.05, 2.0, 0, 0);
        this.addIntegerParameter('numberOfObjects', 64, 4, 256);
        this.addParameter('resonanceFrequency', 3200, 500, 8000, 0, 0);

        this.addEvent(
            'shake',
            (data) => this._submitShake(data?.amount ?? 1),
            'Inject a discrete energy impulse (one bean shake).'
        );

        this.acceptingShakes = false;
        this.createNodes();
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
