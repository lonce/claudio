// WorkerFM.js - BaseSound subclass with threaded audio generation
import { BaseSound } from '../BaseSound.js';

export class WorkerFM extends BaseSound {
    static WORKLET_PATH = '/soundlib/models/WorkerFM/worklets/generativeAudioProcessor.js';
    static WORKER_PATH = '/soundlib/models/WorkerFM/workers/generative-audio-worker.js';

    constructor(context, name, config = {}) {
        super(context, name);
        
        // Configuration
        this.lookaheadFrames = config.lookaheadFrames || 4;
        
        // Add parameters for FM synthesis
        this.addParameter('centerFreq', config.centerFreq || 440, 20, 20000);
        this.addParameter('modRate', config.modRate || 2, 0.1, 20);
        this.addParameter('modDepth', config.modDepth || 0.5, 0, 1);
        
        // Threading components
        this.worker = null;
        this.workletNode = null;
        this.gainNode = null;
        
        // State
        this.isInitialized = false;
        this.initializationPromise = null;
        
        this.createNodes();
    }

    async createNodes() {
        if (!this.workletNode) {
            try {
                // Create Web Worker for audio generation
                this.worker = new Worker(WorkerFM.WORKER_PATH);
                this.setupWorkerCommunication();
                
                // Create AudioWorkletNode
                this.workletNode = new AudioWorkletNode(this.context, 'generativeAudioProcessor', {
                    processorOptions: { 
                        sampleRate: this.context.sampleRate,
                        lookaheadFrames: this.lookaheadFrames
                    }
                });
                
                this.setupWorkletCommunication();
                
                // Create gain node for volume control
                this.gainNode = this.context.createGain();
                this.workletNode.connect(this.gainNode);
                this.outputNode = this.gainNode;

                // Initialize parameters
                this.workletNode.parameters.get('active').setValueAtTime(0, this.context.currentTime);
                this.gainNode.gain.setValueAtTime(0, this.context.currentTime);
                
                // Update all parameters
                this.updateAllParameters();
                
                // Wait for initialization
                await this.waitForInitialization();
                
            } catch (error) {
                console.error('Failed to create generative audio nodes:', error);
                throw error;
            }
        }
    }
    
    setupWorkerCommunication() {
        this.worker.onmessage = (event) => {
            const { action, data } = event.data;
            
            switch (action) {
                case 'initialized':
                    this.isInitialized = true;
                    console.log(`${this.name}: Audio generator initialized`);
                    break;
                    
                case 'audioGenerated':
                    // Forward audio data to worklet
                    if (this.workletNode) {
                        this.workletNode.port.postMessage({
                            action: 'audioData',
                            audioData: data.audioData
                        });
                    }
                    break;
                    
                default:
                    console.log(`${this.name}: Worker message:`, action, data);
            }
        };
        
        this.worker.onerror = (error) => {
            console.error(`${this.name}: Worker error:`, error);
        };
    }
    
    setupWorkletCommunication() {
        this.workletNode.port.onmessage = (event) => {
            const { action, data } = event.data;
            
            switch (action) {
                case 'initialize':
                    // Forward initialization request to worker
                    this.worker.postMessage({
                        action: 'initialize',
                        data: data
                    });
                    break;
                    
                case 'bufferStatus':
                    // Forward buffer status to worker
                    this.worker.postMessage({
                        action: 'bufferStatus',
                        data: data
                    });
                    break;
                    
                case 'parameterUpdate':
                    // Forward parameter updates to worker
                    this.worker.postMessage({
                        action: 'updateParameters',
                        data: data
                    });
                    break;
                    
                default:
                    console.log(`${this.name}: Worklet message:`, action, data);
            }
        };
    }
    
    waitForInitialization() {
        if (this.isInitialized) {
            return Promise.resolve();
        }
        
        if (!this.initializationPromise) {
            this.initializationPromise = new Promise((resolve, reject) => {
                const checkInit = () => {
                    if (this.isInitialized) {
                        resolve();
                    } else {
                        setTimeout(checkInit, 50);
                    }
                };
                
                checkInit();
                
                // Timeout after 5 seconds
                setTimeout(() => {
                    if (!this.isInitialized) {
                        reject(new Error('Audio generator initialization timeout'));
                    }
                }, 5000);
            });
        }
        
        return this.initializationPromise;
    }

    async startSound() {
        await this.waitForInitialization();
        
        if (this.workletNode && this.gainNode) {
            //console.log(`${this.name}: Starting generative sound`);
            
            // Activate worklet
            this.workletNode.parameters.get('active').setValueAtTime(1, this.context.currentTime);
            
            // Start worker
            this.workletNode.port.postMessage({ action: 'start' });
            
            // Apply gain envelope
            this.scheduleAttack(this.gainNode);
            this.startTime = this.context.currentTime;
        }
    }

    stopSound(onReleased) {
        this.scheduleDecay(this.gainNode, () => {
            if (this.workletNode) {
                //console.log(`${this.name}: Stopping generative sound`);
                
                // Deactivate worklet
                this.workletNode.parameters.get('active').setValueAtTime(0, this.context.currentTime);
                
                // Stop worker
                this.workletNode.port.postMessage({ action: 'stop' });
            }
            
            if (typeof onReleased === 'function') {
                onReleased();
            }
        });
    }

    updateParameter(name) {
        const param = this.getParameter(name);
        const now = this.context.currentTime;

        if (['centerFreq', 'modRate', 'modDepth'].includes(name) && this.workletNode) {
            // Update worklet parameter - it will forward to worker
            this.workletNode.parameters.get(name).setValueAtTime(param.get(), now);
            
        } else if (name === 'gain') {
            if (this.inDecaySegment) {
                console.log("Ignoring gain update during decay.");
                return;
            }
            if (this.inAttackSegment) {
                this.updateGainDuringAttack(this.gainNode, param.get(), this.startTime, param.attackTime);
            } else {
                this.gainNode.gain.setTargetAtTime(param.get(), now, 0.05);
            }
        }
    }
    
    updateAllParameters() {
        ['centerFreq', 'modRate', 'modDepth', 'gain'].forEach(name => {
            this.updateParameter(name);
        });
    }

    connect(destination) {
        super.connect(destination);
        if (this.gainNode && this.destination) {
            this.gainNode.connect(this.destination);
        }
    }

    disconnect() {
        if (this.gainNode && this.destination) {
            this.gainNode.disconnect(this.destination);
        }
        super.disconnect();
    }

    destroy() {
        super.destroy();
        
        // Clean up worker
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        
        // Clean up audio nodes
        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        
        this.isInitialized = false;
        this.initializationPromise = null;
    }
}