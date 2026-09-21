import { BaseSoundWithEvents } from '../BaseSoundWithEvents.js';
import { bandwidthFromDecay } from '../utilities/decayMath.js';
import { GrannyInteractive } from './GrannyInteractive.js';
import { CHIME_VOCODER_CONFIG, BAMBOO_CHIME_CONFIG } from './ChimeVocoder/chimeVocoderConfig.js';

// GrannyInteractive's own parameter -> the name ChimeVocoder forwards it
// under. The `carrier*` prefix is required, not just stylistic: Granny's
// own `gain` (the raw carrier level feeding the filterbank) would
// otherwise collide with ChimeVocoder's own inherited `gain` (the final
// post-filterbank output level) -- every SoundModel has a `gain`
// Parameter from BaseSound, and these are two genuinely different
// controls that happen to share that name only by inheritance.
const CARRIER_PARAM_FORWARDING = {
    carrierGain: 'gain',
    carrierPitch: 'pitch',
    carrierRandomizePitch: 'randomizePitch',
    carrierGrainSize: 'grainSize',
    carrierStepSize: 'stepSize',
    carrierGrainPlayInterval: 'grainPlayInterval',
    carrierFileLoopStart: 'fileLoopStart',
    carrierFileLoopLength: 'fileLoopLength',
    carrierAudioSource: 'fileURL_or_Freesound_soundID'
};

const CHIME_PARAM_NAMES = [
    'shakeEnergy', 'systemDecay', 'collisionDensity', 'resonanceBandwidth',
    'frequencyScale', 'collisionDecaySeconds', 'collisionRateScale'
];

/**
 * Cross-synthesis / vocoder: a hidden BambooChimes-style PhISEM engine
 * (never itself audible) drives 7 envelope-followed control signals from
 * its own per-tube resonator state, which shape the amplitude of a real
 * external carrier -- an internally-owned GrannyInteractive instance's
 * granular output, split into the same 7 tuned bands. The carrier ends up
 * with a spectral shape that dances around exactly the way the hidden
 * chimes' random collisions happen to be exciting each tube. See
 * docs/MODEL_PATTERNS.md's cross-synthesis/vocoder archetype and
 * soundlib/models/ChimeVocoder/chimeVocoderProcessor.js.
 *
 * Owns GrannyInteractive as a genuine child SoundModel (constructed
 * directly, never through audioSystem.createSound()) -- same meta-model
 * composition shape as WindChimes/RendezvousPingerII (archetype 3), but
 * the child here is never itself audible: its output is routed straight
 * into this model's own worklet as an audio-rate carrier input, not
 * summed into any parent gain node.
 *
 * Exposes a full union of both halves' parameters (this model's own 7
 * chime/filter parameters plus all 8 of GrannyInteractive's own,
 * forwarded under carrier*-prefixed names) so both the carrier's own
 * texture and the chime engine driving its spectral shape are playable
 * together.
 *
 * play() starts silent (zero stored chime energy) rather than
 * auto-striking -- call strike() to actually hear the chime engine begin
 * shaping the (already-playing) carrier, same as BambooChimes.
 */
export class ChimeVocoder extends BaseSoundWithEvents {
    static WORKLET_PATH = new URL('./ChimeVocoder/chimeVocoderProcessor.js', import.meta.url).href;

