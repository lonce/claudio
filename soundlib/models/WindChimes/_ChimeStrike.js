import { BaseSoundWithEvents } from '../../BaseSoundWithEvents.js';
import { ratiosForPitch } from './_partialRatioTable.js';

// Ported from a Python sound-design project (scratch/DS_WindChimes_1.1/,
// WindChimes.py + TokMultiGrain_l0.py): a single wind-chime tube strike.
// The original ensemble struck 5 tubes independently via simplex-noise
// timing; that scheduling layer is intentionally NOT ported here -- this
// model is just one tube's strike, triggered by play(). Build a multi-tube
// chime by instantiating this model multiple times with different pitches.
//
// A tube is 5 non-harmonic sine partials (real struck-bar bending-mode
// ratios, not integer harmonics), each with its own decay time and
// relative amplitude. Every one of the original's 5 measured tubes shared
// the exact same decay/amplitude "shape" (durArray/ampArray) -- those stay
// fixed constants below -- but each tube's own partial *ratios* drift
// smoothly with fundamental frequency (real measured variance, not one
// shape mathematically transposed). ratiosForPitch() (from
// _partialRatioTable.js) interpolates/extrapolates that measured drift as
// a function of pitch, recomputed fresh on every strike from whatever
// pitch is in effect -- so both a WindChimes ensemble bell and a
// standalone ChimeStrike at an arbitrary pitch get a physically-informed
// ratio shape, not one fixed borrowed shape.
const PARTIAL_DURS = [25, 7, 2, 1, 0.5];      // seconds; per-partial decay time
const PARTIAL_AMPS = [0.0787, 0.1849, 1.0, 0.0136, 0.0275]; // fixed relative partial amplitudes
const ATTACK_S = 0.025;  // per-partial linear attack, from the original's expWindow call
const TSCALE = 8;        // per-partial exponential decay steepness, ditto

export class ChimeStrike extends BaseSoundWithEvents {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = 'One wind-chime tube, struck. Ported from a Python wind-chime ' +
            'sound design (5 non-harmonic, independently-decaying sine partials per strike). ' +
            'pitch, strikeStrength, and ampVariation are stored destinations picked up fresh ' +
            'on the next Play -- changing them mid-ring does not affect the current strike.';

        this.addParameter('pitch', 60, 54, 90, 0, 0);
        this.addParameter('strikeStrength', 0.6, 0, 1, 0, 0);
        this.addParameter('ampVariation', 0.45, 0, 1, 0, 0);

        // Fixed strike envelope on the shared gain: near-instant attack (the
        // strike's own character already comes from each partial's 25ms
        // attack) and a fixed .2s fade on stop, cutting the (up to 25s)
        // natural decay short on demand.
        const gainParam = this.getParameter('gain');
        gainParam.attackTime = 0.005;
        gainParam.decayTime = 0.2;

        this.partials = []; // [{ osc, gain }, ...], created fresh per strike

        this.createNodes();
    }

    createNodes() {
        this.gainNode = this.context.createGain();
        this.outputNode = this.gainNode;
    }

    // Override of BaseSound.play(): a chime strike is a percussive one-shot,
    // not a sustained tone, so Play should always retrigger a fresh attack
    // from 0 -- even mid-ring, and without requiring Stop first -- unlike
    // BaseSound's default, which no-ops if already playing and not decaying.
    // startSound() already disconnects the previous strike's partials and
    // calls scheduleAttack() (which resets the gain to 0, ramps up, and
    // cancels any pending decay-completion), so an unconditional call here
    // is enough to restart cleanly from any prior state.
    play() {
        this.isPlaying = true;
        this.startSound();
    }

    startSound() {
        // Oscillators can't be restarted -- disconnect any still-ringing
        // strike's nodes before creating a fresh set.
        this.partials.forEach(({ osc, gain }) => {
            osc.disconnect();
            gain.disconnect();
        });
        this.partials = [];

        const now = this.context.currentTime;
        const pitch = this.getParameter('pitch').get();
        const fundamentalHz = 440 * Math.pow(2, (pitch - 69) / 12);
        const partialRatios = ratiosForPitch(pitch);
        const strikeStrength = this.getParameter('strikeStrength').get();
        const ampVariation = this.getParameter('ampVariation').get();

        for (let i = 0; i < partialRatios.length; i++) {
            // Average two draws (triangular distribution) instead of one
            // (uniform) so most strikes land near nominal amplitude and only
            // occasionally swing toward the extremes.
            const jitter = 1 + ampVariation * (Math.random() + Math.random() - 1);
            const peakGain = strikeStrength * PARTIAL_AMPS[i] * jitter;
            const dur = PARTIAL_DURS[i];

            const osc = this.context.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(fundamentalHz * partialRatios[i], now);

            const partialGain = this.context.createGain();
            partialGain.gain.setValueAtTime(0, now);
            partialGain.gain.linearRampToValueAtTime(peakGain, now + ATTACK_S);
            partialGain.gain.setTargetAtTime(0, now + ATTACK_S, dur / TSCALE);

            osc.connect(partialGain);
            partialGain.connect(this.gainNode);

            osc.start();
            osc.stop(now + dur + 0.5); // natural cleanup once this partial has fully decayed

            this.partials.push({ osc, gain: partialGain });
        }

        this.scheduleAttack(this.gainNode);
        this.startTime = now;
    }

    stopSound(onReleased) {
        this.scheduleDecay(this.gainNode, () => {
            this.partials.forEach(({ osc, gain }) => {
                osc.stop();
                osc.disconnect();
                gain.disconnect();
            });
            this.partials = [];

            if (typeof onReleased === 'function') {
                onReleased();
            }
        });
    }

    updateParameter(name) {
        // pitch, strikeStrength, and ampVariation are stored destinations --
        // like RendezvousPingerII's freq/phase, they only take effect the
        // next time a strike is triggered via play(), not on the one
        // currently ringing.
        if (name !== 'gain') return;

        const param = this.getParameter('gain');
        const now = this.context.currentTime;
        if (this.inDecaySegment) {
            return;
        }
        if (this.inAttackSegment) {
            this.updateGainDuringAttack(this.gainNode, param.get(), this.startTime, param.attackTime);
        } else {
            this.gainNode.gain.setTargetAtTime(param.get(), now, 0.05);
        }
    }

    destroy() {
        super.destroy();
        this.partials.forEach(({ osc, gain }) => {
            osc.stop();
            osc.disconnect();
            gain.disconnect();
        });
        this.partials = [];
        this.gainNode.disconnect();
    }
}

export default ChimeStrike;
