import { BaseSound } from '../BaseSound.js';

// Curated single-attractor Chua variant, generated from a saved preset
// (soundlib/presets/Hamburger_Lady_Chua13.json). Reuses the same worklet as
// ChuaOscillator.js -- the DSP is identical, only which coefficients are
// frozen vs. exposed differs. Fixed at baseAttractor 13: gamma/m0/m1/mk are
// locked to the exact values explored when the preset was saved; alpha,
// beta, tscale, and gain stay live within the ranges discovered there.
//
// docstring_pub: From clean tone to gravelly with pitch drop. Reminiscent of
// the Throbbing Gristle "Hamburger Lady" drone.
// docstring_private: ChuaOscillator, with baseAttractor 13.

// Frozen coefficients (baseAttractor 13).
const GAMMA = 0.07759999999999997;
const M0 = -1.1278569999999994;
const M1 = -0.5127857000000006;
const MK = 0.42000000000000437;

export class HamburgerLadyChua13 extends BaseSound {
    static WORKLET_PATH = new URL('../worklets/chuaProcessor.js', import.meta.url).href;

    constructor(context, name) {
        super(context, name, 1); // gain default = 1, per preset

        this.docstringPub = 'From clean tone to grovely with pitch drop. Remnicent of the Throbbing Gristle Hamburger Lady drone.';

        // Preset recorded alpha/beta with min > max (fields were likely
        // swapped while editing the Save dialog) -- corrected here.
        // Trailing arg is the preset's recorded control preference ('roll' for
        // alpha); beta/tscale had mapping 'slider' in the preset, i.e. no hint.
        this.addParameter('alpha', 10.960000000000033, 10.960000000000033, 12.760000000000034, 0, 0, 'roll');
        this.addParameter('beta', 23.98, 19, 25, 0, 0);
        this.addParameter('tscale', 460, 400, 500, 0, 0);

        // Widen gain's range to [0, 2] per the preset (BaseSound defaults it to [0, 1]).
        const gainParam = this.getParameter('gain');
        gainParam.preference = 'pitch'; // preset's recorded control preference for gain
        gainParam.min = 0;
        gainParam.max = 2;

        this.createNodes();
    }

    createNodes() {
        if (!this.workletNode) {
            this.workletNode = new AudioWorkletNode(this.context, 'chuaProcessor', {
                processorOptions: { sampleRate: this.context.sampleRate }
            });
            this.gainNode = this.context.createGain();
            this.workletNode.connect(this.gainNode);
            this.outputNode = this.gainNode;

            this.workletNode.parameters.get('active').setValueAtTime(0, this.context.currentTime);
            this.gainNode.gain.setValueAtTime(0, this.context.currentTime);

            // Frozen coefficients: set once, never exposed, never updated again.
            const now = this.context.currentTime;
            this.workletNode.parameters.get('gamma').setValueAtTime(GAMMA, now);
            this.workletNode.parameters.get('m0').setValueAtTime(M0, now);
            this.workletNode.parameters.get('m1').setValueAtTime(M1, now);
            this.workletNode.parameters.get('mk').setValueAtTime(MK, now);
        }
    }

    startSound() {
        if (this.workletNode) {
            this.workletNode.port.postMessage({ action: 'start' });
            this.workletNode.parameters.get('active').setValueAtTime(1, this.context.currentTime);
            this.scheduleAttack(this.gainNode);
            this.startTime = this.context.currentTime;

            ['alpha', 'beta', 'tscale'].forEach(n => this.updateParameter(n));
        }
    }

    stopSound(onReleased) {
        this.scheduleDecay(this.gainNode, () => {
            if (this.workletNode) {
                this.workletNode.parameters.get('active').setValueAtTime(0, this.context.currentTime);
            }
            if (typeof onReleased === 'function') {
                onReleased();
            }
        });
    }

    updateParameter(name) {
        const param = this.getParameter(name);
        const now = this.context.currentTime;

        switch (name) {
            case 'alpha':
            case 'beta':
            case 'tscale':
                if (this.workletNode) {
                    this.workletNode.parameters.get(name).setValueAtTime(param.get(), now);
                }
                break;
            case 'gain':
                if (this.inDecaySegment) {
                    console.log('Ignoring gain update during decay.');
                    return;
                }
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
        if (this.workletNode) {
            this.workletNode.disconnect();
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
        }
    }
}
