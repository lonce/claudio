// SoundModelWrapper.js
// Simplified SoundModelWrapper with always-active currentVoice

export class SoundModelWrapper {
    constructor(SoundFactory, context, name, initialPoolSize = 4, maxPoolSize = 8) {
        this.SoundFactory = SoundFactory;
        this.context = context;
        this.name = name;
        this.pool = [];
        this.maxPoolSize = maxPoolSize;
        this.outputNode = this.context.createGain();

        this.outputNode.gain.value = 0.4;

        this.idCount=0
        console.log(`IN Wrapper Constructor, idCount = ${this.idCount}`)

        for (let i = 0; i < initialPoolSize; i++) {
            this._addVoiceToPool();
        }

        this.currentVoice = this._getAvailableVoice();
        this.currentVoice.connect(this.outputNode);


    }

   
    _addVoiceToPool() {
        const voice = this.SoundFactory();
        voice.ID=this.idCount;
        this.idCount=this.idCount+1
        console.log(`pushing voice with ID=${voice.ID} to the pool`)
        voice.connect(this.outputNode);
        this.pool.push(voice);
    }

    _getAvailableVoice() {
        const freeVoice = this.pool.find(v => !v.isPlaying);
        if (freeVoice) return freeVoice;

        if (this.pool.length < this.maxPoolSize) {
            this._addVoiceToPool();
            return this.pool[this.pool.length - 1];
        }

        return null;
    }

    _copyParameters(fromVoice, toVoice) {
        const params = fromVoice?.getParameters?.() ?? [];
        for (const param of params) {
            const name = param.name;
            const value = fromVoice.getParameter(name)?.get?.();
            if (value !== undefined) {
                toVoice.setParameter(name, value);
            }
        }
    }

    play() {
        if (this.currentVoice?.isPlaying) {
            this.currentVoice.stop(); // allow it to decay
            console.log(`STOP voiceID = ${this.currentVoice.ID}`)
        }

        const newVoice = this._getAvailableVoice();
        
        if (!newVoice) {
            console.warn(`No available voices in pool for model ${this.name}`);
            return;
        }

        this._copyParameters(this.currentVoice, newVoice);
        newVoice.connect(this.outputNode);
        newVoice.play();
        console.log(`PLAY voiceID = ${newVoice.ID}`)
        this.currentVoice = newVoice;
    }

    stop() {
        if (this.currentVoice) {
            this.currentVoice.stop();
            console.log(`STOP voiceID = ${this.currentVoice.ID}`)
            // Remains currentVoice until replaced on next play()
        }
    }

    setParameter(name, value) {
        if (this.currentVoice) {
            this.currentVoice.setParameter(name, value);
        }
    }

    setParameterNormalized(name, value) {
        if (this.currentVoice) {
            this.currentVoice.setParameterNormalized(name, value);
        }
    }

    getParameter(name) {
        return this.currentVoice?.getParameter(name);
    }

    getParameterNormalized(name) {
        return this.currentVoice?.getParameterNormalized(name);
    }

    getParameters() {
        return this.currentVoice?.getParameters() || [];
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
        this.pool = [];
        this.disconnect();
    }
}

export default SoundModelWrapper;
