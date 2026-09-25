// Records the app's actual audio output (whatever the user hears, post
// master-gain mixing) via a toggle button, then lets the user save it as
// either a compressed file (MediaRecorder's own best-supported format) or
// a true lossless WAV at the native sample rate/channel count the sound
// models actually produce.
//
// Two parallel taps on audioSystem.masterGainNode, both only connected
// while actively recording:
//   1. A MediaRecorder tap (compressed, e.g. webm/opus) -- simple, small
//      files, good enough for most uses.
//   2. A raw-PCM tap via wavCaptureProcessor.js (an AudioWorkletNode) --
//      forwards every render quantum's exact samples to this module,
//      which accumulates them and can losslessly encode a WAV file from
//      them. MediaRecorder's own output can't be used for this since its
//      compression is lossy -- decoding it back wouldn't be "native."

const MIME_TYPE_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

function pickMimeType() {
    for (const candidate of MIME_TYPE_CANDIDATES) {
        if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    }
    return ''; // let the browser pick its own default
}

function extensionForMimeType(mimeType) {
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('ogg')) return 'ogg';
    return 'bin';
}

function defaultFileName(soundName) {
    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    const safeSoundName = (soundName || 'recording').replace(/\s+/g, '');
    const mmdd = `${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
    const hhmmss = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
    return `${safeSoundName}-${mmdd}-${hhmmss}`;
}

// Encodes accumulated per-channel Float32 sample chunks as a standard
// 16-bit PCM WAV file at the given sample rate. channelChunks is an array
// (one entry per channel) of arrays of Float32Array blocks, in the order
// they arrived from the capture worklet.
function encodeWav(channelChunks, sampleRate) {
    const numChannels = channelChunks.length;
    if (numChannels === 0) return null;

    const channelData = channelChunks.map((chunks) => {
        const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
        const merged = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }
        return merged;
    });
    // Channels can end up with slightly different lengths at block
    // boundaries -- trim to the shortest so interleaving stays in sync.
    const frameCount = Math.min(...channelData.map((c) => c.length));

    const pcm = new Int16Array(frameCount * numChannels);
    for (let i = 0; i < frameCount; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
            pcm[i * numChannels + ch] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }
    }

    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = pcm.length * bytesPerSample;
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const writeString = (offset, str) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // byte rate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    return new Blob([header, pcm], { type: 'audio/wav' });
}

// Downloads a blob via the same pattern SavePresetDialog.js uses --
// proven to work cross-browser/mobile.
function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

function showSavePanel(soundName, compressedBlob, compressedMimeType, wavBlob) {
    // A native <dialog> (matching MotionPermission.js's existing pattern)
    // pops up as a real modal instead of extending the page's own layout,
    // and needs no browser permission -- it's a plain HTML5 element.
    const panel = document.createElement('dialog');
    panel.className = 'record-save-panel';

    const heading = document.createElement('div');
    heading.textContent = 'Save recording';
    heading.style.fontWeight = 'bold';
    heading.style.marginBottom = '4px';
    panel.appendChild(heading);

    const nameLabel = document.createElement('label');
    nameLabel.style.display = 'block';
    nameLabel.textContent = 'File name:';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = defaultFileName(soundName);
    nameInput.style.width = '100%';
    nameLabel.appendChild(nameInput);
    panel.appendChild(nameLabel);

    const formatLabel = document.createElement('label');
    formatLabel.style.display = 'block';
    formatLabel.style.marginTop = '4px';
    formatLabel.textContent = 'Format:';
    const formatSelect = document.createElement('select');
    formatSelect.style.width = '100%';

    const compressedOption = document.createElement('option');
    compressedOption.value = 'compressed';
    compressedOption.textContent = `Compressed (${compressedMimeType || 'browser default'})`;
    formatSelect.appendChild(compressedOption);

    const wavOption = document.createElement('option');
    wavOption.value = 'wav';
    wavOption.textContent = 'WAV (16-bit PCM, native quality)';
    formatSelect.appendChild(wavOption);

    formatLabel.appendChild(formatSelect);
    panel.appendChild(formatLabel);

    const buttonRow = document.createElement('div');
    buttonRow.style.marginTop = '6px';

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.addEventListener('click', () => {
        const baseName = nameInput.value.trim().replace(/\s+/g, '_') || defaultFileName(soundName);
        if (formatSelect.value === 'wav') {
            if (wavBlob) downloadBlob(wavBlob, `${baseName}.wav`);
        } else if (compressedBlob) {
            downloadBlob(compressedBlob, `${baseName}.${extensionForMimeType(compressedMimeType)}`);
        }
        panel.close();
    });
    buttonRow.appendChild(saveButton);

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => panel.close());
    buttonRow.appendChild(cancelButton);

    panel.appendChild(buttonRow);
    // Removes the element on any close path -- Save, Cancel, or the
    // Escape key (built into <dialog>, which the old in-page div had no
    // equivalent for).
    panel.addEventListener('close', () => panel.remove());
    document.body.appendChild(panel);
    panel.showModal();
}

export async function initAudioRecorder(audioSystem, button, getCurrentSoundName) {
    if (typeof MediaRecorder === 'undefined' || typeof AudioWorkletNode === 'undefined') {
        button.disabled = true;
        button.title = 'Recording is not supported in this browser.';
        return;
    }

    await audioSystem.context.audioWorklet.addModule('./wavCaptureProcessor.js');

    // Keeps the raw-PCM capture worklet in the actively-rendered graph --
    // some browsers stop calling process() on a worklet with no path to
    // destination, even though this one's own output is never audible.
    const silentGainNode = audioSystem.context.createGain();
    silentGainNode.gain.value = 0;
    silentGainNode.connect(audioSystem.context.destination);

    let isRecording = false;
    let mediaRecorder = null;
    let recDest = null;
    let wavWorkletNode = null;
    let compressedChunks = [];
    let channelChunks = []; // one array of Float32Array blocks per channel

    function startRecording() {
        audioSystem.resume();

        recDest = audioSystem.context.createMediaStreamDestination();
        audioSystem.masterGainNode.connect(recDest);
        compressedChunks = [];
        const mimeType = pickMimeType();
        mediaRecorder = new MediaRecorder(recDest.stream, mimeType ? { mimeType } : undefined);
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) compressedChunks.push(event.data);
        };
        mediaRecorder.onerror = (event) => {
            console.error('Recording error:', event.error);
            resetToIdle();
        };
        mediaRecorder.start();

        wavWorkletNode = new AudioWorkletNode(audioSystem.context, 'wav-capture-processor');
        wavWorkletNode.connect(silentGainNode);
        audioSystem.masterGainNode.connect(wavWorkletNode);
        channelChunks = [];
        wavWorkletNode.port.onmessage = (event) => {
            const { channels } = event.data;
            channels.forEach((data, i) => {
                if (!channelChunks[i]) channelChunks[i] = [];
                channelChunks[i].push(data);
            });
        };

        isRecording = true;
        button.textContent = '■ Stop';
        button.classList.add('recording');
    }

    function resetToIdle() {
        isRecording = false;
        button.textContent = '● Record';
        button.classList.remove('recording');
    }

    function stopRecording() {
        audioSystem.masterGainNode.disconnect(recDest);
        audioSystem.masterGainNode.disconnect(wavWorkletNode);
        wavWorkletNode.disconnect(); // detach from silentGainNode too, so it can be freed

        const wavBlob = encodeWav(channelChunks, audioSystem.context.sampleRate);
        const mimeType = mediaRecorder.mimeType;

        mediaRecorder.onstop = () => {
            const compressedBlob = new Blob(compressedChunks, { type: mimeType });
            showSavePanel(getCurrentSoundName?.(), compressedBlob, mimeType, wavBlob);
        };
        mediaRecorder.stop();

        resetToIdle();
    }

    button.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });
}
