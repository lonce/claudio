// generative-audio-worker.js - Web Worker for heavy audio generation
importScripts('./AudioGenerator.js'); // Adjust path as needed

class GenerativeAudioWorker {
    constructor() {
        this.audioGenerator = null;
        this.m = 4; // Default lookahead frames
        this.bufferLevel = 0; // Track how full the worklet's buffer is
        this.isInitialized = false;
        
        // Listen for messages from main thread
        self.addEventListener('message', this.handleMessage.bind(this));
    }
    
    handleMessage(event) {
        const { action, data } = event.data;
        
        switch (action) {
            case 'initialize':
                this.initialize(data);
                break;
                
            case 'updateParameters':
                this.updateParameters(data);
                break;
                
            case 'bufferStatus':
                this.handleBufferStatus(data);
                break;
                
            case 'generateAudio':
                this.generateAudio(data);
                break;
                
            case 'reset':
                this.reset();
                break;
                
            default:
                console.warn('Unknown action:', action);
        }
    }
    
    initialize(config) {
        const {
            centerFreq = 440,
            modRate = 2,
            modDepth = 0.5,
            sampleRate = 44100,
            lookaheadFrames = 4
        } = config;
        
        this.m = lookaheadFrames;
        this.audioGenerator = new AudioGenerator(centerFreq, modRate, modDepth, sampleRate);
        this.bufferLevel = 0;
        this.isInitialized = true;
        
        // Send initial audio to fill buffer
        this.preGenerateAudio();
        
        self.postMessage({
            action: 'initialized',
            success: true
        });
    }
    
    updateParameters(params) {
        if (this.audioGenerator) {
            const { centerFreq, modRate, modDepth } = params;
            this.audioGenerator.updateParameters(centerFreq, modRate, modDepth);
        }
    }
    
    handleBufferStatus(status) {
        const { availableSamples, bufferSize, fillRatio } = status;
        this.bufferLevel = availableSamples;
        
        //console.log(`Worker received buffer status: ${availableSamples}/${bufferSize} (${(fillRatio*100).toFixed(1)}%)`);
        
        // Check if we need to generate more audio
        const lowWaterMark = this.m * 128 * 0.5; // Half buffer
        //console.log(`Low water mark: ${lowWaterMark}, current: ${this.bufferLevel}`);
        
        if (this.bufferLevel < lowWaterMark) {
            //console.log(`Buffer below low water mark, generating more audio`);
            this.generateMoreAudio();
        }
    }
    
    generateAudio(request) {
        const { frames } = request;
        if (this.audioGenerator) {
            const audioData = this.audioGenerator.getNextHop(frames);
            
            self.postMessage({
                action: 'audioGenerated',
                data: {
                    audioData: audioData,
                    frames: frames
                }
            });
        }
    }
    
    preGenerateAudio() {
        // Generate initial audio to fill buffer
        const initialFrames = this.m; // Fill to capacity
        this.generateAudio({ frames: initialFrames });
    }
    
    generateMoreAudio() {
        // Generate additional frames to maintain buffer level
        const framesToGenerate = Math.max(1, Math.floor(this.m / 2));
        //console.log(`Generating ${framesToGenerate} more frames to refill buffer`);
        this.generateAudio({ frames: framesToGenerate });
    }
    
    reset() {
        if (this.audioGenerator) {
            this.audioGenerator.reset();
            this.bufferLevel = 0;
            this.preGenerateAudio();
        }
    }
}

// Initialize the worker
const worker = new GenerativeAudioWorker();