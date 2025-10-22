// usage-example.js - How to use the WorkerFM

import { WorkerFM } from './WorkerFM.js';

class AudioExample {
    constructor() {
        this.audioContext = null;
        this.generativeSound = null;
    }
    
    async initialize() {
        // Create audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Load the worklet module first
        await this.audioContext.audioWorklet.addModule(WorkerFM.WORKLET_PATH);
        
        // Create generative sound with custom configuration
        this.generativeSound = new WorkerFM(
            this.audioContext, 
            'fm-synthesizer',
            {
                lookaheadFrames: 6,  // Configurable buffer size
                centerFreq: 220,     // Start at A3
                modRate: 1.5,        // Slow modulation
                modDepth: 0.3        // Moderate frequency variation
            }
        );
        
        // Connect to audio output
        this.generativeSound.connect(this.audioContext.destination);
        
        console.log('Generative audio system initialized');
    }
    
    async start() {
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        if (this.generativeSound) {
            await this.generativeSound.startSound();
            console.log('Generative audio started');
        }
    }
    
    stop() {
        if (this.generativeSound) {
            this.generativeSound.stopSound(() => {
                console.log('Generative audio stopped');
            });
        }
    }
    
    // Example of real-time parameter changes
    updateFrequency(newFreq) {
        if (this.generativeSound) {
            this.generativeSound.getParameter('centerFreq').set(newFreq);
            this.generativeSound.updateParameter('centerFreq');
        }
    }
    
    updateModulation(rate, depth) {
        if (this.generativeSound) {
            this.generativeSound.getParameter('modRate').set(rate);
            this.generativeSound.getParameter('modDepth').set(depth);
            this.generativeSound.updateParameter('modRate');
            this.generativeSound.updateParameter('modDepth');
        }
    }
    
    updateVolume(gain) {
        if (this.generativeSound) {
            this.generativeSound.getParameter('gain').set(gain);
            this.generativeSound.updateParameter('gain');
        }
    }
    
    destroy() {
        if (this.generativeSound) {
            this.generativeSound.destroy();
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}

// Example usage with HTML controls
async function setupAudioExample() {
    const example = new AudioExample();
    
    try {
        await example.initialize();
        
        // Setup UI controls
        document.getElementById('startBtn').onclick = () => example.start();
        document.getElementById('stopBtn').onclick = () => example.stop();
        
        document.getElementById('freqSlider').oninput = (e) => {
            example.updateFrequency(parseFloat(e.target.value));
        };
        
        document.getElementById('modRateSlider').oninput = (e) => {
            const modDepth = document.getElementById('modDepthSlider').value;
            example.updateModulation(parseFloat(e.target.value), parseFloat(modDepth));
        };
        
        document.getElementById('modDepthSlider').oninput = (e) => {
            const modRate = document.getElementById('modRateSlider').value;
            example.updateModulation(parseFloat(modRate), parseFloat(e.target.value));
        };
        
        document.getElementById('volumeSlider').oninput = (e) => {
            example.updateVolume(parseFloat(e.target.value));
        };
        
    } catch (error) {
        console.error('Failed to initialize audio example:', error);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', setupAudioExample);

/* 
Required HTML structure:

<button id="startBtn">Start Audio</button>
<button id="stopBtn">Stop Audio</button>

<label>Frequency: 
    <input type="range" id="freqSlider" min="80" max="1000" value="220" step="1">
</label>

<label>Modulation Rate: 
    <input type="range" id="modRateSlider" min="0.1" max="10" value="1.5" step="0.1">
</label>

<label>Modulation Depth: 
    <input type="range" id="modDepthSlider" min="0" max="1" value="0.3" step="0.01">
</label>

<label>Volume: 
    <input type="range" id="volumeSlider" min="0" max="1" value="0.5" step="0.01">
</label>
*/