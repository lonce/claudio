import { TransitionPinger } from '../soundModels/RendezvousPinger/_TransitionPinger.js';

const initializeButton = document.querySelector('#initialize');
const playButton = document.querySelector('#play');
const transitionButton = document.querySelector('#transition');
const stopButton = document.querySelector('#stop');
const frequencySlider = document.querySelector('#final-frequency');
const frequencyValue = document.querySelector('#frequency-value');
const status = document.querySelector('#status');
const leftDelay = document.querySelector('#left-delay');
const rightDelay = document.querySelector('#right-delay');
const dropped = document.querySelector('#dropped');

let context;
let leftPinger;
let rightPinger;
let statsTimer;
let completionTimer;

function selectedFrequency() {
    return Number(frequencySlider.value);
}

function updateFrequencyLabel() {
    frequencyValue.textContent = `${selectedFrequency().toFixed(2)} Hz`;
}

function formatDelay(stats) {
    return stats.lastTiming
        ? `${stats.lastTiming.notificationDelayMs.toFixed(2)} ms`
        : '—';
}

function refreshStats() {
    if (!leftPinger || !rightPinger) return;
    const leftStats = leftPinger.getTimingStats();
    const rightStats = rightPinger.getTimingStats();
    leftDelay.textContent = formatDelay(leftStats);
    rightDelay.textContent = formatDelay(rightStats);
    dropped.textContent = `${leftStats.dropped} / ${rightStats.dropped}`;
}

frequencySlider.addEventListener('input', updateFrequencyLabel);

initializeButton.addEventListener('click', async () => {
    initializeButton.disabled = true;
    status.textContent = 'Loading timing worklet and starting AudioContext…';

    context = new AudioContext();
    await context.audioWorklet.addModule(TransitionPinger.WORKLET_PATH);

    leftPinger = new TransitionPinger(context, 'left-transition-pinger', {
        poolSize: 8,
        rootFrequency: 196,
        pingGateSeconds: 0.08,
        pingDecaySeconds: 0.25,
        processorOptions: {
            initialRate: 1.30,
            initialPhase: 0.10
        }
    });
    rightPinger = new TransitionPinger(context, 'right-transition-pinger', {
        poolSize: 8,
        rootFrequency: 293.66,
        pingGateSeconds: 0.08,
        pingDecaySeconds: 0.25,
        processorOptions: {
            initialRate: 2.10,
            initialPhase: 0.65
        }
    });

    leftPinger.setParameter('gain', 0.5);
    leftPinger.setParameter('chord', 0); // Major
    rightPinger.setParameter('gain', 0.42);
    rightPinger.setParameter('chord', 1); // Minor

    const leftPan = new StereoPannerNode(context, { pan: -0.55 });
    const rightPan = new StereoPannerNode(context, { pan: 0.55 });
    leftPinger.connect(leftPan);
    rightPinger.connect(rightPan);
    leftPan.connect(context.destination);
    rightPan.connect(context.destination);

    await context.resume();
    statsTimer = setInterval(refreshStats, 100);

    playButton.disabled = false;
    stopButton.disabled = false;
    status.textContent = 'AudioContext is running; both models are silent.';
});

playButton.addEventListener('click', () => {
    // Deliberately separate immediate calls on a running context: no shared
    // timestamp and no coordinating processor.
    leftPinger.play();
    rightPinger.play();

    playButton.disabled = true;
    transitionButton.disabled = false;
    status.textContent = 'Both independent phasors are running.';
});

transitionButton.addEventListener('click', () => {
    const finalFrequency = selectedFrequency();

    leftPinger.setParameter('freq', finalFrequency);
    leftPinger.setParameter('phase', 0);
    leftPinger.setParameter('transition_dur', 5);

    rightPinger.setParameter('freq', finalFrequency);
    rightPinger.setParameter('phase', 0.5);
    rightPinger.setParameter('transition_dur', 5);

    // These independent port messages intentionally expose cross-model slop.
    leftPinger.event('transition');
    rightPinger.event('transition');

    transitionButton.disabled = true;
    frequencySlider.disabled = true;
    status.textContent =
        `Rendezvous in progress: ${finalFrequency.toFixed(2)} Hz over five seconds…`;

    completionTimer = setTimeout(() => {
        status.textContent =
            `Rendezvous complete: ${finalFrequency.toFixed(2)} Hz, opposite phases.`;
    }, 5000);
});

stopButton.addEventListener('click', async () => {
    clearInterval(statsTimer);
    clearTimeout(completionTimer);
    playButton.disabled = true;
    transitionButton.disabled = true;
    stopButton.disabled = true;
    status.textContent = 'Draining both TransitionPingers…';

    const releases = [leftPinger, rightPinger]
        .filter((model) => model?.isPlaying)
        .map((model) => new Promise((resolve) => model.stop(resolve)));
    await Promise.all(releases);

    if (context && context.state !== 'closed') await context.close();
    context = null;
    leftPinger = null;
    rightPinger = null;

    initializeButton.disabled = false;
    frequencySlider.disabled = false;
    leftDelay.textContent = '—';
    rightDelay.textContent = '—';
    dropped.textContent = '0 / 0';
    status.textContent = 'Stopped.';
});

updateFrequencyLabel();
