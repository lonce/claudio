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
        
        const sound = new SoundClass(this.context, name, ...args);

        // Wait for audio loading if the method exists
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