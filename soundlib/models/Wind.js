import { BaseSound } from '../BaseSound.js';
import { WIND_CONFIG } from './Wind/windConfig.js';

/**
 * Continuous noise-excited, simplex-modulated resonant filter -- ported
 * from scratch/DS_Wind_1.1/DSWind.py (a non-real-time Python prototype).
 * Broadband noise, lowpass-filtered, excites a single time-varying
 * resonant mode (ResonatorBank, one mode) whose center frequency AND gain
 * are both driven, every block, by the SAME multi-octave simplex
 * trajectory -- one shared "gustiness" motion reads as a coherent shift in
 * both pitch and loudness together, not two independently-flickering
 * parameters. See docs/MODEL_PATTERNS.md archetype 5.2.
 *
 * Unlike the PhISEM family (archetype 5.1), there is no discrete trigger --
 * this is a continuously-playing texture from the moment play() is called,
 * so it extends plain BaseSound (not BaseSoundWithEvents) and uses the
 * default attack/decay lifecycle, same as DroneModel.
 */
export class Wind extends BaseSound {
    static WORKLET_PATH = new URL('./Wind/windProcessor.js', import.meta.url).href;

    constructor(context, name, options = {}) {
        super(context, name);

        this.seed = options.seed ?? 1;

        this.addParameter('strength', WIND_CONFIG.strengthDefault, 0, 1, 0, 0);
        this.addParameter('deviation', WIND_CONFIG.deviationDefault, 0, 1, 0, 0);
        this.addParameter('gustiness', WIND_CONFIG.gustinessDefault, 0, 1, 0, 0);
        this.addParameter('howliness', WIND_CONFIG.howlinessDefault, 0, 1, 0, 0);

        this.docstringPub = 'An ever-shifting gust of resonant wind.';

        this.createNodes();
    }

    createNodes() {
        this.workletNode = new AudioWorkletNode(this.context, 'windProcessor', {
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

    startSound() {
        const now = this.context.currentTime;

        // Reset every play, not just at construction -- same reasoning as
        // BambooChimes.js: the gust trajectory always starts fresh each
        // play, matching DSWind.py's own generate() always starting its
        // simplex trajectory from t=0.
        this.workletNode.port.postMessage({ type: 'reset' });

        this.workletNode.parameters.get('active').setValueAtTime(1, now);
        this.scheduleAttack(this.gainNode);
        this.startTime = now;

        ['strength', 'deviation', 'gustiness', 'howliness'].forEach((name) => this.updateParameter(name));
    }

    stopSound(onReleased) {
        this.scheduleDecay(this.gainNode, () => {
            this.workletNode.parameters.get('active').setValueAtTime(0, this.context.currentTime);
            if (typeof onReleased === 'function') onReleased();
        });
    }

    updateParameter(name) {
        const param = this.getParameter(name);
        const now = this.context.currentTime;

        switch (name) {
            case 'strength':
            case 'deviation':
            case 'gustiness':
            case 'howliness':
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

export default Wind;
