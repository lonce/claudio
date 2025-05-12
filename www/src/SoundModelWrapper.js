// SoundModelWrapper.js
// Generic wrapper for BaseSound-compatible models as an ES module

export class SoundModelWrapper {
    constructor(SoundFactory, context, name, initialPoolSize = 4, maxPoolSize = 8) {
        this.SoundFactory = SoundFactory;
        this.context = context;
        this.name = name;
        this.pool = [];
        this.maxPoolSize = maxPoolSize;
        this.parameterMap = new Map();
        this.outputNode = this.context.createGain();
        this.currentVoice = null;
        this.prototypeVoice = this.SoundFactory();
        this.prototypeVoice.connect(this.outputNode); // connect for completeness

        for (let i = 0; i < initialPoolSize; i++) {
            this._addVoiceToPool();
        }
    }

    _addVoiceToPool() {
        const voice = this.SoundFactory();
        voice.connect(this.outputNode);
        this._applyStoredParametersTo(voice);
        this.pool.push(voice);
    }

    _applyStoredParametersTo(voice) {
        for (const [name, value] of this.parameterMap.entries()) {
            voice.setParameter(name, value);
        }
    }

    _getAvailableVoice() {
        const freeVoice = this.pool.find(v => !v.isPlaying);
        if (freeVoice) {
            console.log(`[Wrapper] Using free voice`);
            return freeVoice;
        }

        if (this.pool.length < this.maxPoolSize) {
            console.log(`[Wrapper] Expanding pool`);
            this._addVoiceToPool();
            return this.pool[this.pool.length - 1];
        }

        console.warn(`[Wrapper] No free voices`);
        return null;
    }

    play() {
        const voice = this._getAvailableVoice();
        if (!voice) {
            console.warn(`No available voices in pool for model ${this.name}`);
            return;
        }

        this._applyStoredParametersTo(voice);
        voice.play();
        this.currentVoice = voice;
    }

    stop() {
        if (this.currentVoice) {
            this.currentVoice.stop();
            this.currentVoice = null;
        }
    }

    setParameter(name, value) {
        this.parameterMap.set(name, value);
        if (this.currentVoice) {
            this.currentVoice.setParameter(name, value);
        }
        if (this.prototypeVoice) {
            this.prototypeVoice.setParameter(name, value);
        }
    }

    setParameterNormalized(name, value) {
        if (this.currentVoice) {
            this.currentVoice.setParameterNormalized(name, value);
        }
        if (this.prototypeVoice) {
            this.prototypeVoice.setParameterNormalized(name, value);
        }

        const unnormalizedValue = this.getParameter(name)?.get?.();
        if (Number.isFinite(unnormalizedValue)) {
            this.parameterMap.set(name, unnormalizedValue);
        } else {
            console.warn(`Parameter ${name} has non-finite value:`, unnormalizedValue);
        }
    }

    getParameter(name) {
        return this.currentVoice?.getParameter(name) ?? this.prototypeVoice.getParameter(name);
    }

    getParameterNormalized(name) {
        return this.currentVoice?.getParameterNormalized(name) ?? this.prototypeVoice.getParameterNormalized(name);
    }

    getParameters() {
        return this.currentVoice?.getParameters() ?? this.prototypeVoice.getParameters();
    }

    connect(destination) {
        this.outputNode.connect(destination);
    }

    disconnect() {
        this.outputNode.disconnect();
    }

    isPlaying() {
        return this.pool.some(v => v.isPlaying);
    }

    destroy() {
        this.stop();
        for (const voice of this.pool) {
            voice.destroy();
        }
        this.prototypeVoice?.destroy();
        this.pool = [];
        this.disconnect();
    }
}

export default SoundModelWrapper;
