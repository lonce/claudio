export class AudioSystem {
    constructor() {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = new Map();
        this.masterGainNode = this.context.createGain();
        this.masterGainNode.gain.value = 0.4; // default master gain
        this.masterGainNode.connect(this.context.destination);
        this.loadedWorklets = new Set();
    }

    async loadWorklet(workletPath) {
        if (!this.loadedWorklets.has(workletPath)) {
            await this.context.audioWorklet.addModule(workletPath);
            this.loadedWorklets.add(workletPath);
        }
    }

    async createSound(SoundClass, name, maxPoolSize = 4, ...args) {
        if (SoundClass.WORKLET_PATH) {
            await this.loadWorklet(SoundClass.WORKLET_PATH);
        }

        const createModel = () => new SoundClass(this.context, name, ...args);

        let sound;
        if (maxPoolSize > 0) {
            const { SoundModelWrapper } = await import('./SoundModelWrapper.js');
            sound = new SoundModelWrapper(createModel, this.context, name, Math.min(4, maxPoolSize), maxPoolSize);
        } else {
            sound = createModel();
        }

        if (typeof sound.waitForLoad === 'function') {
            await sound.waitForLoad();
        }

        sound.connect(this.masterGainNode);
        this.sounds.set(name, sound);
        return sound;
    }

    async resume() {
        if (this.context.state === 'suspended') {
            await this.context.resume();
            console.log('AudioContext resumed');
        }
    }

    getSound(name) {
        return this.sounds.get(name);
    }
}

export default AudioSystem;
