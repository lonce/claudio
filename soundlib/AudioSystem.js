export class AudioSystem {
    constructor() {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = new Map();
        this.masterGainNode = this.context.createGain();
        this.masterGainNode.gain.value = 0.4; // default master gain
        this.masterGainNode.connect(this.context.destination);
        // path -> in-flight/completed addModule() promise, not just a
        // "done" flag -- createSound() calls now run concurrently
        // (app/main.js), so two calls sharing a worklet path can both
        // reach here before either's addModule() resolves. Caching the
        // promise itself (set synchronously, before the first await) means
        // a concurrent second call sees it already present and just awaits
        // the same load, instead of both calling addModule() on the same
        // path -- which would double-register the same processor name and
        // throw.
        this.loadedWorklets = new Map();
    }

    async loadWorklet(workletPath) {
        if (!this.loadedWorklets.has(workletPath)) {
            this.loadedWorklets.set(workletPath, this.context.audioWorklet.addModule(workletPath));
        }
        await this.loadedWorklets.get(workletPath);
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
