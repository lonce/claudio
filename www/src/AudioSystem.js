import SoundModelWrapper from './SoundModelWrapper.js';

export class AudioSystem {
    constructor() {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = new Map();
        this.masterGainNode = this.context.createGain();
        this.masterGainNode.connect(this.context.destination);
        this.loadedWorklets = new Set();
    }

    async loadWorklet(workletPath) {
        if (!this.loadedWorklets.has(workletPath)) {
            await this.context.audioWorklet.addModule(workletPath);
            this.loadedWorklets.add(workletPath);
        }
    }

    async createSound(SoundClass, name, ...args) {
        if (SoundClass.WORKLET_PATH) {
            await this.loadWorklet(SoundClass.WORKLET_PATH);
        }

        // Create a prototype to pre-load anything (like waitForLoad)
        const prototype = new SoundClass(this.context, name, ...args);
        if (typeof prototype.waitForLoad === 'function') {
            await prototype.waitForLoad();
        }

        // Define a factory function that creates new instances
        const factory = () => new SoundClass(this.context, name, ...args);

        // Wrap it in SoundModelWrapper
        const wrapped = new SoundModelWrapper(factory, this.context, name);
        wrapped.connect(this.masterGainNode);
        this.sounds.set(name, wrapped);
        return wrapped;
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