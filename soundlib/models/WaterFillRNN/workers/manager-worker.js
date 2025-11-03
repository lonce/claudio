import * as ort from '/libs/ort.wasm.min.mjs';

ort.env.wasm.wasmPaths = '/libs/';
ort.env.wasm.numThreads = 1;

const RNN_WORKER_URL = '/soundlib/models/WaterFillRNN/workers/RNNWorker.js?cb=' + Date.now();

// mirrors what we set in the RNN worker
const NQ = 8;
const CHUNK_FRAMES = 32;           // decoder FIFO length
const HOP_FRAMES   = 8;            // 1 request = 8 RNN steps
const SAMPLES_PER_FRAME_24K = 320;
const TARGET_SR = 48000;

let rnnWorker = null;
let rnnReady = false;
let decodeSession = null;
let modelInfo = null;

// ring buffer of codes for decoding
const codeFifo = new Uint16Array(NQ * CHUNK_FRAMES);
let fifoWritePos = 0;

// helper to push 8 codes into FIFO
function fifoPushCodes(codes8) {
  for (let q = 0; q < NQ; q++) {
    codeFifo[q * CHUNK_FRAMES + fifoWritePos] = codes8[q];
  }
  fifoWritePos = (fifoWritePos + 1) % CHUNK_FRAMES;
}

function buildDecoderInputTensor() {
  const total = 1 * NQ * CHUNK_FRAMES;
  const arr = new BigInt64Array(total);
  let idx = 0n;

  // ✅ q-major → matches ONNX (1, n_q, T)
  for (let q = 0; q < NQ; q++) {
    for (let t = 0; t < CHUNK_FRAMES; t++) {
      const pos = (fifoWritePos + t) % CHUNK_FRAMES;   // time in ring
      const code = codeFifo[q * CHUNK_FRAMES + pos];   // we stored q-major
      arr[idx++] = BigInt(code);
    }
  }

  return arr;
}

// simple 2x upsampler
function upsample2xLinear(x24) {
  const N = x24.length;
  const out = new Float32Array(N * 2);
  for (let i = 0; i < N - 1; i++) {
    const a = x24[i];
    const b = x24[i + 1];
    out[2 * i]     = a;
    out[2 * i + 1] = 0.5 * (a + b);
  }
  out[out.length - 2] = x24[N - 1];
  out[out.length - 1] = x24[N - 1];
  return out;
}

async function initDecodeSession() {
  return await ort.InferenceSession.create('/onnx/encodec_decode.onnx', {
    executionProviders: ['wasm'],
  });
}

function toCondVector(x) {
  // strict but simple: accept number => [x]; array => Float32Array(x)
  if (typeof x === 'number') return new Float32Array([x]);
  if (Array.isArray(x) || ArrayBuffer.isView(x)) return new Float32Array(x);
  throw new Error('needHop.fillLevel must be number or array');
}

// we make a one-shot promise helper per RNN step
function rnnStepOnce(condValue) {
  console.log(`manager-worker: rnnStepOnce cond =`, condValue);
  return new Promise((resolve, reject) => {
    const listener = (ev) => {
      const msg = ev.data;
      if (!msg || !msg.type) return;

      if (msg.type === 'stepResult') {
        rnnWorker.removeEventListener('message', listener);
        resolve(msg);
      } else if (msg.type === 'error') {
        rnnWorker.removeEventListener('message', listener);
        reject(new Error(msg.error));
      }
    };
    rnnWorker.addEventListener('message', listener);
    rnnWorker.postMessage({ type: 'step', cond: condValue });
  });
}

// messages coming *from* RNN worker
function handleRnnMessage(ev) {
  const msg = ev.data;
  if (!msg || !msg.type) return;

  if (msg.type === 'ready') {
    rnnReady = true;
    modelInfo = msg.modelInfo;
    // tell main that the whole RNN side is ready
    self.postMessage({
      type: 'ready',
      info: 'RNN (via manager) ready',
      modelInfo,
    });
  }
  // we don't forward stepResult here — we await them in rnnStepOnce()
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (!msg || !msg.type) return;

  // 1) init: spawn RNN worker + load decoder
  if (msg.type === 'init') {
    console.log(`manager ---- git init`)
    if (!rnnWorker) {
      rnnWorker = new Worker(RNN_WORKER_URL, { type: 'module' });
      rnnWorker.onmessage = handleRnnMessage;
      rnnWorker.postMessage({ type: 'init' });
    }

    try {
      decodeSession = await initDecodeSession();
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) });
    }

    console.log(`manager ---- gpost manager-ready`)
    self.postMessage({ type: 'manager-ready' });
    return;
  }

  // 2) worklet (via main) is asking for audio
  if (msg.type === 'needHop') {
    if (!rnnReady || !decodeSession) {
      self.postMessage({ type: 'error', error: 'manager not fully ready' });
      return;
    }

    // STRICT: require fillLevel present
    if (msg.fillLevel === undefined) throw new Error('needHop missing fillLevel');

    const condVec = toCondVector(msg.fillLevel);
    for (let i = 0; i < HOP_FRAMES; i++) {
      const res = await rnnStepOnce(condVec);
      fifoPushCodes(res.codes);
    }


    // decode full chunk
    const codes3d = buildDecoderInputTensor();
    let decOut;
    try {
      decOut = await decodeSession.run({
        // your export used "codes_bnt"
        codes_bnt: new ort.Tensor('int64', codes3d, [1, NQ, CHUNK_FRAMES]),
      });
    } catch (err) {
      self.postMessage({ type: 'error', error: 'decode error: ' + err.message });
      return;
    }

    // figure out output name
    const audio24 =
      decOut.audio?.data ??
      decOut.audio_out?.data ??
      decOut['0']?.data;  // last resort
    if (!audio24) {
      self.postMessage({ type: 'error', error: 'unknown decode output name' });
      return;
    }

    // slice tail = 8 * 320 @24k = 2560
    const tail24 = audio24.slice(audio24.length - HOP_FRAMES * SAMPLES_PER_FRAME_24K);
    const hop48 = upsample2xLinear(tail24);

    self.postMessage(
      {
        type: 'audioHop',
        sr: TARGET_SR,
        samples: hop48,
      },
      [hop48.buffer]
    );

    return;
  }

  // else
  self.postMessage({ type: 'error', error: 'unknown msg: ' + msg.type });
};
