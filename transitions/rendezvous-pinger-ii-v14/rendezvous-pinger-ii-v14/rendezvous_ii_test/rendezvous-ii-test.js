import {
    RendezvousPingerII
} from '../soundModels/RendezvousPinger/RendezvousPingerII.js';

const byId = (id) => document.querySelector(`#${id}`);
const initializeButton = byId('initialize');
const playButton = byId('play');
const rendezvousButton = byId('rendezvous');
const naturalButton = byId('natural');
const stopButton = byId('stop');
const status = byId('status');

let context;
let model;
let statsTimer;

const parameterControls = [
    ['freq-1', 'freq-1-value', 'natural_freq_1', (v) => `${v.toFixed(2)} Hz`],
    ['freq-2', 'freq-2-value', 'natural_freq_2', (v) => `${v.toFixed(2)} Hz`],
    ['final', 'final-value', 'rendezvous_freq', (v) => `${v.toFixed(2)} Hz`],
    ['phase-1', 'phase-1-value', 'rendezvous_phase_1', (v) => v.toFixed(2)],
    ['phase-2', 'phase-2-value', 'rendezvous_phase_2', (v) => v.toFixed(2)],
    ['duration', 'duration-value', 'transition_dur', (v) => `${v.toFixed(1)} s`],
    ['sharpness', 'sharpness-value', 'transition_sharpness', (v) => v.toFixed(2)],
    ['root-1', 'root-1-value', 'fundamental_1', (v) => `${v.toFixed(2)} Hz`],
    ['root-2', 'root-2-value', 'fundamental_2', (v) => `${v.toFixed(2)} Hz`]
];

for (const [controlId, outputId, parameterName, format] of parameterControls) {
    const control = byId(controlId);
    const output = byId(outputId);
    const update = () => {
        const value = Number(control.value);
        output.textContent = format(value);
        model?.setParameter(parameterName, value);
    };
    control.addEventListener('input', update);
    update();
}

for (const [id, initialValue] of [['chord-1', 1], ['chord-2', 2]]) {
    const select = byId(id);
    RendezvousPingerII.CHORD_NAMES.forEach((name, index) => {
        select.add(new Option(`${index + 1}: ${name}`, String(index + 1)));
    });
    select.value = String(initialValue);
    select.addEventListener('change', () => {
        model?.setParameter(id.replace('-', '_'), Number(select.value));
    });
}

function formatDelay(stats) {
    return stats.lastTiming
        ? `${stats.lastTiming.notificationDelayMs.toFixed(2)} ms`
        : '—';
}

function refreshStats() {
    if (!model) return;
    const { child1, child2 } = model.getTimingStats();
    byId('delay-1').textContent = formatDelay(child1);
    byId('delay-2').textContent = formatDelay(child2);
    byId('dropped').textContent = `${child1.dropped} / ${child2.dropped}`;
}

initializeButton.addEventListener('click', async () => {
    initializeButton.disabled = true;
    status.textContent = 'Loading timing worklet and starting AudioContext…';

    context = new AudioContext();
    await context.audioWorklet.addModule(RendezvousPingerII.WORKLET_PATH);
    model = new RendezvousPingerII(context, 'rendezvous-pinger-ii');
    model.connect(context.destination);

    // Apply every current UI value after construction.
    for (const [controlId, , parameterName] of parameterControls) {
        model.setParameter(parameterName, Number(byId(controlId).value));
    }
    model.setParameter('chord_1', Number(byId('chord-1').value));
    model.setParameter('chord_2', Number(byId('chord-2').value));

    await context.resume();
    statsTimer = setInterval(refreshStats, 100);
    playButton.disabled = false;
    stopButton.disabled = false;
    status.textContent = 'RendezvousPingerII is ready and silent.';
});

playButton.addEventListener('click', () => {
    model.play();
    playButton.disabled = true;
    rendezvousButton.disabled = false;
    naturalButton.disabled = false;
    status.textContent = 'Both child phasors started at phase 0.';
});

rendezvousButton.addEventListener('click', () => {
    model.event('rendezvous');
    const frequency = model.getParameter('rendezvous_freq').get();
    const phase1 = model.getParameter('rendezvous_phase_1').get();
    const phase2 = model.getParameter('rendezvous_phase_2').get();
    const duration = model.getParameter('transition_dur').get();
    const sharpness = model.getParameter('transition_sharpness').get();
    status.textContent =
        `Rendezvous underway: ${frequency.toFixed(2)} Hz, phases ${phase1.toFixed(2)} and ${phase2.toFixed(2)}, over ${duration.toFixed(2)} s (sharpness ${sharpness.toFixed(2)}).`;
});

naturalButton.addEventListener('click', () => {
    model.event('natural');
    const frequency1 = model.getParameter('natural_freq_1').get();
    const frequency2 = model.getParameter('natural_freq_2').get();
    const duration = model.getParameter('transition_dur').get();
    const sharpness = model.getParameter('transition_sharpness').get();
    status.textContent =
        `Natural return underway: ${frequency1.toFixed(2)} and ${frequency2.toFixed(2)} Hz over ${duration.toFixed(2)} s (sharpness ${sharpness.toFixed(2)}).`;
});

stopButton.addEventListener('click', () => {
    clearInterval(statsTimer);
    rendezvousButton.disabled = true;
    naturalButton.disabled = true;
    stopButton.disabled = true;
    status.textContent = 'Draining both children and all active Ping releases…';
    model.stop(async () => {
        model.destroy();
        await context.close();
        model = null;
        context = null;
        initializeButton.disabled = false;
        byId('delay-1').textContent = '—';
        byId('delay-2').textContent = '—';
        byId('dropped').textContent = '0 / 0';
        status.textContent = 'Stopped after the complete nested release.';
    });
});
