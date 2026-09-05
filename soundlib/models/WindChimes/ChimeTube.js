import { BaseSoundWithEvents } from '../../BaseSoundWithEvents.js';
import { ChimeStrike } from './_ChimeStrike.js';

const DEFAULT_OCTAVE_WEIGHTS = [0.6, 0.25, 0.15];
const RUNNING_MAX_TAU = 5; // seconds -- exponential decay for the adaptive slope normalizer
const RUNNING_MAX_FLOOR = 0.05; // avoids a spuriously maxed-out first crossing after Play
const OUTPUT_LEVEL_MULTIPLIER = 1.5; // fixed makeup gain -- a single tube read as too soft otherwise
const RANDOM_START_RANGE = 1000; // noise-coordinate units; same scale as SimplexNoise.deriveFixedY's offset

// One wind-chime tube, struck whenever a NoiseControlProcessor worklet
// (soundlib/worklets/noiseControlProcessor.js) detects a zero-crossing in
// its own seeded simplex-noise stream. Ported from the per-tube independent
// simplex-noise strike scheduling in the Python original
// (scratch/DS_WindChimes_1.1/WindChimes.py) -- that model struck 5 of these
// tubes, each with its own seed; WindChimes.js builds an ensemble of them.
// Publicly exported and independently playable: unlike TransitionPinger
// (which needs a pool of Ping instances because a single Ping can't safely
// self-retrigger mid-ring), ChimeStrike.play() force-retriggers
// unconditionally, so this owns exactly one ChimeStrike, no pool.
export class ChimeTube extends BaseSoundWithEvents {
    static WORKLET_PATH = new URL('../../worklets/noiseControlProcessor.js', import.meta.url).href;

    constructor(context, name, options = {}) {
        super(context, name);

        this.docstringPub = 'One wind-chime tube, struck by a seeded simplex-noise process ' +
            '(NoiseControlProcessor worklet) whenever its noise crosses zero. strength drives ' +
            'both strike density and strike intensity, matching the Python original\'s single ' +
            '"strength" control.';

        this.seed = options.seed ?? 1;
        this.minimumEventIntervalSeconds = options.minimumEventIntervalSeconds ?? 0.2;
        this.octaveWeights = options.octaveWeights ?? DEFAULT_OCTAVE_WEIGHTS;

        this.addParameter('pitch', 60, 54, 90, 0, 0);
        this.addParameter('strength', 0.5, 0, 1, 0, 0);

        this.acceptingNoiseEvents = false;
        this.runningMaxSlope = RUNNING_MAX_FLOOR;
        this.lastCrossingTime = undefined;

        this.createNodes();
    }

    createNodes() {
        this.workletNode = new AudioWorkletNode(this.context, 'noise-control-processor', {
            processorOptions: {
                sampleRate: this.context.sampleRate,
                seed: this.seed,
                octaveWeights: this.octaveWeights,
                direction: 'both',
                minimumEventInterval: this.minimumEventIntervalSeconds
            }
        });

        this.chimeStrike = new ChimeStrike(this.context, `${this.name}-strike`);

        this.masterGain = this.context.createGain();
        this.masterGain.gain.setValueAtTime(0, this.context.currentTime);

        this.keepAliveGain = this.context.createGain();
        this.keepAliveGain.gain.setValueAtTime(0, this.context.currentTime);

        // The processor emits silence -- this connection keeps it in the
        // actively rendered graph, same pattern as _TransitionPinger.js.
        this.workletNode.connect(this.keepAliveGain);
        this.keepAliveGain.connect(this.masterGain);

        this.chimeStrike.connect(this.masterGain);

        this.workletNode.port.onmessage = ({ data }) => {
            if (data?.type === 'threshold-crossing') this._handleThresholdCrossing(data);
        };

        // Fixed makeup gain downstream of the envelope-controlled masterGain --
        // scales final level without affecting attack/decay timing.
        this.outputGain = this.context.createGain();
        this.outputGain.gain.setValueAtTime(OUTPUT_LEVEL_MULTIPLIER, this.context.currentTime);
        this.masterGain.connect(this.outputGain);

        this.outputNode = this.outputGain;
        this.gainNode = this.masterGain;
    }

    _setWorkletRate() {
        const strength = this.getParameter('strength').get();
        const rate = 0.1 + 0.9 * strength; // matches the Python original's eventrate formula
        this.workletNode.parameters.get('rate').setValueAtTime(rate, this.context.currentTime);
    }

    _handleThresholdCrossing(msg) {
        if (!this.acceptingNoiseEvents) return;

        const slope = Math.abs(msg.currentValue - msg.previousValue);
        const crossingTime = msg.audioTime;
        const elapsed = this.lastCrossingTime === undefined ? 0 : Math.max(0, crossingTime - this.lastCrossingTime);
        const decay = Math.exp(-elapsed / RUNNING_MAX_TAU);
        const normalized = Math.max(0, Math.min(1, slope / this.runningMaxSlope));
        this.runningMaxSlope = Math.max(slope, this.runningMaxSlope * decay);
        this.lastCrossingTime = crossingTime;

        const strength = this.getParameter('strength').get();
        const amp = 0.1 + 0.4 * strength * normalized ** 2; // matches the Python original's floor/coefficient/^2

        this.chimeStrike.setParameter('strikeStrength', amp);
        this.chimeStrike.play();
    }

    startSound() {
        this.acceptingNoiseEvents = true;
        this.runningMaxSlope = RUNNING_MAX_FLOOR;
        this.lastCrossingTime = undefined;

        // A fixed initialCoordinate (e.g. 0) makes every Play deterministically
        // restart every tube's noise field from the same relative starting
        // point -- for this project's seeds, that happened to put several
        // tubes' early crossings close together every single time. A fresh
        // random start decorrelates both the tubes from each other and one
        // Play from the next.
        this.workletNode.port.postMessage({
            type: 'reset',
            initialCoordinate: Math.random() * RANDOM_START_RANGE
        });
        this.workletNode.port.postMessage({
            type: 'set-minimum-event-interval',
            seconds: this.minimumEventIntervalSeconds
        });
        this.workletNode.port.postMessage({ type: 'set-direction', direction: 'both' });
        this.workletNode.port.postMessage({ type: 'set-enabled', enabled: true });
        this._setWorkletRate();

        this.startTime = this.context.currentTime;
        this.scheduleAttack(this.masterGain);
    }

    stopSound(onReleased) {
        this.workletNode.port.postMessage({ type: 'set-enabled', enabled: false });
        this.acceptingNoiseEvents = false;
        this.inAttackSegment = false;
        this.inDecaySegment = true;

        const finish = () => {
            const now = this.context.currentTime;
            this.masterGain.gain.cancelScheduledValues(now);
            this.masterGain.gain.setValueAtTime(0, now);
            this.inDecaySegment = false;
            onReleased?.();
        };

        if (this.chimeStrike.isPlaying) {
            this.chimeStrike.stop(finish);
        } else {
            finish();
        }
    }

    updateParameter(name) {
        if (name === 'pitch') {
            this.chimeStrike.setParameter('pitch', this.getParameter('pitch').get());
            return;
        }
        if (name === 'strength') {
            if (this.workletNode) this._setWorkletRate();
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
        this.chimeStrike?.destroy();
        this.workletNode?.disconnect();
        this.keepAliveGain?.disconnect();
        super.destroy();
    }
}

export default ChimeTube;
