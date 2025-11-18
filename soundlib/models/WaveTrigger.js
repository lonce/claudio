import { BaseSound } from '../BaseSound.js';

export class WaveTrigger extends BaseSound {
    constructor(context, name) {
        super(context, name);
        
        // Hard-coded wave files for this model
        this.waveFileUrls = [
            'soundlib/models/WaveTrigger/chirp1.wav',
            'soundlib/models/WaveTrigger/chirp2.wav', 
            'soundlib/models/WaveTrigger/chirp3.wav',
            'soundlib/models/WaveTrigger/chirp4.wav'
        ];
        // this.waveFileUrls = [
        //     'WaveTrigger/chirp1.wav',
        //     'WaveTrigger/chirp2.wav', 
        //     'WaveTrigger/chirp3.wav',
        //     'WaveTrigger/chirp4.wav'
        // ];
        
        this.audioBuffers = [];
        this.currentBufferIndex = -1;
        this.bufferSource = null;
        
        // Add select parameter - boundaries fixed by number of wave files
        this.addParameter('select', 0, 0, 1, 0, 0);
        
        this.createNodes();
        this.loadAudioFiles();
    }

    createNodes() {
        this.bufferSource = null;
        this.gainNode = this.context.createGain();
        this.outputNode = this.gainNode;
    }

    async loadAudioFiles() {
        this.audioBuffers = [];
        
        for (const url of this.waveFileUrls) {
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
                this.audioBuffers.push(audioBuffer);
            } catch (error) {
                console.error(`Failed to load audio file ${url}:`, error);
                this.audioBuffers.push(null);
            }
        }
    }

    getBufferIndexFromSelect(selectValue) {
        if (this.audioBuffers.length === 0) return -1;
        const index = Math.floor(selectValue * this.audioBuffers.length);
        return Math.min(index, this.audioBuffers.length - 1);
    }

    startSound() {
        console.log("WAVEFILEDRONE startSound");
        
        if (this.audioBuffers.length === 0) {
            console.log("No audio files loaded");
            return;
        }

        // Stop any currently playing buffer source
        if (this.bufferSource) {
            this.bufferSource.stop();
            this.bufferSource.disconnect();
        }

        // Determine which buffer to play based on select parameter
        const selectParam = this.getParameter('select');
        const bufferIndex = this.getBufferIndexFromSelect(selectParam.get());
        
        if (bufferIndex === -1 || !this.audioBuffers[bufferIndex]) {
            console.log("No valid audio buffer available");
            return;
        }

        // Create and configure new buffer source
        this.bufferSource = this.context.createBufferSource();
        this.bufferSource.buffer = this.audioBuffers[bufferIndex];
        this.bufferSource.loop = true;
        this.bufferSource.connect(this.gainNode);

        this.currentBufferIndex = bufferIndex;
        this.scheduleAttack(this.gainNode);
        this.startTime = this.context.currentTime;

        this.bufferSource.start();
    }

    stopSound(onReleased) {
        this.scheduleDecay(this.gainNode, () => {
            if (this.bufferSource) {
                this.bufferSource.stop();
                this.bufferSource.disconnect();
                this.bufferSource = null;
            }
            this.currentBufferIndex = -1;
            if (typeof onReleased === 'function') {
                onReleased();
            }
        });
    }

    switchToBuffer(newBufferIndex) {
        if (!this.bufferSource || newBufferIndex === this.currentBufferIndex) {
            return;
        }

        if (newBufferIndex < 0 || newBufferIndex >= this.audioBuffers.length || !this.audioBuffers[newBufferIndex]) {
            console.log("Invalid buffer index:", newBufferIndex);
            return;
        }

        console.log(`Switching from buffer ${this.currentBufferIndex} to ${newBufferIndex}`);

        // Create new buffer source
        const newBufferSource = this.context.createBufferSource();
        newBufferSource.buffer = this.audioBuffers[newBufferIndex];
        newBufferSource.loop = true;
        newBufferSource.connect(this.gainNode);

        // Start new buffer source immediately
        newBufferSource.start();

        // Stop and disconnect old buffer source
        if (this.bufferSource) {
            this.bufferSource.stop();
            this.bufferSource.disconnect();
        }

        // Update references
        this.bufferSource = newBufferSource;
        this.currentBufferIndex = newBufferIndex;
    }

    updateParameter(name) {
        console.log("WAVEFILEDRONE updateParameter:", name);
        const param = this.getParameter(name);
        const now = this.context.currentTime;

        if (name === 'select' && this.bufferSource) {
            const newBufferIndex = this.getBufferIndexFromSelect(param.get());
            this.switchToBuffer(newBufferIndex);
        } else if (name === 'gain') {
            if (this.inDecaySegment) {
                console.log("Ignoring gain update during decay.");
                return;
            }
            if (this.inAttackSegment) {
                console.log('inAttackSegment gain to ' + param.get());
                this.updateGainDuringAttack(this.gainNode, param.get(), this.startTime, param.attackTime);
            } else {
                const gain = this.gainNode.gain;
                console.log('UPDATE gain to ' + param.get());
                gain.setTargetAtTime(param.get(), now, 0.05);
            }
        }
    }

    destroy() {
        super.destroy();
        if (this.bufferSource) {
            this.bufferSource.stop();
            this.bufferSource.disconnect();
        }
        this.gainNode.disconnect();
    }
}
