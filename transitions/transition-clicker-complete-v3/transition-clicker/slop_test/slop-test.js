import { TransitionClickerWorkletSoundModel } from
    '../soundModels/TransitionClickerWorkletSoundModel.js';

const initializeButton = document.querySelector('#initialize');
const playButton = document.querySelector('#play');
const transitionButton = document.querySelector('#transition');
const stopButton = document.querySelector('#stop');
const status = document.querySelector('#status');

let context;
let low;
let bright;
let completionTimer;

const lowPattern = [
    { id: 'low', phase: 0, event: 'click', frequency: 220,
      durationSeconds: 0.07, amplitude: 0.38, noiseMix: 0.06 }
];

const brightPattern = [
    { id: 'bright', phase: 0, event: 'click', frequency: 1350,
      durationSeconds: 0.035, amplitude: 0.25, noiseMix: 0.12 }
];

initializeButton.addEventListener('click', async () => {
    initializeButton.disabled = true;
    status.textContent = 'Loading worklet and starting AudioContext…';

    context = new AudioContext();
    await context.audioWorklet.addModule(
        TransitionClickerWorkletSoundModel.WORKLET_PATH
    );

    low = new TransitionClickerWorkletSoundModel(context, 'low-slop-clicker', {
        processorOptions: {
            initialRate: 2,
            initialPhase: 0.10,
            eventList: lowPattern
        }
    });
    bright = new TransitionClickerWorkletSoundModel(context, 'bright-slop-clicker', {
        processorOptions: {
            initialRate: 3.2,
            initialPhase: 0.65,
            eventList: brightPattern
        }
    });

    low.setParameter('gain', 0.7);
    bright.setParameter('gain', 0.55);

    const lowPan = new StereoPannerNode(context, { pan: -0.45 });
    const brightPan = new StereoPannerNode(context, { pan: 0.45 });
    low.connect(lowPan).connect(context.destination);
    bright.connect(brightPan).connect(context.destination);

    await context.resume();

    playButton.disabled = false;
    stopButton.disabled = false;
    status.textContent = 'AudioContext is running; both models are silent.';
});

playButton.addEventListener('click', () => {
    // These are intentionally separate immediate calls while the AudioContext
    // is running. No shared timestamp or synchronized start mechanism is used.
    low.play();
    bright.play();

    playButton.disabled = true;
    transitionButton.disabled = false;
    status.textContent = 'Both independent models are running.';
});

transitionButton.addEventListener('click', () => {
    low.setParameter('freq', 2.5);
    low.setParameter('phase', 0);
    low.setParameter('transition_dur', 5);

    bright.setParameter('freq', 2.5);
    bright.setParameter('phase', 0.5);
    bright.setParameter('transition_dur', 5);

    // Again, deliberately separate immediate dispatches to independent ports.
    low.event('transition');
    bright.event('transition');

    transitionButton.disabled = true;
    status.textContent = 'Five-second transition in progress…';

    completionTimer = setTimeout(() => {
        status.textContent =
            'Transition complete: same frequency, nominally opposite phase.';
    }, 5000);
});

stopButton.addEventListener('click', async () => {
    clearTimeout(completionTimer);
    low?.stop();
    bright?.stop();
    if (context && context.state !== 'closed') await context.close();
    context = null;
    low = null;
    bright = null;
    initializeButton.disabled = false;
    playButton.disabled = true;
    transitionButton.disabled = true;
    stopButton.disabled = true;
    status.textContent = 'Stopped.';
});
