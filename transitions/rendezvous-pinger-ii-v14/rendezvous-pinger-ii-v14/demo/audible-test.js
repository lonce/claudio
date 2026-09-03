import { TransitionClickerWorkletSoundModel } from
    '../soundModels/TransitionClickerWorkletSoundModel.js';

const startButton = document.querySelector('#start');
const stopButton = document.querySelector('#stop');
const status = document.querySelector('#status');

let context;
let models = [];
let timers = [];

const lowPattern = [
    { id: 'low-downbeat', phase: 0, event: 'click', frequency: 220,
      durationSeconds: 0.07, amplitude: 0.38, noiseMix: 0.06 }
];

const brightPattern = [
    { id: 'bright-downbeat', phase: 0, event: 'click', frequency: 1350,
      durationSeconds: 0.035, amplitude: 0.25, noiseMix: 0.12 }
];

function later(seconds, action) {
    const id = setTimeout(action, seconds * 1000);
    timers.push(id);
}

async function stopTest() {
    timers.forEach(clearTimeout);
    timers = [];
    for (const model of models) model.stop();
    models = [];
    if (context && context.state !== 'closed') await context.close();
    context = null;
    startButton.disabled = false;
    stopButton.disabled = true;
    status.textContent = 'Stopped.';
}

startButton.addEventListener('click', async () => {
    startButton.disabled = true;
    status.textContent = 'Loading the audio worklet…';

    context = new AudioContext();
    await context.suspend();
    await context.audioWorklet.addModule(
        TransitionClickerWorkletSoundModel.WORKLET_PATH
    );

    const common = { initialRate: 2, initialPhase: 0 };
    const low = new TransitionClickerWorkletSoundModel(context, 'low-clicker', {
        processorOptions: { ...common, eventList: lowPattern }
    });
    const bright = new TransitionClickerWorkletSoundModel(context, 'bright-clicker', {
        processorOptions: { ...common, eventList: brightPattern }
    });

    low.setParameter('gain', 0.7);
    bright.setParameter('gain', 0.55);

    const lowPan = new StereoPannerNode(context, { pan: -0.45 });
    const brightPan = new StereoPannerNode(context, { pan: 0.45 });
    low.connect(lowPan);
    bright.connect(brightPan);
    lowPan.connect(context.destination);
    brightPan.connect(context.destination);

    models = [low, bright];

    // While suspended, currentTime cannot cross a render boundary between
    // these calls. Resuming once starts both processors on the same frame.
    low.play();
    bright.play();
    await context.resume();

    stopButton.disabled = false;
    status.textContent = 'In sync: both clickers at 2 Hz.';

    later(4, () => {
        bright.setParameter('freq', 2);
        bright.setParameter('phase', 0.5);
        bright.setParameter('transition_dur', 5);
        bright.event('transition');
        status.textContent = 'Transitioning bright clicker to phase 0.5 (five seconds)…';
    });

    later(9, () => {
        status.textContent = 'Transition complete: steady offbeat relationship.';
    });
});

stopButton.addEventListener('click', stopTest);
