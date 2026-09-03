/**
 * Minimal standalone BaseSound used by the audible demo.
 * In an existing SoundModels project, keep using that project's BaseSound.js.
 */
class Parameter {
    constructor(name, value, min, max) {
        this.name = name;
        this.value = value;
        this.min = min;
        this.max = max;
        this.attackTime = 0.01;
    }

    get() {
        return this.value;
    }

    set(value) {
        this.value = Math.min(this.max, Math.max(this.min, Number(value)));
    }
}

export class BaseSound {
    constructor(context, name, gain = 0.6) {
        this.context = context;
        this.name = name;
        this.parameters = new Map();
        this.isPlaying = false;
        this.inAttackSegment = false;
        this.inDecaySegment = false;
        this.addParameter('gain', gain, 0, 1);
    }

    addParameter(name, value, min, max) {
        const parameter = new Parameter(name, value, min, max);
        this.parameters.set(name, parameter);
        return parameter;
    }

    getParameter(name) {
        const parameter = this.parameters.get(name);
        if (!parameter) throw new Error(`Unknown parameter: ${name}`);
        return parameter;
    }

    setParameter(name, value) {
        this.getParameter(name).set(value);
        this.updateParameter(name);
    }

    play() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.startSound();
    }

    stop(onReleased) {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        this.stopSound(onReleased);
    }

    connect(destination) {
        this.outputNode.connect(destination);
        return destination;
    }

    scheduleAttack(gainNode) {
        const now = this.context.currentTime;
        const target = this.getParameter('gain').get();
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(target, now + 0.01);
    }

    scheduleDecay(gainNode, onReleased) {
        const now = this.context.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.03);
        setTimeout(() => onReleased?.(), 40);
    }

    updateGainDuringAttack(gainNode, value) {
        gainNode.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
    }

    updateParameter(name) {}
    startSound() {}
    stopSound(onReleased) { onReleased?.(); }

    destroy() {
        this.outputNode?.disconnect();
    }
}

export default BaseSound;
