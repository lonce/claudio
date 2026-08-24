import { BaseSound } from '../BaseSound.js';

export class AnotherGranny extends BaseSound {
    // Local audio resources bundled with this model. A bare filename (no
    // scheme, no leading slash) typed into the fileURL_or_Freesound_soundID
    // parameter is resolved against this directory, so the app's UI never
    // needs to show/know the actual server path.
    static AUDIO_RESOURCES_BASE_URL = new URL('./audioResources/', import.meta.url).href;

    // Freesound IDs and absolute URLs/paths are passed through untouched;
    // anything else is treated as a filename to look up in AUDIO_RESOURCES_BASE_URL.
    static resolveAudioSource(nameOrUrl) {
        if (/^\d+$/.test(nameOrUrl)) return nameOrUrl;
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(nameOrUrl) || nameOrUrl.startsWith('/')) {
            return nameOrUrl;
        }
        return new URL(nameOrUrl, AnotherGranny.AUDIO_RESOURCES_BASE_URL).href;
    }

    constructor(context, name, audioFileURL) {
        super(context, name);

        this.m_grainDuration = 0.9;
        this.m_stepSize = .25;
        this.m_pitch = 0.0;
        this.m_rpitch = 0.0;

        this.bufferDuration = 1.0;
        this.realTime = 0.0;
        this.grainTime = 0.0;
        this.m_grainPlayInterval = this.m_stepSize;

        this.p_fileLoopStartRel = 0;
        this.p_fileLoopLengthRel = 1;
        this.m_fileLoopStart = 0;
        this.m_fileLoopLength = 1;
        this.m_fileLoopEnd;
        this.m_fileLoop = true;

        this.pitchRate = Math.pow(2.0, this.m_pitch + this.m_rpitch * (2 * Math.random() - 1));

        this.grainWindowLength = 16384;
        this.grainWindow = new Float32Array(this.grainWindowLength);
        for (let i = 0; i < this.grainWindowLength; i++) {
            this.grainWindow[i] = Math.sin(Math.PI * i / this.grainWindowLength);
        }

        this.audioBuffer = null;
        this.grainSources = [];
        this.continuePlaying = false;
        this.isGrainSchedulerRunning = false;

        this.loadAudioFile(AnotherGranny.resolveAudioSource(audioFileURL)).then(buffer => {
            this.setAudioBuffer(buffer);
        });

        this.addParameter('pitch', this.m_pitch, -2.0, 2.0);
        this.addParameter('randomizePitch', this.m_rpitch, 0, 1);
        this.addParameter('grainSize', this.m_grainDuration, 0.010, 0.5);
        this.addParameter('stepSize', this.m_stepSize, 0, 2);
        this.addParameter('grainPlayInterval', this.m_grainPlayInterval, 0.05, 1);
        this.addParameter('fileLoopStart', this.p_fileLoopStartRel, 0, 1);
        this.addParameter('fileLoopLength', this.p_fileLoopLengthRel, 0, 1);
        this.addStringParameter('fileURL_or_Freesound_soundID', audioFileURL);

        this.gainNode = this.context.createGain();
        this.outputNode = this.gainNode;
        //this.gainNode.gain.setValueAtTime(this.getParameter('gain').get(), this.context.currentTime);


    }

    setAudioBuffer(buffer) {
        this.audioBuffer = buffer;
        this.bufferDuration = this.audioBuffer.duration;
        this.m_fileLoopStart = this.p_fileLoopStartRel * this.bufferDuration;
        this.m_fileLoopEnd = Math.min(this.bufferDuration, this.bufferDuration * (this.p_fileLoopStartRel + this.p_fileLoopLengthRel));
        this.buffLoaded = true;
        console.log("Buffer Loaded!");

        // Continue playing after buffer update if currently playing
        if (this.isPlaying && this.continuePlaying && !this.isGrainSchedulerRunning) {
            this.schedule();
        }
    }

    stopGrains() {
        this.continuePlaying = false;
        this.isGrainSchedulerRunning = false;
        this.grainSources.forEach(source => {
            try {
                source.stop();
                source.disconnect();
            } catch (_) {}
        });
        this.grainSources = [];
    }

    startSound() {
        if (!this.audioBuffer) {
            console.error('Audio buffer not loaded');
            return;
        }
        this.stopGrains();
        this.realTime = this.context.currentTime;
        this.grainTime = 0;
        this.continuePlaying = true;
        this.isGrainSchedulerRunning = false;
        this.schedule();


        //this.gainNode.gain.setValueAtTime(this.getParameter('gain').get(), this.context.currentTime);
        this.scheduleAttack(this.gainNode);
        this.startTime = this.context.currentTime;
    }

    stopSound(onReleased) {
        this.scheduleDecay(this.gainNode, () => {
            this.stopGrains();
            if (typeof onReleased === 'function') {
                onReleased();
            }
        });
        if (typeof onReleased === 'function') onReleased();
    }

    schedule() {
        if (!this.continuePlaying || !this.audioBuffer) return;
        this.isGrainSchedulerRunning = true;
        const currentTime = this.context.currentTime;
        while (this.realTime < currentTime + 0.100) {
            this.scheduleGrain();
        }
        setTimeout(() => this.schedule(), 50);
    }

    scheduleGrain() {
        if (!this.audioBuffer) return;

        const source = this.context.createBufferSource();
        source.buffer = this.audioBuffer;
        this.pitchRate = Math.pow(2.0, this.m_pitch + this.m_rpitch * (2 * Math.random() - 1));
        source.playbackRate.value = this.pitchRate;

        const grainWindowNode = this.context.createGain();
        source.connect(grainWindowNode);
        grainWindowNode.connect(this.gainNode);

        source.start(this.realTime, this.grainTime, this.m_grainDuration);
        source.stop(this.realTime + this.m_grainDuration);

        grainWindowNode.gain.setValueAtTime(0, this.realTime);
        grainWindowNode.gain.setValueCurveAtTime(this.grainWindow, this.realTime, this.m_grainDuration / this.pitchRate);

        this.grainSources.push(source);

        this.realTime += this.m_grainPlayInterval;
        this.grainTime += this.m_stepSize;
        this.grainTime = Math.max(this.grainTime, this.m_fileLoopStart);

        if (this.grainTime > this.m_fileLoopEnd) {
            this.grainTime = this.m_fileLoop ? this.m_fileLoopStart : this.grainTime;
            if (!this.m_fileLoop) this.continuePlaying = false;
        }

        if (this.grainTime < 0.0) {
            this.grainTime += this.m_stepSize;
        }
    }

    updateParameter(name) {
        const param = this.getParameter(name);
        const now = this.context.currentTime;
        
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
            case 'fileURL_or_Freesound_soundID':
                const newURL = param.get();
                this.loadAudioFile(AnotherGranny.resolveAudioSource(newURL)).then(buffer => this.setAudioBuffer(buffer)).catch(error => {
                    console.error(`Failed to load audio for ${this.name}:`, error);
                });
                break;
            case 'gain':

                if (this.inDecaySegment) {
                    console.log("Ignoring gain update during decay.");
                    return;
                }
                if (this.inAttackSegment) {
                    this.updateGainDuringAttack(this.gainNode, param.get(), this.startTime, param.attackTime);
                } else {
                    const gain = this.gainNode.gain;
                    gain.setTargetAtTime(param.get(), now, 0.05);
                }
                //this.gainNode.gain.setTargetAtTime(param.get(), this.context.currentTime, param.attackTime);
                break;
        }
    }
}
