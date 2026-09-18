import { BaseSoundWithEvents } from '../../BaseSoundWithEvents.js';
import { ChimeStrike } from '../WindChimes/_ChimeStrike.js';

/**
 * A timing-worklet SoundModel that renders each phase occurrence by
 * retriggering an owned ChimeStrike. Structural sibling of
 * RendezvousPinger/_PSPinger.js, built on the same PlusSimplexPhasor
 * worklet, but needs no voice pool: unlike Ping, ChimeStrike.play()
 * force-retriggers safely mid-ring (see WindChimes/ChimeTube.js), so one
 * phase-event trigger can own exactly one ChimeStrike.
 */
export class PSChimePinger extends BaseSoundWithEvents {
    static WORKLET_PATH = new URL(
        '../../worklets/plusSimplexPhaseEventProcessor.js',
        import.meta.url
    ).href;

    constructor(context, name, options = {}) {
        super(context, name);

        this.processorOptions = options.processorOptions ?? {};

        this.addParameter('freq', 2, 0, 20);
        this.addParameter('phase', 0, 0, 1);
        this.addParameter('weight', 0, 0, 3);
        this.addParameter('transition_dur', 1, 0, 60);
        this.addParameter('transition_sharpness', 0, 0, 6);
        this.addParameter('pitch', options.pitch ?? 60, 54, 90);

        this.addEvent(
            'transition',
            () => this._submitTransition(),
            'Move the notification phasor to the staged frequency, weight, and phase.'
        );
        this.addEvent(
            'transition-natural',
            () => this._submitNaturalTransition(),
            'Move to the staged frequency and weight without imposing an endpoint phase.'
        );

        this.receivedEventCount = 0;
        this.lastTiming = null;
        this.acceptingPhaseEvents = false;
        this.createNodes();
    }

    createNodes() {
        this.workletNode = new AudioWorkletNode(
            this.context,
            'plus-simplex-phase-event-processor',
            {
                processorOptions: {
                    sampleRate: this.context.sampleRate,
                    ...this.processorOptions
                }
            }
        );

        this.chimeStrike = new ChimeStrike(this.context, `${this.name}-strike`);
        this.chimeStrike.setParameter('pitch', this.getParameter('pitch').get());

        this.masterGain = this.context.createGain();
        this.keepAliveGain = this.context.createGain();
        this.keepAliveGain.gain.setValueAtTime(0, this.context.currentTime);
        this.masterGain.gain.setValueAtTime(0, this.context.currentTime);

        // The processor emits silence, but this connection keeps it in the
        // actively rendered graph.
        this.workletNode.connect(this.keepAliveGain);
        this.keepAliveGain.connect(this.masterGain);
        this.chimeStrike.connect(this.masterGain);

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

        this.chimeStrike.play();
    }

    _submitTransition() {
        this.workletNode.port.postMessage({
            type: 'event',
            name: 'transition',
            targetRate: this.getParameter('freq').get(),
            targetWeight: this.getParameter('weight').get(),
            targetPhase: this.getParameter('phase').get(),
            durationSeconds: this.getParameter('transition_dur').get(),
            transitionSharpness: this.getParameter('transition_sharpness').get()
        });
    }

    _submitNaturalTransition() {
        this.workletNode.port.postMessage({
            type: 'event',
            name: 'transition-natural',
            targetRate: this.getParameter('freq').get(),
            targetWeight: this.getParameter('weight').get(),
            durationSeconds: this.getParameter('transition_dur').get(),
            transitionSharpness: this.getParameter('transition_sharpness').get()
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
        this.workletNode.parameters
            .get('active')
            .setValueAtTime(0, this.context.currentTime);
        this.acceptingPhaseEvents = false;
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
            this.chimeStrike?.setParameter('pitch', this.getParameter('pitch').get());
            return;
        }

        if (name === 'freq' || name === 'phase' || name === 'weight') {
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
            lastTiming: this.lastTiming
        };
    }

    destroy() {
        this.chimeStrike?.destroy();
        this.workletNode?.disconnect();
        this.keepAliveGain?.disconnect();
        super.destroy();
    }
}

export default PSChimePinger;
