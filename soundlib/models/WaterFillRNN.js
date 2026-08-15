// WaterFillRNN.js - BaseSound subclass with threaded audio generation
import { BaseSound } from '../BaseSound.js';


export class WaterFillRNN extends BaseSound {
    static WORKLET_PATH = new URL('./WaterFillRNN/worklets/WaterFillRNNWorklet.js', import.meta.url).href;
    static WORKER_PATH = new URL('./WaterFillRNN/workers/manager-worker.js', import.meta.url).href;

    constructor(context, name, config = {}) {
        super(context, name);

        // State
        this.managerReady = false;
        this.rnnReady = false;
        
        // Configuration
        this.lookaheadFrames = config.lookaheadFrames || 4;
        
        // Add parameters for FM synthesis
        this.addParameter('fillLevel', config.fillLevel || 0, 0, 1);

        
        // Threading components
        this.manager = null;
        this.workletNode = null;
        this.gainNode = null;
        
        
        // the readiness promise we expose
        this.readyPromise = new Promise((resolve) => {
            this._resolveReady = resolve;
        });

        this.createNodes();
    }

    async createNodes() {
        if (!this.workletNode) {
            try {
                // Create Web Worker for audio generation
                let tempstr=WaterFillRNN.WORKER_PATH + '?cb=' 
                console.log(`about to create new Worker with string = ${tempstr}`)

                this.manager = new Worker(tempstr + Date.now(), {type: 'module'});
 

                this.setupWorkerCommunication();
                console.log(`---- send init to manager`)
                console.log(`context.sampleRate = ${this.context.sampleRate}`)
                console.log(`this.manager = ${this.manager}`)
                this.manager.postMessage({ type: 'init', targetSr: this.context.sampleRate });


                console.log(`---- create workletNode`)
                // Create AudioWorkletNode
                this.workletNode = new AudioWorkletNode(this.context, 'water-fill-rnn', {
                    processorOptions: {
                      sampleRate: this.context.sampleRate,
                    },
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
        this.manager.onmessage = (ev) => {
            const msg = ev.data;
            if (!msg || !msg.type) return;

            if (msg.type === 'manager-ready') {
              this.managerReady = true;
              console.log(`WaterFillRNN: Manager is READY!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
              this._maybeResolveReady();
              return;
            }

            if (msg.type === 'ready') {
              console.log('[main] RNN (via manager) says ready, modelInfo:', msg.modelInfo);
              this.rnnReady = true;
              console.log(`WaterFillRNN: RNN is READY!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! with modelInfo: ${msg.modelInfo}`)
              this._maybeResolveReady();

              // 👇 PRIME THE PIPELINE ONCE
              this.manager.postMessage({
                type: 'needHop',
                fillLevel: 0.5,   // or whatever
              });

              return;
            }

            if (msg.type === 'audioHop') {
              if (this.workletNode) {
                this.workletNode.port.postMessage(
                  { type: 'audioHop', samples: msg.samples, sr: msg.sr },
                  [msg.samples.buffer]
                );
              }
              return;
            }

            if (msg.type === 'error') {
              console.warn('[main] worker error:', msg.error);
            }
        };
    }
    
    setupWorkletCommunication() {
        this.workletNode.port.onmessage = (ev) => {
            const msg = ev.data;
            if (!msg || !msg.type) return;

            if (msg.type === 'needHop') {
              // only forward if both ends are ready
              if (this.managerReady && this.rnnReady) {
                this.manager.postMessage({
                  type: 'needHop',
                  fillLevel: msg.fillLevel ?? 0.5,
                });
              }
            }
          };
    }

    _maybeResolveReady() {
      if (this.managerReady && this.rnnReady && this._resolveReady) {
        this._resolveReady();
        this._resolveReady = null; // avoid double-resolve
      }
    }

    waitForInitialization() {
      return this.readyPromise;
    }


    async startSound() {
        console.log(`WaterFillRNN: got a startSound request`)
        await this.waitForInitialization();
        console.log(`WaterFillRNN: returned from this.waitForInitialization()`)
        
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

        if (['fillLevel'].includes(name) && this.workletNode) {
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
        ['fillLevel', 'gain'].forEach(name => {
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
        if (this.manager) {
            this.manager.terminate();
            this.manager = null;
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