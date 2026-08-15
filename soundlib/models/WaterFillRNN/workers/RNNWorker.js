// workers/RNNWorker.js
// run as: new Worker('/workers/RNNWorker.js?cb=' + Date.now(), { type: 'module' })

import * as ort from '/libs/ort.wasm.min.mjs';

console.log(`[RNNWorker] - file loading`)

// tell ORT where the .wasm lives
ort.env.wasm.wasmPaths = '/libs/';
ort.env.wasm.numThreads = 1; // simple, good for dev

// -------------------- constants --------------------
// Water model-specific. If the ONNX export model changes later, update COND_DIM.
const COND_DIM = 1;

const CLAMP_VAL = 15.0;

// -------------------- worker state --------------------
let rnnSession = null;
let codebookTable = null;   // { data: Float32Array, n_q, K, D }
let lastHidden = null;      // Float32Array(num_layers * 1 * hidden_size)
let lastLatent = null;      // Float32Array(128)

let modelInfo = {
  n_q: 8,
  codebook_size: 1024,
  latent_dim: 128,
  hidden_size: 128,
  num_layers: 3,
};

// sampling params (outside-style, but we still do them here)
let sample_mode_outside = 'sample';
let top_k_outside = 8;
let temperature_outside = 1.0;



// ----------------------------------------------------
// helper: clamp + scale latents to [-1,1]
// ----------------------------------------------------
function clampAndScale128(lat) {
  const out = new Float32Array(128);
  const c = CLAMP_VAL;
  for (let i = 0; i < 128; i++) {
    let v = lat[i];
    if (v > c) v = c;
    else if (v < -c) v = -c;
    out[i] = v / c;
  }
  return out;
}

// ----------------------------------------------------
// f16 → f32 (for codebook .f16bin)
// ----------------------------------------------------
function f16Tof32(h) {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7C00) >> 10;
  const f = h & 0x03FF;
  if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  if (e === 0x1F) return f ? NaN : (s ? -1 : 1) * Infinity;
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}

// ----------------------------------------------------
// load codebook table (the precomputed one we exported from Py)
// produces a flat Float32Array of shape (n_q * K * D)
// ----------------------------------------------------
async function loadCodebookTable() {
  console.log(`[RNNWorker] - inside loadCodebookTable()`)
  const metaResp = await fetch('/artifacts/encodec24_codebooks.meta.json');
  const meta = await metaResp.json();

  const n_q = meta.n_q ?? meta.num_codebooks ?? meta.nq;
  const K   = meta.codebook_size ?? meta.K ?? meta.num_entries;
  const D   = meta.dim ?? meta.D ?? meta.latent_dim ?? meta.embedding_dim;

  if (!n_q || !K || !D) {
    console.error('[RNNWorker] bad meta.json', meta);
    throw new Error('codebook meta missing fields');
  }

  const binResp = await fetch('/artifacts/encodec24_codebooks.f16bin');
  const buf = await binResp.arrayBuffer();
  const view = new DataView(buf);
  const total = n_q * K * D;
  const arr = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    arr[i] = f16Tof32(view.getUint16(i * 2, true));
  }

  codebookTable = { data: arr, n_q, K, D };
  console.log('[RNNWorker] codebookTable loaded:', n_q, K, D);
}

// ----------------------------------------------------
// get latent for (q, idx) from table
// ----------------------------------------------------
function lookupLatent(q, idx) {
  if (!codebookTable) {
    throw new Error('codebookTable not loaded');
  }
  const { data, K, D } = codebookTable;
  const base = q * (K * D) + idx * D;
  const out = new Float32Array(D);
  for (let d = 0; d < D; d++) {
    out[d] = data[base + d];
  }
  return out;
}

