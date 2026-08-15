
import * as ort from '/libs/ort.wasm.min.mjs';


import { WSincResampler, upsample2xLinear } from '/utils/resampler.js';

ort.env.wasm.wasmPaths = '/libs/';
ort.env.wasm.numThreads = 1;

const RNN_WORKER_URL = new URL('./RNNWorker.js', import.meta.url).href + '?cb=' + Date.now();

// mirrors RNN worker settings
const NQ = 8;
const CHUNK_FRAMES = 32;            // decoder FIFO length
const HOP_FRAMES   = 8;             // 1 request = 8 RNN steps
const SAMPLES_PER_FRAME_24K = 320;

let TARGET_SR = 48000;

let resampler=null // get resampler from utils/ after we get the SR from BaseSound
let rnnWorker = null;
let rnnReady = false;
let decodeSession = null;
let modelInfo = null;

// --- pending first hop (with conditioning vector) ---
let pendingHop = false;
let pendingCondVec = null;

// ring buffer of codes for decoding
const codeFifo = new Uint16Array(NQ * CHUNK_FRAMES);
let fifoWritePos = 0;

// push 8 codes → FIFO (q-major)
function fifoPushCodes(codes8) {
  for (let q = 0; q < NQ; q++) {
    codeFifo[q * CHUNK_FRAMES + fifoWritePos] = codes8[q];
  }
  fifoWritePos = (fifoWritePos + 1) % CHUNK_FRAMES;
}

// build [1, NQ, CHUNK_FRAMES] (q-major, time in second axis)
function buildDecoderInputTensor() {
  const total = 1 * NQ * CHUNK_FRAMES;
  const arr = new BigInt64Array(total);
  let idx = 0n;
  for (let q = 0; q < NQ; q++) {
    for (let t = 0; t < CHUNK_FRAMES; t++) {
      const pos = (fifoWritePos + t) % CHUNK_FRAMES;
      const code = codeFifo[q * CHUNK_FRAMES + pos];
      arr[idx++] = BigInt(code);
    }
  }
  return arr;
}


// decode session (shared, from root)
async function initDecodeSession() {
  return await ort.InferenceSession.create('/onnx/encodec_decode.onnx', {
    executionProviders: ['wasm'],
  });
}

// normalize conditioning → Float32Array
function toCondVector(x) {
  if (typeof x === 'number') return new Float32Array([x]);
  if (Array.isArray(x) || ArrayBuffer.isView(x)) return new Float32Array(x);
  throw new Error('needHop.fillLevel must be number or array');
}

// one RNN step (await a stepResult)
function rnnStepOnce(condVec) {
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
    rnnWorker.postMessage({ type: 'step', cond: condVec });
  });
}

// flush a queued hop once both RNN+decoder ready
function tryFlushPendingHop() {
  if (pendingHop && rnnReady && decodeSession) {
    const fill = pendingCondVec ?? new Float32Array([0.5]);
    pendingHop = false;
    pendingCondVec = null;
    // schedule on next tick via our own onmessage handler to reuse logic
    setTimeout(() => {
      self.onmessage({ data: { type: 'needHop', fillLevel: fill } });
    }, 0);
  }
}

// RNN worker → manager
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
    // if a hop was requested early and decoder is ready, flush it
    tryFlushPendingHop();
  }
  // stepResult is consumed by rnnStepOnce()
}

// main/worklet → manager
self.onmessage = async (ev) => {

  const msg = ev.data;
  if (!msg || !msg.type) return;

  // --- init: spawn RNN, start decoder init, announce manager-ready ---
  if (msg.type === 'init') {
    console.log(`received init in manager - set target sr`)
    if (typeof msg.targetSr === 'number') TARGET_SR = msg.targetSr|0;
    console.log(`TARGET_SR = ${TARGET_SR}`)

    if (!rnnWorker) {
      rnnWorker = new Worker(RNN_WORKER_URL, { type: 'module' });
      rnnWorker.onmessage = handleRnnMessage;
    }
    self.postMessage({ type: 'manager-ready' });


    // decode init (non-blocking)
    initDecodeSession()
      .then((sess) => {
        decodeSession = sess;
        // can halve taps and phases for speed at the expense of quality
        console.log(`now go and get your resampler`)
        resampler = new WSincResampler(24000, TARGET_SR, { taps: 32, phases: 1024 });
        console.log(`**************now we have the  resampler`)
        // if a hop was requested early and RNN is ready, flush it
        tryFlushPendingHop();
      })
      .catch((err) => self.postMessage({ type: 'error', error: String(err) }));

    // forward init to RNN
    rnnWorker.postMessage({ type: 'init' });
    return;
  }

  // --- worklet asks for one hop of audio (with conditioning vector) ---
  if (msg.type === 'needHop') {
    // store the requested cond for pending flush
    try {
      pendingCondVec = toCondVector(msg.fillLevel);
    } catch (e) {
      self.postMessage({ type: 'error', error: String(e) });
      return;
    }

    // if not fully ready yet, queue and return quietly
    if (!rnnReady || !decodeSession) {
      pendingHop = true;
      return;
    }

    // collect HOP_FRAMES codes
    for (let i = 0; i < HOP_FRAMES; i++) {
      const res = await rnnStepOnce(pendingCondVec);
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

    const audio24 =
      decOut.audio?.data ??
      decOut.audio_out?.data ??
      decOut['0']?.data;
    if (!audio24) {
      self.postMessage({ type: 'error', error: 'unknown decode output name' });
      return;
    }

    // tail = HOP_FRAMES * 320 @24k = 2560
    const tail24 = audio24.slice(audio24.length - HOP_FRAMES * SAMPLES_PER_FRAME_24K);
    // resample to TARGET_SR
    const hopDst = resampler ? resampler.process(tail24)
                         : upsample2xLinear(tail24); // fallback

    self.postMessage(
      { type: 'audioHop', sr: TARGET_SR, samples: hopDst },
      [hopDst.buffer]
    );
    return;
  }

  // unknown
  self.postMessage({ type: 'error', error: 'unknown msg: ' + msg.type });
};
