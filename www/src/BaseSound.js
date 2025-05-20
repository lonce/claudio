import { FloatParameter, StringParameter, IntegerParameter } from './Parameter.js';

export class BaseSound {
    constructor(context, name) {
        this.context = context;
        this.name = name;
        this.parameters = new Map();
        this.outputNode = null;
        this.isPlaying = false;
        this.destination = null;
        this.loadAudioPromise = null;

        this.inAttackSegment = false;
        this.inDecaySegment = false;
        this.attackTimeoutID = null;
        this.decayTimeoutID = null;

        this.addParameter('gain', 0.6, 0, 1, 0.5, 0.5);
    }

    addParameter(name, defaultValue, min, max, attackTime = 0.01, decayTime = 0.01) {
        this.parameters.set(name, new FloatParameter(this, name, defaultValue, min, max, attackTime, decayTime));
    }

    addStringParameter(name, defaultValue) {
        this.parameters.set(name, new StringParameter(this, name, defaultValue));
    }

    addIntegerParameter(name, defaultValue, min, max) {
        this.parameters.set(name, new IntegerParameter(this, name, defaultValue, min, max));
    }

    getParameter(name) {
        return this.parameters.get(name);
    }

    getParameters() {
        return Array.from(this.parameters.values());
    }

    setParameter(name, value) {
        const param = this.getParameter(name);
        if (param) {
            param.set(value);
            this.updateParameter(name);
        }
    }

    setParameterNormalized(name, normalizedValue) {
        const param = this.getParameter(name);
        if (param) {
            param.setNormalized(normalizedValue);
            this.updateParameter(name);
        }
    }

    getParameterNormalized(name) {
        const param = this.getParameter(name);
        return param ? param.getNormalized() : null;
    }

    updateParameter(name) {
        // To be overridden in subclass
    }

    scheduleAttack(gainNode, resumeFromDecay = false) {
        console.log("schedule attack")
        const now = this.context.currentTime;
        const gainParam = this.getParameter('gain');
        const gain = gainNode.gain;

        if (typeof gain.cancelAndHoldAtTime === 'function') {
            gain.cancelAndHoldAtTime(now);
        } else {
            gain.cancelScheduledValues(now);
            gain.setValueAtTime(gain.value, now);
        }

        if (!resumeFromDecay) {
            gain.setValueAtTime(0, now);
        } else {
            gain.setValueAtTime(gain.value, now);
        }

        gain.linearRampToValueAtTime(gainParam.get(), now + gainParam.attackTime);

        this.inAttackSegment = true;
        this.inDecaySegment = false;

        if (this.attackTimeoutID) clearTimeout(this.attackTimeoutID);
        if (this.decayTimeoutID) clearTimeout(this.decayTimeoutID); // cancel pending decay stop

        this.attackTimeoutID = setTimeout(() => {
            this.inAttackSegment = false;
        }, gainParam.attackTime * 1000);
    }

    scheduleDecay(gainNode, onReleased) {
        console.log("schedule decay")
        const now = this.context.currentTime;
        const gainParam = this.getParameter('gain');
        const gain = gainNode.gain;

        if (this.inDecaySegment) return;

        if (typeof gain.cancelAndHoldAtTime === 'function') {
            gain.cancelAndHoldAtTime(now);
        } else {
            gain.cancelScheduledValues(now);
            gain.setValueAtTime(gain.value, now);
        }

        gain.setValueAtTime(gain.value, now);
        gain.linearRampToValueAtTime(0, now + gainParam.decayTime);

        this.inDecaySegment = true;

        this.decayTimeoutID = setTimeout(() => {
            this.inDecaySegment = false;
            if (typeof onReleased === 'function') {
                onReleased();
            }
        }, gainParam.decayTime * 1000);
    }

    updateGainDuringAttack(gainNode, newTarget, startTime, attackTime) {
        console.log("update during attack")
        const now = this.context.currentTime;
        const gain = gainNode.gain;
        const timeSinceStart = now - (startTime ?? 0);
        const timeLeft = Math.max(0.01, attackTime - timeSinceStart);

        if (typeof gain.cancelAndHoldAtTime === 'function') {
            gain.cancelAndHoldAtTime(now);
        } else {
            gain.cancelScheduledValues(now);
            gain.setValueAtTime(gain.value, now);
        }

        gain.setValueAtTime(gain.value, now);
        gain.linearRampToValueAtTime(newTarget, now + timeLeft);
    }

    play() {
        console.log("play")
        if (this.isPlaying) {
            if (this.inDecaySegment) {
                console.log(`${this.name}: interrupting decay, resuming attack`);
                this.scheduleAttack(this.gainNode, true);
            } else {
                return;
            }
        } else {
            this.isPlaying = true;
            this.startSound();
        }
    }

    stop(cb) {
        console.log("stop")
        if (this.isPlaying) {
            this.stopSound(() => {
                this.isPlaying = false;
                if (typeof cb === 'function') cb();
            });
        }
    }

    connect(destination) {
        this.destination = destination;
        if (this.outputNode) {
            this.outputNode.connect(destination);
        }
    }

    disconnect() {
        if (this.outputNode && this.destination) {
            this.outputNode.disconnect(this.destination);
        }
        this.destination = null;
    }

    startSound() {}
    stopSound() {}

    destroy() {
        this.stop();
        this.disconnect();
    }

    async loadAudioFile(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            return audioBuffer;
        } catch (error) {
            console.error(`Error loading audio file for ${this.name}:`, error);
            throw error;
        }
    }

    initializeAudio(url) {
        this.loadAudioPromise = this.loadAudioFile(url);
        return this.loadAudioPromise;
    }

    async waitForLoad() {
        if (this.loadAudioPromise) await this.loadAudioPromise;
    }
}

export default BaseSound;
