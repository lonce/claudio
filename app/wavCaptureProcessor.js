// Tiny analysis-only AudioWorkletProcessor: forwards each render quantum's
// raw input samples to the main thread, unchanged. Deliberately does no
// buffering/accumulation here -- that logic lives once, in AudioRecorder.js
// -- so this file stays trivial. Used to build a true lossless WAV file at
// the app's native sample rate/channel count, alongside the (lossy)
// MediaRecorder-based recording AudioRecorder.js also makes.
class WavCaptureProcessor extends AudioWorkletProcessor {
    process(inputs) {
        const input = inputs[0];
        if (input.length > 0) {
            // Copy before transferring -- the spec reuses these
            // Float32Arrays across render quanta, so the originals can't
            // be handed off directly.
            const channels = input.map((channelData) => new Float32Array(channelData));
            this.port.postMessage({ channels }, channels.map((c) => c.buffer));
        }
        return true;
    }
}

registerProcessor('wav-capture-processor', WavCaptureProcessor);
