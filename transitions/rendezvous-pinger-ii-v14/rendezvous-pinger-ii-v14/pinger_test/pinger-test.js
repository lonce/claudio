import {
    CHORD_NAMES,
    TransitionPinger
} from '../soundModels/RendezvousPinger/_TransitionPinger.js';

const startButton = document.querySelector('#start');
const transitionButton = document.querySelector('#transition');
const stopButton = document.querySelector('#stop');
const chordSelect = document.querySelector('#chord');
const status = document.querySelector('#status');
const received = document.querySelector('#received');
const dropped = document.querySelector('#dropped');
const latency = document.querySelector('#latency');

let context;
let pinger;
let statsTimer;

function refreshStats() {
    if (!pinger || !context) return;
    const stats = pinger.getTimingStats();
    received.textContent = stats.received;
    dropped.textContent = stats.dropped;

    if (stats.lastTiming) {
        latency.textContent =
            `${stats.lastTiming.notificationDelayMs.toFixed(2)} ms`;
    }
}

chordSelect.addEventListener('change', () => {
    pinger?.setParameter('chord', Number(chordSelect.value));
    status.textContent =
        `${CHORD_NAMES[Number(chordSelect.value)]} selected for future Pings.`;
});

startButton.addEventListener('click', async () => {
    startButton.disabled = true;
    status.textContent = 'Loading timing worklet…';

    context = new AudioContext();
    await context.audioWorklet.addModule(TransitionPinger.WORKLET_PATH);
    pinger = new TransitionPinger(context, 'transition-pinger-test', {
        poolSize: 8,
        rootFrequency: 220,
        pingGateSeconds: 0.08,
        pingDecaySeconds: 0.25,
        processorOptions: {
            initialRate: 0.75,
            initialPhase: 0
        }
    });

    pinger.connect(context.destination);
    pinger.setParameter('gain', 0.55);
    pinger.setParameter('chord', Number(chordSelect.value));
    await context.resume();
    pinger.play();

    statsTimer = setInterval(refreshStats, 100);
    transitionButton.disabled = false;
    stopButton.disabled = false;
    status.textContent = 'Running at 0.75 Hz, phase 0.';
});

transitionButton.addEventListener('click', () => {
    pinger.setParameter('freq', 1.25);
    pinger.setParameter('phase', 0.5);
    pinger.setParameter('transition_dur', 5);
    pinger.event('transition');

    transitionButton.disabled = true;
    status.textContent = 'Transitioning to 1.25 Hz, phase 0.5…';
    setTimeout(() => {
        if (pinger) status.textContent = 'Transition complete.';
    }, 5000);
});

stopButton.addEventListener('click', async () => {
    clearInterval(statsTimer);
    transitionButton.disabled = true;
    stopButton.disabled = true;
    status.textContent = 'Draining already-started Pings…';

    // Keep the AudioContext alive until the parent's meta-release callback
    // confirms that every child completed its gate, decay, and node cleanup.
    if (pinger?.isPlaying) {
        await new Promise((resolve) => pinger.stop(resolve));
    }
    if (context && context.state !== 'closed') await context.close();
    pinger = null;
    context = null;
    startButton.disabled = false;
    status.textContent = 'Stopped.';
});
