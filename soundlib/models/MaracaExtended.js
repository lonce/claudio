import { Maraca } from './Maraca.js';
import { bandwidthFromDecay } from '../utilities/decayMath.js';
import { MARACA_CONFIG } from '../worklets/maracaConfig.js';

const EXTRA_PARAMETERS = ['resonanceBandwidth', 'collisionRateScale', 'collisionDecaySeconds'];

/**
 * Maraca, with a lower resonanceFrequency floor and three normally-fixed
 * MARACA_CONFIG constants exposed as live parameters -- resonanceBandwidth
 * (the resonator's own damping/Q), collisionRateScale (collision density
 * independent of numberOfObjects), and collisionDecaySeconds (the
 * architecture doc's deferred "brightness": each collision's own
 * hardness/blur). Same worklet as Maraca.js (docs/MODEL_PATTERNS.md
 * archetype 3, "One worklet, many models") -- maracaProcessor.js already
 * exposes these three as AudioParams for exactly this purpose, and Maraca
 * itself never touches them, so this model changes nothing about Maraca's
 * own behavior.
 */
export class MaracaExtended extends Maraca {
    constructor(context, name, options = {}) {
        super(context, name, options);

        // Same technique docs/MODEL_PATTERNS.md archetype 9 already uses for
        // a preset-derived model adjusting an inherited parameter's range --
        // no addParameter() call to make, resonanceFrequency already exists.
        this.getParameter('resonanceFrequency').min = 100;

        this.addParameter(
            'resonanceBandwidth',
            bandwidthFromDecay(MARACA_CONFIG.modeDecaySeconds),
            15, 4000, 0, 0
        );
        this.addParameter('collisionRateScale', MARACA_CONFIG.collisionRateScale, 0.5, 64, 0, 0);
        this.addParameter(
            'collisionDecaySeconds',
            MARACA_CONFIG.collisionDecaySeconds,
            0.0001, 0.01, 0, 0
        );
    }

    startSound() {
        super.startSound();
        EXTRA_PARAMETERS.forEach((name) => this.updateParameter(name));
    }

    updateParameter(name) {
        if (EXTRA_PARAMETERS.includes(name)) {
            if (this.workletNode) {
                this.workletNode.parameters.get(name).setValueAtTime(
                    this.getParameter(name).get(),
                    this.context.currentTime
                );
            }
            return;
        }
        super.updateParameter(name);
    }
}

export default MaracaExtended;
