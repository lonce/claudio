import { BaseSound } from '../BaseSound.js';

export class AnotherGranny extends BaseSound {
    constructor(context, name, audioFileURL) {
        super(context, name);

        this.m_grainDuration = 0.9;  // units = seconds
        this.m_stepSize = .25;  // seconds
        this.m_pitch = 0.0;  // octaves
        this.m_rpitch=0.0; // octaves


        this.bufferDuration = 1.0; 
        this.realTime = 0.0;
        this.grainTime = 0.0;

        this.m_grainPlayInterval =this.m_stepSize; 

        this.p_fileLoopStartRel=0; // in [0,1]
        this.p_fileLoopLengthRel=1; // in [0,1]

        this.m_fileLoopStart=0; // in seconds
        this.m_fileLoopLength=1; // in seconds
        this.m_fileLoopEnd; // derived

        this. m_fileLoop=true; // boolean flag

        this.pitchRate = Math.pow(2.0, this.m_pitch+this.m_rpitch*(2*Math.random()-1));

        this.grainWindow;
        this.grainWindowLength = 16384;
        this.grainWindow = new Float32Array(this.grainWindowLength);
        for (let i = 0; i < this.grainWindowLength; i += 1) {
            this.grainWindow[i] = Math.sin(Math.PI * i / this.grainWindowLength);
        }

        this.audioBuffer = null;

        this.initializeAudio(audioFileURL).then(buffer => {
            this.audioBuffer = buffer;

            this.bufferDuration = this.audioBuffer.duration;

            this.m_fileLoopStart =  this.p_fileLoopStartRel*this.bufferDuration;
            this.m_fileLoopEnd = Math.min(this.bufferDuration, this.bufferDuration*(this.p_fileLoopStartRel+this.p_fileLoopLengthRel));

            this.buffLoaded = true;
            console.log("Buffer Loaded!");  


        }).catch(error => {
            console.error(`Failed to load audio for ${this.name}:`, error);
        });

        this.addParameter('pitch', this.m_pitch, -2.0, 2.0);
        this.addParameter('randomizePitch', this.m_rpitch, 0, 1);
        this.addParameter('grainSize', this.m_grainDuration, 0.010, 0.5);
        this.addParameter('stepSize', this.m_stepSize, 0, 2);
        this.addParameter('grainPlayInterval', this.m_grainPlayInterval, 0.05, 1);
        this.addParameter('fileLoopStart', this.p_fileLoopStartRel, 0, 1);
        this.addParameter('fileLoopLength', this.p_fileLoopLengthRel, 0, 1);
        //this.addParameter('gain', 0.4, 0, 1);

           // Initialize gainNode
        this.gainNode = this.context.createGain();
        this.outputNode = this.gainNode; // Assuming BaseSound uses outputNode for connections

        // ... rest of your constructor code ...

        // Set initial gain
        this.gainNode.gain.setValueAtTime(this.getParameter('gain').get(), this.context.currentTime);


    }

    startSound() {
        if (!this.audioBuffer) {
            console.error('Audio buffer not loaded');
            return;
        }

        this.realTime = this.context.currentTime;
        this.grainTime = 0;
        this.continuePlaying = true;

        this.schedule();

        this.gainNode.gain.setValueAtTime(this.getParameter('gain').get(), this.context.currentTime);
    }

    stopSound() {
        this.continuePlaying = false;
    }

    schedule() {
        if (!this.continuePlaying) return;

        const currentTime = this.context.currentTime;

        while (this.realTime < currentTime + 0.100) {
            this.scheduleGrain();
        }

        setTimeout(() => this.schedule(), 50);
    }

    scheduleGrain() {
        const source = this.context.createBufferSource();
        source.buffer = this.audioBuffer;

        this.pitchRate = Math.pow(2.0, this.m_pitch + this.m_rpitch * (2 * Math.random() - 1));
        source.playbackRate.value = this.pitchRate;

        const grainWindowNode = this.context.createGain();
        source.connect(grainWindowNode);
        grainWindowNode.connect(this.gainNode); // This should now work correctly

        source.start(this.realTime, this.grainTime, this.m_grainDuration);
        source.stop(this.realTime + this.m_grainDuration);

        grainWindowNode.gain.setValueAtTime(0, this.realTime);
        grainWindowNode.gain.setValueCurveAtTime(this.grainWindow, this.realTime, this.m_grainDuration / this.pitchRate);

        this.realTime += this.m_grainPlayInterval;

        this.grainTime += this.m_stepSize;
        this.grainTime = Math.max(this.grainTime, this.m_fileLoopStart);

        if (this.grainTime > this.m_fileLoopEnd) {
            if (this.m_fileLoop) {
                this.grainTime = this.m_fileLoopStart;
            } else {
                this.continuePlaying = false;
            }
        }
        if (this.grainTime < 0.0) {
            this.grainTime += this.m_stepSize;
        }
    }

    updateParameter(name) {
        const param = this.getParameter(name);
        switch(name) {
            case 'pitch':
                this.m_pitch = param.get();
                break;
            case 'randomizePitch':
                this.m_rpitch = param.get();
                break;
            case 'grainSize':
                this.m_grainDuration = param.get();
                break;
            case 'stepSize':
                this.m_stepSize = param.get();
                break;
            case 'grainPlayInterval':
                this.m_grainPlayInterval = param.get();
                break;
            case 'fileLoopStart':
                this.p_fileLoopStartRel = param.get();
                this.m_fileLoopStart = this.p_fileLoopStartRel * this.bufferDuration;
                this.m_fileLoopEnd = Math.min(this.bufferDuration, this.bufferDuration * (this.p_fileLoopStartRel + this.p_fileLoopLengthRel));
                break;
            case 'fileLoopLength':
                this.p_fileLoopLengthRel = param.get();
                this.m_fileLoopLength = param.get() * this.bufferDuration;
                this.m_fileLoopEnd = Math.min(this.bufferDuration, this.bufferDuration * (this.p_fileLoopStartRel + this.p_fileLoopLengthRel));
                break;
         case 'gain':
            this.gainNode.gain.setTargetAtTime(param.get(), this.context.currentTime, param.attackTime);
            break;
        }
    }


}