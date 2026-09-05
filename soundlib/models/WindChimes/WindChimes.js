import { BaseSoundWithEvents } from '../../BaseSoundWithEvents.js';
import { ChimeTube } from './ChimeTube.js';
import { measuredPitchRange } from './_partialRatioTable.js';

// Spread numberOfBells default pitches evenly across the Python original's
// 5 measured tubes' own pitch span. Partial ratios aren't chosen here --
// each ChimeStrike re-derives its own ratios from ratiosForPitch() at
// strike time, from whatever pitch is currently set (see _ChimeStrike.js).
function defaultPitchesForBells(n) {
    const [minPitch, maxPitch] = measuredPitchRange();
    if (n <= 1) return [(minPitch + maxPitch) / 2];
    return Array.from({ length: n }, (_, i) => minPitch + (maxPitch - minPitch) * i / (n - 1));
}

// A wind-chime ensemble (5 tubes by default), ported from
// scratch/DS_WindChimes_1.1/WindChimes.py. Each tube is an independent
// ChimeTube (own seed, own simplex-noise-triggered ChimeStrike); this model
// constructs numberOfBells of them, pans them across the stereo field, sums
// them, and forwards one shared "wind strength" control to all of them --
// matching how the Python original's WindChimes model read a single
// self.getParam("strength") that every tube derived its own behavior from.
export class WindChimes extends BaseSoundWithEvents {
    static WORKLET_PATH = ChimeTube.WORKLET_PATH;

    constructor(context, name, options = {}) {
        super(context, name);

        this.docstringPub = 'A wind-chime ensemble, ported from a Python wind-chime sound ' +
            'design. strength is the shared "wind strength" control (density + intensity, ' +
            'ensemble-wide); each pitch_N tunes one bell for its next strike.';

        const numberOfBells = options.numberOfBells ?? 5;
        const seeds = options.seeds ?? Array.from({ length: numberOfBells }, (_, i) => i + 1);
        // Authoritative bell count: if a caller-supplied seeds array disagrees
        // with numberOfBells, seeds.length wins, keeping pan math consistent.
        this.numberOfBells = seeds.length;
        this.panSpreadRadians = Math.max(0, Math.min(Math.PI, options.panSpreadRadians ?? Math.PI / 2));
        // Each ChimeTube's own default gain (0.6, inherited from BaseSound) was
        // too soft for the summed 5-tube ensemble -- raise every child's
        // initial gain instead of raising the ensemble's own master gain, so
        // headroom stays in the individual strikes rather than being made up
        // for after summing.
        this.childGain = options.childGain ?? 0.9;

        this.addParameter('strength', 0.5, 0, 1, 0, 0);

        this._createChildren(seeds, options.octaveWeights);
    }

    _panForBell(i) {
        const n = this.numberOfBells;
        if (n <= 1) return 0;
        const angle = -this.panSpreadRadians / 2 + this.panSpreadRadians * i / (n - 1);
        return Math.max(-1, Math.min(1, angle / (Math.PI / 2)));
    }

    _createChildren(seeds, octaveWeights) {
        this.masterGain = this.context.createGain();
        this.masterGain.gain.setValueAtTime(0, this.context.currentTime);

        const pitches = defaultPitchesForBells(seeds.length);

        this.panNodes = [];
        this.tubes = seeds.map((seed, i) => {
            const tube = new ChimeTube(this.context, `${this.name}-tube-${i + 1}`, {
                seed,
                octaveWeights // undefined -> ChimeTube's own default
            });
            tube.setParameter('gain', this.childGain);

            const panNode = new StereoPannerNode(this.context, { pan: this._panForBell(i) });
            tube.connect(panNode);
            panNode.connect(this.masterGain);
            this.panNodes.push(panNode);

            const paramName = `pitch_${i + 1}`;
            const defaultPitch = pitches[i];
            this.addParameter(paramName, defaultPitch, 54, 90, 0, 0);
            tube.setParameter('pitch', defaultPitch);

            return tube;
        });

        this.outputNode = this.masterGain;
        this.gainNode = this.masterGain;
    }

    startSound() {
        const strength = this.getParameter('strength').get();
        for (const tube of this.tubes) {
            tube.setParameter('strength', strength);
            tube.play();
        }
        this.startTime = this.context.currentTime;
        this.scheduleAttack(this.masterGain);
    }

    stopSound(onReleased) {
        const playing = this.tubes.filter((tube) => tube.isPlaying);
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
        for (const tube of playing) tube.stop(released);
    }

    updateParameter(name) {
        if (!this.tubes) return;

        if (name === 'strength') {
            const strength = this.getParameter('strength').get();
            for (const tube of this.tubes) tube.setParameter('strength', strength);
            return;
        }

        if (name.startsWith('pitch_')) {
            const index = Number(name.slice('pitch_'.length)) - 1;
            this.tubes[index]?.setParameter('pitch', this.getParameter(name).get());
            return;
        }

        if (name !== 'gain') return;
        const gain = this.getParameter('gain');
        if (this.inDecaySegment) return;
        if (this.inAttackSegment) {
            this.updateGainDuringAttack(this.masterGain, gain.get(), this.startTime, gain.attackTime);
        } else {
            this.masterGain.gain.setTargetAtTime(gain.get(), this.context.currentTime, 0.05);
        }
    }

    destroy() {
        this.tubes?.forEach((tube) => tube.destroy());
        this.panNodes?.forEach((panNode) => panNode.disconnect());
        super.destroy();
    }
}

export default WindChimes;
