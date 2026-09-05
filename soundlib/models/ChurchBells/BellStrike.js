import { BaseSoundWithEvents } from '../../BaseSoundWithEvents.js';

// A single struck church bell. Physically-informed modal synthesis (a bank
// of damped oscillators, same overall technique as
// soundlib/models/WindChimes/_ChimeStrike.js) grounded in real bell-acoustics
// literature (Arthur Lehr's "true-tuning" scheme; Rossing & Perrin-adjacent
// measured data) rather than solving the actual shell equations -- a bell
// behaves close enough to linear, for a normal strike, that its measured/
// targeted modal frequencies are a very good stand-in for simulating the
// physics directly.
//
// 7 named partials, in the classic true-tuning ratios to Prime: Hum 0.5,
// Prime 1.0, Tierce 1.2 (a pure minor third, 6:5 -- not equal-tempered;
// this is what gives a bell its characteristic bittersweet quality), Quint
// 1.5, Nominal 2.0 (an octave above Prime), Superquint 3.0, Octave Nominal
// 4.0. Unlike the wind-chime tubes, these ratios are essentially
// size-invariant in real bell-founding practice -- true-tuning's whole
// point is a consistent interval scheme across a whole bell set's size
// range -- so there is no pitch-dependent ratio function here, just one
// fixed table.
//
// pitch is the Prime frequency, which is also the perceived "strike tone"
// (the pitch you actually hear) -- confirmed directly in the sourced
// literature. Real bells are conventionally catalogued by their Nominal
// partial instead, which sits exactly one octave above Prime -- so to
// match a real bell's published note, set pitch to (that note - 12
// semitones).
//
// Two things a beam-mode chime doesn't need, both real documented bell
// phenomena: each partial is rendered as a pair of very slightly detuned
// oscillators (a "doublet") rather than one, producing the characteristic
// slow beating/warble of a real bell's imperfectly-axisymmetric casting;
// and a short filtered-noise strike transient (Perry Cook-style: noise
// through a BiquadFilterNode with a fast envelope) supplies the sharp
// broadband "clang" a handful of sine partials can't produce on their own.
const PARTIAL_RATIOS = [0.5, 1.0, 1.2, 1.5, 2.0, 3.0, 4.0];
//                       Hum  Prime Tierce Quint Nominal Superquint OctNom

// Amplitude and decay-time constants below are an informed construction
// from qualitative descriptions in the sourced literature (tierce is
// "often the highest amplitude partial"; quint is "typically very quiet",
// a node sits near the strike point; higher partials decay faster than
// Hum/Prime/Tierce) -- not measured data, unlike the ratios above.
const PARTIAL_AMPS = [0.7, 0.9, 1.0, 0.3, 0.9, 0.25, 0.15];
const PARTIAL_DURS = [45, 35, 30, 20, 15, 6, 3]; // seconds; per-partial decay time
const ATTACK_S = 0.025;  // per-partial linear attack, same shape as ChimeStrike's
const TSCALE = 8;        // per-partial exponential decay steepness, ditto

// No reliable general "typical doublet splitting is X Hz/%" figure exists
// in the sourced literature -- the one real measured example found doesn't
// even order consistently by partial frequency. MIN/MAX_BEAT_HZ is a
// plausible range informed by that example, not a precise sourced value.
const MIN_BEAT_HZ = 0.3;
const MAX_BEAT_HZ = 3;

const NOISE_BUFFER_DURATION = 0.3;   // seconds; raw material for every strike's clang

// A single broad bandpass filter reads as a plain noise swell, not a
// clang -- real bells' onset transient comes from a dense cluster of high,
// closely-spaced modes the 7 named partials don't cover. A small bank of
// narrow, high-Q bandpass filters (each fed from the same noise burst)
// stands in for that cluster: several sharp, independently-decaying peaks
// read as "metallic" in a way one gentle hump doesn't. Center frequencies/
// Qs/decay times are drawn once per instance (this bell's own fixed clang
// "voice"), same treatment as the doublet beat offsets below.
const CLANG_FILTER_COUNT = 5;
const CLANG_MIN_MULTIPLIER = 4;   // clang band, relative to this strike's Prime
const CLANG_MAX_MULTIPLIER = 20;
const CLANG_MIN_Q = 8;
const CLANG_MAX_Q = 20;
const CLANG_ATTACK_S = 0.003;
const CLANG_MIN_DECAY_TIME_CONSTANT = 0.03;
const CLANG_MAX_DECAY_TIME_CONSTANT = 0.12;
const CLANG_STOP_AFTER_S = 0.5;      // generous headroom past the clang's own decay

export class BellStrike extends BaseSoundWithEvents {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = 'One big struck church bell. Physically-informed modal synthesis: ' +
            '7 named partials (Hum, Prime, Tierce, Quint, Nominal, Superquint, Octave Nominal) ' +
            'in classic true-tuning ratios to Prime, each a randomly-mistuned oscillator pair ' +
            'for the doublet/beating warble real bells have, plus a filtered-noise strike ' +
            'transient for the clang. pitch is the Prime frequency -- the perceived strike ' +
            'tone -- one octave below how real bells are conventionally catalogued (their ' +
            'Nominal). pitch, strikeStrength, ampVariation, beatingAmount, and clangAmount are ' +
            'stored destinations picked up fresh on the next Play.';

