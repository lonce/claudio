import { FloatParameter, StringParameter, IntegerParameter } from './Parameter.js';


export class BaseSound {
    constructor(context, name) {
        this.context = context;
        this.name = name;
        this.parameters = new Map();
        this.outputNode = null;
        this.isPlaying = false;
        this.destination = null;
        this.loadAudioPromise = null; // used if the sound loads an audio file

        this.timeoutID=0; // keeps track so a play can sutoff the timeout.
        // Add gain parameter with default attack and decay times
        this.addParameter('gain', .6, 0, 1, 0.05, .25);
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
            //-- this.updateParameter(name);
        }
    }

    updateParameter(name) {
        // To be implemented by derived classes
    }

    setParameterNormalized(name, normalizedValue) {
        const param = this.getParameter(name);
        if (param) {
            param.setNormalized(normalizedValue);
            //-- this.updateParameter(name);
        }
    }

    getParameterNormalized(name) {
        const param = this.getParameter(name);
        return param ? param.getNormalized() : null;
    }



    play() {
        if (this.timeoutID!=0) {
            clearTimeout(this.timeoutID)
            this.timeoutID=0;
        }
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

    // ---------    Used if derived model needs an audio file
    async loadAudioFile(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            console.log(`Audio file loaded successfully for ${this.name}`);
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
        if (this.loadAudioPromise) {
            await this.loadAudioPromise;
        }
    }
    //------------

}