// ----------------------------------------------------
// sampler from logits (top-k, temperature, argmax)
// logits: Float32Array(K)
// ----------------------------------------------------
function sampleFromLogits(logits, mode, temperature, top_k) {
  const K = logits.length;

  // top-k mask
  let mask = null;
  if (top_k && top_k > 0 && top_k < K) {
    const pairs = [];
    for (let i = 0; i < K; i++) pairs.push([logits[i], i]);
    pairs.sort((a, b) => b[0] - a[0]);
    mask = new Array(K).fill(false);
    for (let i = 0; i < top_k; i++) {
      mask[pairs[i][1]] = true;
    }
  }

  // argmax / temp=0
  if (mode === 'argmax' || temperature <= 0) {
    let best = -Infinity, bestIdx = 0;
    for (let i = 0; i < K; i++) {
      if (mask && !mask[i]) continue;
      if (logits[i] > best) {
        best = logits[i];
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  const t = Math.max(1e-6, temperature);

  // softmax
  let maxLogit = -Infinity;
  for (let i = 0; i < K; i++) {
    if (mask && !mask[i]) continue;
    if (logits[i] > maxLogit) maxLogit = logits[i];
  }

  let sum = 0;
  const probs = new Float32Array(K);
  for (let i = 0; i < K; i++) {
    if (mask && !mask[i]) {
      probs[i] = 0;
    } else {
      const v = Math.exp((logits[i] - maxLogit) / t);
      probs[i] = v;
      sum += v;
    }
  }
  for (let i = 0; i < K; i++) probs[i] /= sum;

  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < K; i++) {
    acc += probs[i];
    if (r <= acc) return i;
  }
  return K - 1;
}

// ----------------------------------------------------
// init RNN session
// ----------------------------------------------------
async function initRnnSession() {
  console.log(`[RNNWorker] - initRnnSession()`)
  const sess = await ort.InferenceSession.create(new URL('../onnx/rnn_step.onnx', import.meta.url).href, {
    executionProviders: ['wasm'],
  });
  return sess;
}

// ----------------------------------------------------
// handle init from manager
// ----------------------------------------------------
async function handleInit(msg) {
  console.log('[RNNWorker] handleInit() starting');

  rnnSession = await initRnnSession();
  console.log('[RNNWorker] rnnSession ready');

  await loadCodebookTable();

  // seed latent + hidden
  const latent_dim = modelInfo.latent_dim;
  lastLatent = new Float32Array(latent_dim);
  for (let i = 0; i < latent_dim; i++) {
    lastLatent[i] = (Math.random() * 2 - 1) * 0.2;
  }

  const num_layers = modelInfo.num_layers;
  const hidden_size = modelInfo.hidden_size;
  lastHidden = new Float32Array(num_layers * 1 * hidden_size); // zeros

  self.postMessage({
    type: 'ready',
    info: 'RNNWorker initialized',
    modelInfo: {
      n_q: codebookTable.n_q,
      codebook_size: codebookTable.K,
      latent_dim,
      hidden_size,
      num_layers,
    },
  });
}

// ----------------------------------------------------
// ONE STEP: run RNN, sample codes, build next latent, return
// ----------------------------------------------------
async function handleStep(msg) {
  if (!rnnSession || !codebookTable) {
    self.postMessage({ type: 'error', error: 'RNN or codebook not ready' });
    return;
  }

  const { n_q, codebook_size: K, latent_dim, hidden_size, num_layers } = modelInfo;

  let condVec = msg?.cond;
  if (!condVec) throw new Error('cond missing');
  if (Array.isArray(condVec)) condVec = Float32Array.from(condVec);
  if (!(condVec instanceof Float32Array)) {
    throw new Error('cond must be a Float32Array or plain array');
  }
  if (condVec.length !== COND_DIM) {
    throw new Error(`cond length ${condVec.length} != COND_DIM ${COND_DIM}`);
  }

  const latent_in = lastLatent ?? new Float32Array(128);
  const hidden_in = lastHidden ?? new Float32Array(num_layers * hidden_size);

  const feeds = {
    latent_in: new ort.Tensor('float32', latent_in, [1, latent_dim]),
    cond_in:   new ort.Tensor('float32', condVec,   [1, COND_DIM]),
    hidden_in: new ort.Tensor('float32', hidden_in, [num_layers, 1, hidden_size]),
  };


  const outs = await rnnSession.run(feeds);
  const logits_out       = outs['logits_out'].data;   // (n_q*K)
  const hidden_out       = outs['hidden_out'].data;   // (num_layers,1,hidden)
  const model_step_latent = outs['step_latent'].data; // (1,128) soft expectation

  lastHidden = hidden_out;

  // sample outside + build new latent to feed back
  const sampledCodes = new Array(n_q);
  const newLatent = new Float32Array(latent_dim);

  for (let q = 0; q < n_q; q++) {
    const offset = q * K;
    const slice = logits_out.subarray(offset, offset + K);
    const idx = sampleFromLogits(
      slice,
      sample_mode_outside,
      temperature_outside,
      top_k_outside,
    );
    sampledCodes[q] = idx;

    const lat_q = lookupLatent(q, idx);
    for (let d = 0; d < latent_dim; d++) {
      newLatent[d] += lat_q[d];
    }
  }

  // clamp + scale for next step
  lastLatent = clampAndScale128(newLatent);

  // send result back to manager
  self.postMessage({
    type: 'stepResult',
    codes: sampledCodes,
    latentPreview: Array.from(lastLatent.slice(0, 8)),
    modelLatentPreview: Array.from(model_step_latent.slice(0, 8)),
  });
}

// ----------------------------------------------------
// worker loop
// ----------------------------------------------------
self.onmessage = async (ev) => {
  const msg = ev.data;
  if (!msg || !msg.type) return;

  try {
    if (msg.type === 'init') {
      await handleInit(msg);
    } else if (msg.type === 'step') {
      await handleStep(msg);
    } else {
      self.postMessage({ type: 'error', error: `Unknown msg type: ${msg.type}` });
    }
  } catch (err) {
    console.error('[RNNWorker] Error:', err);
    self.postMessage({ type: 'error', error: String(err) });
  }
};