        this.addParameter('pitch', 48, 28, 72, 0, 0);
        this.addParameter('strikeStrength', 0.6, 0, 1, 0, 0);
        this.addParameter('ampVariation', 0.45, 0, 1, 0, 0);
        this.addParameter('beatingAmount', 0.6, 0, 1, 0, 0);
        this.addParameter('clangAmount', 0.5, 0, 1, 0, 0);

        // Fixed strike envelope on the shared gain: near-instant attack and
        // a longer fade on Stop than ChimeStrike's 0.2s -- these partials
        // can ring for the better part of a minute, so cutting them off
        // that abruptly would sound like a muffled thud rather than a
        // stopped bell.
        const gainParam = this.getParameter('gain');
        gainParam.attackTime = 0.005;
        gainParam.decayTime = 0.6;

        // Each partial's fixed doublet split (Hz), representing this
        // specific bell casting's own physical imperfection -- drawn once
        // here, at construction, not re-rolled per strike (a real bell
        // doesn't change its casting between strikes). beatingAmount (a
        // live parameter) scales how strongly this fixed pattern is
        // expressed on any given strike.
        this.beatOffsetsHz = PARTIAL_RATIOS.map(
            () => MIN_BEAT_HZ + Math.random() * (MAX_BEAT_HZ - MIN_BEAT_HZ)
        );

        // This bell's fixed clang filter bank -- see the constants above.
        this.clangFreqMultipliers = Array.from({ length: CLANG_FILTER_COUNT },
            () => CLANG_MIN_MULTIPLIER + Math.random() * (CLANG_MAX_MULTIPLIER - CLANG_MIN_MULTIPLIER));
        this.clangQs = Array.from({ length: CLANG_FILTER_COUNT },
            () => CLANG_MIN_Q + Math.random() * (CLANG_MAX_Q - CLANG_MIN_Q));
        this.clangDecayTimeConstants = Array.from({ length: CLANG_FILTER_COUNT },
            () => CLANG_MIN_DECAY_TIME_CONSTANT + Math.random() * (CLANG_MAX_DECAY_TIME_CONSTANT - CLANG_MIN_DECAY_TIME_CONSTANT));

        this.partials = []; // [{ osc1, osc2, oscGain1, oscGain2, gain }, ...], fresh per strike
        this.clang = null;  // { source, stages: [{ filter, gain }, ...] } for the current strike's noise burst, if any

