import { Parameter } from './Parameter.js';

export class BaseSound {
    constructor(context, name) {
        this.context = context;
        this.name = name;
        this.parameters = new Map();
        this.outputNode = null;
        this.isPlaying = false;
        this.destination = null;

        this.addParameter('gain', 1, 0, 1);
    }

    addParameter(name, defaultValue, min, max) {
        this.parameters.set(name, new Parameter(name, defaultValue, min, max));
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
        // To be implemented by derived classes
    }

    play() {
        if (!this.isPlaying) {
            this.isPlaying = true;
            this.startSound();
        }
    }

    stop() {
        if (this.isPlaying) {
            this.isPlaying = false;
            this.stopSound();
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

    startSound() {
        // To be implemented by derived classes
    }

    stopSound() {
        // To be implemented by derived classes
    }

    destroy() {
        this.stop();
        this.disconnect();
    }
}