    constructor(context, name, options = {}) {
        super(context, name, options.gain ?? 0.6);

        this.seed = options.seed ?? 1;
        const audioFileURL = options.audioFileURL ?? 'BeingRural22k.mp3';

        // Chime/filter-engine parameters -- same names/defaults/ranges as
        // BambooChimes.js, verbatim.
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
        this.addParameter(
            'envelopeSmoothing',
            CHIME_VOCODER_CONFIG.envelopeSmoothingDefault,
            CHIME_VOCODER_CONFIG.envelopeSmoothingMin,
            CHIME_VOCODER_CONFIG.envelopeSmoothingMax,
            0, 0
        );

        // Carrier (GrannyInteractive) parameters, forwarded under
        // carrier*-prefixed names -- defaults/ranges/preferences copied
        // from GrannyInteractive.js's own current overrides, not
        // AnotherGranny's raw ones.
        this.addParameter('carrierGain', 0.8, 0, 1, 0, 0);
        this.addParameter('carrierPitch', 0, -2.0, 2.0, 0, 0, 'x');
        this.addParameter('carrierRandomizePitch', 0, 0, 1, 0, 0, 'y');
        // carrierGrainSize's default (0.9) is outside its own [0.010, 0.5]
        // range -- a pre-existing data inconsistency already flagged in
        // GrannyInteractive.js's own comment, inherited here as-is, not
        // fixed.
        this.addParameter('carrierGrainSize', 0.9, 0.010, 0.5, 0, 0);
        this.addParameter('carrierStepSize', 0.25, 0, 2, 0, 0, 'pitch');
        this.addParameter('carrierGrainPlayInterval', 0.25, 0.05, 1, 0, 0, 'roll');
        this.addParameter('carrierFileLoopStart', 0, 0, 1, 0, 0);
        this.addParameter('carrierFileLoopLength', 1, 0, 1, 0, 0);
        this.addStringParameter('carrierAudioSource', audioFileURL);

        this.addEvent(
            'strike',
            (data) => this._submitStrike(data?.amount ?? 1),
            'Inject a discrete energy impulse into the hidden chime engine (one tube clack).'
        );

        this.docstringPub = 'Chimes shape the sound of the granular carrier!';

        // Child SoundModel, constructed directly (never through
        // audioSystem.createSound()) -- so it's never auto-connected to
        // master gain and never appears independently in the app's sound
        // selector, per the established meta-model composition pattern.
        this.granny = new GrannyInteractive(context, `${name} (carrier)`, audioFileURL);

        this.acceptingStrikes = false;
        this.createNodes();
    }

    play() {
        if (this.isPlaying && this.inDecaySegment) {
            // Same reasoning as BambooChimes.js's play() override.
            this.acceptingStrikes = true;
        }
        super.play();
    }

    createNodes() {
        this.workletNode = new AudioWorkletNode(this.context, 'chimeVocoderProcessor', {
            channelCount: 1,
            channelCountMode: 'explicit',
            processorOptions: {
                sampleRate: this.context.sampleRate,
                seed: this.seed
            }
        });

        // The carrier's output is never itself audible -- it only feeds
        // this worklet's inputs[0] as a control-rate-shaped carrier
        // source. BaseSound.connect() accepts any AudioNode, not just a
        // master gain.
        this.granny.connect(this.workletNode);

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

        this.workletNode.port.postMessage({ type: 'reset' });

        this.acceptingStrikes = true;
        this.workletNode.parameters.get('active').setValueAtTime(1, now);
        this.granny.play();
        this.scheduleAttack(this.gainNode);
        this.startTime = now;

        [...CHIME_PARAM_NAMES, 'envelopeSmoothing', ...Object.keys(CARRIER_PARAM_FORWARDING)]
            .forEach((name) => this.updateParameter(name));
    }

    stopSound(onReleased) {
        this.acceptingStrikes = false;
        // Deliberately not gating on Granny's own release, unlike
        // archetype 3's usual "wait for every child" rule -- Granny's raw
        // output is never itself audible here (only this.gainNode's own
        // envelope is heard), so nothing requires waiting on it. Also
        // sidesteps a pre-existing quirk in AnotherGranny.stopSound(),
        // which invokes its callback twice; calling stop() with no
        // callback avoids depending on that.
        this.granny.stop();
        this.scheduleDecay(this.gainNode, () => {
            this.workletNode.parameters.get('active').setValueAtTime(0, this.context.currentTime);
            if (typeof onReleased === 'function') onReleased();
        });
    }

    updateParameter(name) {
        const forwardedName = CARRIER_PARAM_FORWARDING[name];
        if (forwardedName) {
            this.granny.setParameter(forwardedName, this.getParameter(name).get());
            return;
        }

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
            case 'envelopeSmoothing':
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

    destroy() {
        super.destroy();
        this.granny?.destroy?.();
        this.workletNode?.disconnect();
        this.gainNode?.disconnect();
    }
}

export default ChimeVocoder;