        this.createNodes();
    }

    createNodes() {
        this.gainNode = this.context.createGain();
        this.outputNode = this.gainNode;
        this.noiseBuffer = this._createNoiseBuffer();
    }

    _createNoiseBuffer() {
        const length = Math.round(this.context.sampleRate * NOISE_BUFFER_DURATION);
        const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    // Override of BaseSound.play(): a bell strike is a percussive one-shot,
    // not a sustained tone, so Play should always retrigger a fresh attack
    // from 0 -- even mid-ring, and without requiring Stop first -- unlike
    // BaseSound's default, which no-ops if already playing and not decaying.
    // Same rationale and shape as ChimeStrike's own override.
    play() {
        this.isPlaying = true;
        this.startSound();
    }

    startSound() {
        // Oscillators/sources can't be restarted -- disconnect any
        // still-ringing strike's nodes before creating a fresh set.
        this.partials.forEach(({ osc1, osc2, oscGain1, oscGain2, gain }) => {
            osc1.disconnect();
            osc2.disconnect();
            oscGain1.disconnect();
            oscGain2.disconnect();
            gain.disconnect();
        });
        this.partials = [];
        this._disconnectClang();

        const now = this.context.currentTime;
        const pitch = this.getParameter('pitch').get();
        const fundamentalHz = 440 * Math.pow(2, (pitch - 69) / 12);
        const strikeStrength = this.getParameter('strikeStrength').get();
        const ampVariation = this.getParameter('ampVariation').get();
        const beatingAmount = this.getParameter('beatingAmount').get();
        const clangAmount = this.getParameter('clangAmount').get();

        for (let i = 0; i < PARTIAL_RATIOS.length; i++) {
            // Average two draws (triangular distribution) instead of one
            // (uniform) so most strikes land near nominal amplitude and only
            // occasionally swing toward the extremes -- same approach tuned
            // for ChimeStrike.
            const jitter = 1 + ampVariation * (Math.random() + Math.random() - 1);
            const peakGain = strikeStrength * PARTIAL_AMPS[i] * jitter;
            const dur = PARTIAL_DURS[i];
            const partialHz = fundamentalHz * PARTIAL_RATIOS[i];
            const beatHz = this.beatOffsetsHz[i] * beatingAmount;

            const osc1 = this.context.createOscillator();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(partialHz - beatHz / 2, now);

            const osc2 = this.context.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(partialHz + beatHz / 2, now);

            // Each doublet oscillator carries half the partial's peak, so
            // the pair sums to the same target peak the single-oscillator
            // chime model would use, before beating modulates it over time.
            const oscGain1 = this.context.createGain();
            oscGain1.gain.setValueAtTime(0.5, now);
            const oscGain2 = this.context.createGain();
            oscGain2.gain.setValueAtTime(0.5, now);

            const partialGain = this.context.createGain();
            partialGain.gain.setValueAtTime(0, now);
            partialGain.gain.linearRampToValueAtTime(peakGain, now + ATTACK_S);
            partialGain.gain.setTargetAtTime(0, now + ATTACK_S, dur / TSCALE);

            osc1.connect(oscGain1);
            osc2.connect(oscGain2);
            oscGain1.connect(partialGain);
            oscGain2.connect(partialGain);
            partialGain.connect(this.gainNode);

            // Both oscillators otherwise start at the same phase every time,
            // which makes the beat envelope begin at the same point in its
            // cycle on every strike -- always "in phase" at onset, always the
            // same temporal beating pattern. A random start-time offset for
            // osc2, within one period of the carrier itself, scrambles their
            // relative phase (and so the beat envelope's starting alignment)
            // fresh each strike -- imperceptible as a timing offset on its
            // own (a few ms at most), well inside the partial's own attack
            // ramp.
            const phaseOffsetS = Math.random() / partialHz;
            osc1.start(now);
            osc2.start(now + phaseOffsetS);
            osc1.stop(now + dur + 0.5); // natural cleanup once this partial has fully decayed
            osc2.stop(now + dur + 0.5);

            this.partials.push({ osc1, osc2, oscGain1, oscGain2, gain: partialGain });
        }

        this._startClang(now, fundamentalHz, strikeStrength, clangAmount);

        this.scheduleAttack(this.gainNode);
        this.startTime = now;
    }

    _startClang(now, fundamentalHz, strikeStrength, clangAmount) {
        const source = this.context.createBufferSource();
        source.buffer = this.noiseBuffer;

        // Summing CLANG_FILTER_COUNT roughly-independent resonances raises
        // total power with the count, not amplitude -- normalize by
        // sqrt(count) so the overall clang level stays comparable regardless
        // of how many peaks make it up.
        const peak = (strikeStrength * clangAmount) / Math.sqrt(CLANG_FILTER_COUNT);
        const stages = [];

        for (let i = 0; i < CLANG_FILTER_COUNT; i++) {
            const filter = this.context.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(fundamentalHz * this.clangFreqMultipliers[i], now);
            filter.Q.setValueAtTime(this.clangQs[i], now);

            const stageGain = this.context.createGain();
            stageGain.gain.setValueAtTime(0, now);
            stageGain.gain.linearRampToValueAtTime(peak, now + CLANG_ATTACK_S);
            stageGain.gain.setTargetAtTime(0, now + CLANG_ATTACK_S, this.clangDecayTimeConstants[i]);

            source.connect(filter);
            filter.connect(stageGain);
            stageGain.connect(this.gainNode);

            stages.push({ filter, gain: stageGain });
        }

        source.start(now);
        source.stop(now + CLANG_STOP_AFTER_S); // natural cleanup once the burst has fully decayed

        this.clang = { source, stages };
    }

    _disconnectClang() {
        if (!this.clang) return;
        this.clang.source.disconnect();
        this.clang.stages.forEach(({ filter, gain }) => {
            filter.disconnect();
            gain.disconnect();
        });
        this.clang = null;
    }

    stopSound(onReleased) {
        this.scheduleDecay(this.gainNode, () => {
            this._stopAllVoices();
            if (typeof onReleased === 'function') {
                onReleased();
            }
        });
    }

    // Stop() (not just disconnect()) every live oscillator/source, for a
    // definitive, immediate silence -- used by stopSound()'s decay
    // completion and by destroy(). startSound()'s own re-trigger path
    // only disconnects (see above): a still-ringing strike being replaced
    // by a fresh one doesn't need its old oscillators explicitly stopped,
    // since they're already scheduled to stop naturally.
    _stopAllVoices() {
        this.partials.forEach(({ osc1, osc2, oscGain1, oscGain2, gain }) => {
            osc1.stop();
            osc2.stop();
            osc1.disconnect();
            osc2.disconnect();
            oscGain1.disconnect();
            oscGain2.disconnect();
            gain.disconnect();
        });
        this.partials = [];

        if (this.clang) {
            this.clang.source.stop();
            this.clang.source.disconnect();
            this.clang.stages.forEach(({ filter, gain }) => {
                filter.disconnect();
                gain.disconnect();
            });
            this.clang = null;
        }
    }

    updateParameter(name) {
        // pitch, strikeStrength, ampVariation, beatingAmount, and
        // clangAmount are stored destinations -- like ChimeStrike's own
        // pitch/strikeStrength/ampVariation, they only take effect the
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
        this._stopAllVoices();
        this.gainNode.disconnect();
    }
}

export default BellStrike;
