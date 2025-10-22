// AudioGenerator.js - FM synthesis with phase continuity
class AudioGenerator {
    constructor(centerFreq = 440, modRate = 2, modDepth = 0.5, sampleRate = 44100) {
        this.centerFreq = centerFreq;      // Base frequency in Hz
        this.modRate = modRate;            // Modulation rate in Hz  
        this.modDepth = modDepth;          // Modulation depth (0.0 to 1.0)
        this.sampleRate = sampleRate;
        
        // Phase state - crucial for continuity between getNextHop() calls
        this.carrierPhase = 0;
        this.modulatorPhase = 0;
        
        // Pre-calculate phase increments
        this.updatePhaseIncrements();
    }
    
    updateParameters(centerFreq, modRate, modDepth) {
        this.centerFreq = centerFreq;
        this.modRate = modRate;
        this.modDepth = modDepth;
        this.updatePhaseIncrements();
    }
    
    updatePhaseIncrements() {
        this.modulatorPhaseIncrement = (2 * Math.PI * this.modRate) / this.sampleRate;
    }
    
    getNextHop(numFrames) {
        const numSamples = numFrames * 128; // Each frame is 128 samples
        const audioData = new Float32Array(numSamples);
        
        for (let i = 0; i < numSamples; i++) {
            // Generate modulator (sine wave for frequency modulation)
            const modulator = Math.sin(this.modulatorPhase);
            this.modulatorPhase += this.modulatorPhaseIncrement;
            
            // Calculate instantaneous frequency
            const instantFreq = this.centerFreq * (1 + this.modDepth * modulator);
            const carrierPhaseIncrement = (2 * Math.PI * instantFreq) / this.sampleRate;
            
            // Generate carrier with modulated frequency
            audioData[i] = Math.sin(this.carrierPhase) * 0.5; // Scale amplitude
            this.carrierPhase += carrierPhaseIncrement;
        }
        
        // Keep phases in reasonable range to prevent numerical issues
        this.carrierPhase = this.carrierPhase % (2 * Math.PI);
        this.modulatorPhase = this.modulatorPhase % (2 * Math.PI);
        
        return audioData;
    }
    
    reset() {
        this.carrierPhase = 0;
        this.modulatorPhase = 0;
    }
}