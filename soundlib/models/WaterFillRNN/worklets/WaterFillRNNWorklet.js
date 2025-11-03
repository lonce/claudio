class WaterFillRNNWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'active',
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
      {
        name: 'fillLevel',   // user / RNN conditioning param
        defaultValue: 0.5,
        minValue: 0.0,
        maxValue: 1.0,
        automationRate: 'k-rate',
      },
    ];
  }

  constructor(options) {
    super();

    const cfg = options.processorOptions || {};
    this.contextSr = cfg.sampleRate || 48000;

    // you wanted ~16 RNN *steps* worth in the ring buffer:
    // 1 RNN step = 320 @24k → 640 @48k
    // 16 steps  → 16 * 640 = 10,240
    this.bufferSize = 10240;
    this.buffer = new Float32Array(this.bufferSize);
    this.writePtr = 0;
    this.readPtr = 0;
    this.available = 0;

    this.lowWater = this.bufferSize >> 1;   // 5120
    this.requested = false;                 // true while we’re waiting for an audioHop

    // accept audio from main → manager → worker
    this.port.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || !msg.type) return;

      if (msg.type === 'audioHop') {
        const samp = msg.samples;
        // push into ring
        for (let i = 0; i < samp.length; i++) {
          this.buffer[this.writePtr] = samp[i];
          this.writePtr = (this.writePtr + 1) % this.bufferSize;
          if (this.available < this.bufferSize) {
            this.available++;
          } else {
            // overwrite oldest
            this.readPtr = (this.readPtr + 1) % this.bufferSize;
          }
        }
        // we got data → we're allowed to request again later
        this.requested = false;
      }
    };

    // kick it once so manager can pre-fill
    this.port.postMessage({ type: 'needHop', fillLevel: 0.5 });
    this.requested = true;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const ch0 = output[0];

    const activeArr = parameters.active;
    const fillArr = parameters.fillLevel;

    // We expect k-rate here, so length === 1
    const active = activeArr[0] !== 0;
    const fill = fillArr[0];

    if (!active) {
      ch0.fill(0);
      return true;
    }

    // write 128 samples to output from our ring buffer
    for (let i = 0; i < ch0.length; i++) {
      if (this.available > 0) {
        ch0[i] = this.buffer[this.readPtr];
        this.readPtr = (this.readPtr + 1) % this.bufferSize;
        this.available--;
      } else {
        ch0[i] = 0;
      }
    }

    // if we’re running low, ask main → manager for exactly one hop
    if (!this.requested && this.available < this.lowWater) {
      this.requested = true;
      this.port.postMessage({
        type: 'needHop',
        fillLevel: fill,   // pass current param through
      });
    }

    return true;
  }
}

registerProcessor('water-fill-rnn', WaterFillRNNWorklet);
