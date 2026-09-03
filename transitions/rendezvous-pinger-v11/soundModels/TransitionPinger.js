import { BaseSoundWithEvents } from '../BaseSoundWithEvents.js';
import { Ping } from './Ping.js';

export const CHORD_INTERVALS = Object.freeze([
    Object.freeze([0, 4, 7]), // major
    Object.freeze([0, 3, 7]), // minor
    Object.freeze([0, 5, 7]), // suspended fourth
    Object.freeze([0, 3, 6])  // diminished
]);

export const CHORD_NAMES = Object.freeze([
    'major',
    'minor',
    'suspended fourth',
    'diminished'
]);

export function frequenciesForChord(rootFrequency, chordIndex) {
    const index = Math.min(
        CHORD_INTERVALS.length - 1,
        Math.max(0, Math.round(chordIndex))
    );
    return CHORD_INTERVALS[index].map(
        (semitones) => rootFrequency * 2 ** (semitones / 12)
    );
}

/** Apply one small random tuning offset to a complete chord. */
export function jitterFrequencies(
    frequencies,
    maximumFraction = 0.005,
    random = Math.random
) {
    const factor = 1 + (random() * 2 - 1) * maximumFraction;
    return frequencies.map((frequency) => frequency * factor);
}

/**
 * A timing-worklet SoundModel that renders each phase occurrence by asking an
 * ordinary main-thread Ping SoundModel to play.
 *
 * The worklet clock does not drift, but message delivery and Ping.play() are
 * intentionally unscheduled and therefore reveal cross-model timing jitter.
 */
export class TransitionPinger extends BaseSoundWithEvents {
    static WORKLET_PATH = new URL(
        '../worklets/transitionNotifierProcessor.js',
        import.meta.url
    ).href;

    constructor(context, name, options = {}) {
        super(context, name);

        this.poolSize = options.poolSize ?? 8;
        this.rootFrequency = options.rootFrequency ?? 220;
        this.pingGateSeconds = options.pingGateSeconds ?? 0.08;
        this.pingDecaySeconds = options.pingDecaySeconds ?? 0.25;
        this.frequencyJitter = options.frequencyJitter ?? 0.005;
        this.processorOptions = options.processorOptions ?? {};

        this.addParameter('freq', 2, 0, 20);
        this.addParameter('phase', 0, 0, 1);
        this.addParameter('transition_dur', 1, 0, 60);
        this.addParameter('chord', 0, 0, CHORD_INTERVALS.length - 1);

        this.addEvent(
            'transition',
            () => this._submitTransition(),
            'Move the notification phasor to the staged frequency and phase.'
        );

        this.pingPool = [];
        this.receivedEventCount = 0;
        this.droppedEventCount = 0;
        this.lastTiming = null;
        this.acceptingPhaseEvents = false;
        this.createNodes();
    }

    createNodes() {
        this.workletNode = new AudioWorkletNode(
            this.context,
            'transitionNotifierProcessor',
            {
                processorOptions: {
                    sampleRate: this.context.sampleRate,
                    ...this.processorOptions
                }
            }
        );

        this.masterGain = this.context.createGain();
        this.keepAliveGain = this.context.createGain();
        this.keepAliveGain.gain.setValueAtTime(0, this.context.currentTime);
        this.masterGain.gain.setValueAtTime(0, this.context.currentTime);

        // The processor emits silence, but this connection keeps it in the
        // actively rendered graph.
        this.workletNode.connect(this.keepAliveGain);
        this.keepAliveGain.connect(this.masterGain);

        for (let index = 0; index < this.poolSize; index++) {
            const ping = new Ping(this.context, `${this.name}-ping-${index}`);
            ping.setParameter('decayTime', this.pingDecaySeconds);
            ping.connect(this.masterGain);
            this.pingPool.push({
                ping,
                busy: false,
                stopTimer: null,
                releaseWaiters: []
            });
        }

        this.workletNode.port.onmessage = ({ data }) => {
            if (data?.type === 'phase-event') this._handlePhaseEvent(data);
        };

        this.outputNode = this.masterGain;
        this.workletNode.parameters
            .get('active')
            .setValueAtTime(0, this.context.currentTime);
    }

