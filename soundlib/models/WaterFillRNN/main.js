let audioCtx;
let workletNode;
let manager;
let managerReady = false;
let rnnReady = false;

async function startAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  console.log('audioContext is', audioCtx);

  // 1) load worklet
  await audioCtx.audioWorklet.addModule('/worklets/WaterFillRNNWorklet.js');
  console.log('added the worklet module');

  // 2) create worklet node
  workletNode = new AudioWorkletNode(audioCtx, 'water-fill-rnn', {
    processorOptions: {
      sampleRate: audioCtx.sampleRate,
    },
  });
  console.log('workletNode is', workletNode);

  // 3) connect to output
  const gain = audioCtx.createGain();
  gain.gain.value = 1.0;
  workletNode.connect(gain).connect(audioCtx.destination);

  // 4) create manager worker
  manager = new Worker('/workers/manager-worker.js?cb=' + Date.now(), {
    type: 'module',
  });

  // manager → main
  manager.onmessage = (ev) => {
    const msg = ev.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'manager-ready') {
      console.log('[main] manager ready');
      managerReady = true;
      return;
    }

    if (msg.type === 'ready') {
      console.log('[main] RNN (via manager) says ready, modelInfo:', msg.modelInfo);
      rnnReady = true;

      // 👇 PRIME THE PIPELINE ONCE
      manager.postMessage({
        type: 'needHop',
        fillLevel: 0.5,   // or whatever
      });

      return;
    }

    if (msg.type === 'audioHop') {
      // push to worklet
      workletNode.port.postMessage({
        type: 'audioHop',
        samples: msg.samples,
        sr: msg.sr,
      }, [msg.samples.buffer]);
      return;
    }

    if (msg.type === 'error') {
      console.warn('[main] worker error:', msg.error);
    }
  };

  // worklet → main
  workletNode.port.onmessage = (ev) => {
    const msg = ev.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'needHop') {
      // only forward if both ends are ready
      if (managerReady && rnnReady) {
        manager.postMessage({
          type: 'needHop',
          fillLevel: msg.fillLevel ?? 0.5,
        });
      }
    }
  };

  // finally, tell manager to init (it will spawn the RNN worker)
  manager.postMessage({ type: 'init' });
}

document.addEventListener('click', () => {
  if (!audioCtx || audioCtx.state !== 'running') {
    startAudio().catch(console.error);
  }
  // resume if needed
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
});

console.log('main.js: starting test');
