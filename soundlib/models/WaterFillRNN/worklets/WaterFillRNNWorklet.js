// WaterFillRNNWorklet.js - AudioWorkletProcessor with circular buffer
class WaterFillRNNWorklet extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            {name: 'active', defaultValue: 0, minValue: 0, maxValue: 1},
            {name: 'centerFreq', defaultValue: 440, minValue: 20, maxValue: 20000},
            {name: 'modRate', defaultValue: 2, minValue: 0.1, maxValue: 20},
            {name: 'modDepth', defaultValue: 0.5, minValue: 0, maxValue: 1}
        ];
    }

    constructor(options) {
        super();
        
        // Extract configuration from options
        const config = options.processorOptions || {};
        this.sampleRate = config.sampleRate || 44100;
        this.lookaheadFrames = config.lookaheadFrames || 4;
        
        // Circular buffer setup - 2 * m * 128 samples
        this.bufferSize = this.lookaheadFrames * 2 * 128;
        this.circularBuffer = new Float32Array(this.bufferSize);
        this.writePointer = 0;
        this.readPointer = 0;
        this.availableSamples = 0;
        
        // State tracking
        this.active = false;
        this.processCount = 0;
        
        // Parameter tracking for change detection
        this.lastParams = {
            centerFreq: 440,
            modRate: 2,
            modDepth: 0.5
        };
        
        // Listen for messages from main thread (audio data)
        this.port.onmessage = (event) => {
            this.handleMessage(event.data);
        };
        
        // Initialize by requesting audio generation
        this.requestInitialization();
    }
    
    handleMessage(data) {
        const { action } = data;
        
        switch (action) {
            case 'audioData':
                this.addAudioToBuffer(data.audioData);
                break;
                
            case 'start':
                this.active = true;
                break;
                
            case 'stop':
                this.active = false;
                break;
                
            case 'reset':
                this.reset();
                break;
        }
    }
    
    addAudioToBuffer(audioData) {
        // Add new audio data to circular buffer
        for (let i = 0; i < audioData.length; i++) {
            this.circularBuffer[this.writePointer] = audioData[i];
            this.writePointer = (this.writePointer + 1) % this.bufferSize;
            
            // Don't overflow - if buffer is full, this will overwrite old data
            if (this.availableSamples < this.bufferSize) {
                this.availableSamples++;
            } else {
                // Buffer overflow - advance read pointer
                this.readPointer = (this.readPointer + 1) % this.bufferSize;
            }
        }
    }
    
    requestInitialization() {
        this.port.postMessage({
            action: 'initialize',
            data: {
                sampleRate: this.sampleRate,
                lookaheadFrames: this.lookaheadFrames,
                centerFreq: this.lastParams.centerFreq,
                modRate: this.lastParams.modRate,
                modDepth: this.lastParams.modDepth
            }
        });
    }
    
    checkParameterChanges(parameters) {
        const currentParams = {
            centerFreq: parameters.centerFreq[0] || this.lastParams.centerFreq,
            modRate: parameters.modRate[0] || this.lastParams.modRate,
            modDepth: parameters.modDepth[0] || this.lastParams.modDepth
        };
        
        // Check if any parameters changed
        let changed = false;
        for (const key in currentParams) {
            if (Math.abs(currentParams[key] - this.lastParams[key]) > 0.001) {
                changed = true;
                break;
            }
        }
        
        if (changed) {
            this.lastParams = currentParams;
            this.port.postMessage({
                action: 'parameterUpdate',
                data: currentParams
            });
        }
    }
    
    reportBufferStatus() {
        // Report buffer status every few process calls to ensure worker stays informed
        if (this.processCount % 3 === 0) {  // Report every 3rd process() call
            //console.log(`Reporting buffer status: ${this.availableSamples}/${this.bufferSize} samples (process #${this.processCount})`);
            this.port.postMessage({
                action: 'bufferStatus',
                data: {
                    availableSamples: this.availableSamples,
                    bufferSize: this.bufferSize,
                    fillRatio: this.availableSamples / this.bufferSize
                }
            });
        }
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channel = output[0];
        
        // Check if active
        const isActive = parameters.active[0] === 1;
        if (!isActive) {
            channel.fill(0);
            return true;
        }
        
        // Check for parameter changes
        this.checkParameterChanges(parameters);
        
        // Fill output buffer from circular buffer
        for (let i = 0; i < channel.length; i++) {
            if (this.availableSamples > 0) {
                channel[i] = this.circularBuffer[this.readPointer];
                this.readPointer = (this.readPointer + 1) % this.bufferSize;
                this.availableSamples--;
            } else {
                // Buffer underrun - fill with silence
                //console.log(`Buffer underrun at sample ${i}, filling with silence`);
                channel[i] = 0;
            }
        }
        
        // Report buffer status regularly and increment counter
        this.processCount++;
        this.reportBufferStatus();
        
        return true; // Keep processor alive
    }
    
    reset() {
        this.circularBuffer.fill(0);
        this.writePointer = 0;
        this.readPointer = 0;
        this.availableSamples = 0;
    }
}

registerProcessor('waterFillRNNWorklet', WaterFillRNNWorklet);