    _handlePhaseEvent(timing) {
        // Capture the estimate at message receipt. Recomputing it later would
        // measure the growing age of this event, not notification latency.
        const receivedAudioFrameEstimate =
            this.context.currentTime * this.context.sampleRate;
        const notificationDelayMs = Math.max(
            0,
            (receivedAudioFrameEstimate - timing.audioFrame)
                / this.context.sampleRate * 1000
        );

        this.receivedEventCount++;
        this.lastTiming = {
            ...timing,
            receivedAudioFrameEstimate,
            notificationDelayMs
        };
        if (!this.acceptingPhaseEvents) return;

        const slot = this.pingPool.find((candidate) => !candidate.busy);
        if (!slot) {
            this.droppedEventCount++;
            return;
        }

        slot.busy = true;
        this._configurePing(slot.ping);
        slot.ping.play();

        // stop() begins the child's release. The slot remains busy until Ping
        // invokes the completion callback after its oscillators are stopped.
        slot.stopTimer = setTimeout(() => {
            slot.stopTimer = null;
            this._stopPingSlot(slot);
        }, this.pingGateSeconds * 1000);
    }

    _stopPingSlot(slot) {
        if (!slot.busy) return;
        clearTimeout(slot.stopTimer);
        slot.stopTimer = null;

        // A completed child has already been freed by its original callback.
        if (!slot.ping.isPlaying) return;
        slot.ping.stop(() => this._markPingSlotFree(slot));
    }

    _markPingSlotFree(slot) {
        slot.busy = false;
        const waiters = slot.releaseWaiters.splice(0);
        for (const waiter of waiters) waiter();
    }

    _configurePing(ping) {
        // One shared factor preserves the chord's interval ratios while making
        // overlapping Ping instances slightly detuned from one another.
        const frequencies = jitterFrequencies(
            frequenciesForChord(
                this.rootFrequency,
                this.getParameter('chord').get()
            ),
            this.frequencyJitter
        );
        frequencies.forEach((frequency, index) => {
            ping.setParameter(`frequency${index + 1}`, frequency);
        });
    }

    _submitTransition() {
        this.workletNode.port.postMessage({
            type: 'event',
            name: 'transition',
            targetRate: this.getParameter('freq').get(),
            targetPhase: this.getParameter('phase').get(),
            durationSeconds: this.getParameter('transition_dur').get()
        });
    }

    startSound() {
        const now = this.context.currentTime;
        this.acceptingPhaseEvents = true;
        this.workletNode.parameters.get('active').setValueAtTime(1, now);
        this.scheduleAttack(this.masterGain);
        this.startTime = now;
    }

    stopSound(onReleased) {
        // Enter a meta-release state: freeze the phasor and reject in-flight
        // notifications, but leave every child and the master gain untouched.
        // Existing gate timers will request each Ping's normal decay.
        this.workletNode.parameters
            .get('active')
            .setValueAtTime(0, this.context.currentTime);
        this.acceptingPhaseEvents = false;

        const busySlots = this.pingPool.filter((slot) => slot.busy);
        let childrenRemaining = busySlots.length;
        this.inAttackSegment = false;
        this.inDecaySegment = true;

        const completeParentRelease = () => {
            if (childrenRemaining !== 0) return;

            // No child is producing audio now, so resetting the parent gain is
            // silent. The next play() will establish a fresh attack ramp.
            const now = this.context.currentTime;
            this.masterGain.gain.cancelScheduledValues(now);
            this.masterGain.gain.setValueAtTime(0, now);
            this.inDecaySegment = false;
            onReleased?.();
        };

        for (const slot of busySlots) {
            slot.releaseWaiters.push(() => {
                childrenRemaining--;
                completeParentRelease();
            });
        }
        completeParentRelease();
    }

    updateParameter(name) {
        if (name === 'freq' || name === 'phase') {
            if (this.getParameter('transition_dur').get() === 0) {
                this.workletNode?.port.postMessage({
                    type: 'parameter',
                    name,
                    value: this.getParameter(name).get()
                });
            }
            return;
        }

        if (name !== 'gain' || !this.masterGain) return;
        const gain = this.getParameter('gain');
        if (this.inDecaySegment) return;
        if (this.inAttackSegment) {
            this.updateGainDuringAttack(
                this.masterGain,
                gain.get(),
                this.startTime,
                gain.attackTime
            );
        } else {
            this.masterGain.gain.setTargetAtTime(
                gain.get(),
                this.context.currentTime,
                0.05
            );
        }
    }

    getTimingStats() {
        return {
            received: this.receivedEventCount,
            dropped: this.droppedEventCount,
            lastTiming: this.lastTiming
        };
    }

    destroy() {
        for (const slot of this.pingPool) {
            clearTimeout(slot.stopTimer);
            slot.ping.destroy();
        }
        this.workletNode?.disconnect();
        this.keepAliveGain?.disconnect();
        super.destroy();
    }
}

export default TransitionPinger;
