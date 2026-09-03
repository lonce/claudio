import {
    RendezvousPinger
} from '../soundModels/RendezvousPinger/RendezvousPinger.js';

const byId = (id) => document.querySelector(`#${id}`);
const initializeButton = byId('initialize');
const playButton = byId('play');
const rendezvousButton = byId('rendezvous');
const stopButton = byId('stop');
const status = byId('status');

let context;
let model;
let statsTimer;

const parameterControls = [
    ['freq-1', 'freq-1-value', 'phasor_freq_1', (v) => `${v.toFixed(2)} Hz`],
    ['freq-2', 'freq-2-value', 'phasor_freq_2', (v) => `${v.toFixed(2)} Hz`],
    ['final', 'final-value', 'final_freq', (v) => `${v.toFixed(2)} Hz`],
    ['phase', 'phase-value', 'target_phase', (v) => v.toFixed(2)],
    ['duration', 'duration-value', 'transition_dur', (v) => `${v.toFixed(1)} s`],
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
    RendezvousPinger.CHORD_NAMES.forEach((name, index) => {
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
    await context.audioWorklet.addModule(RendezvousPinger.WORKLET_PATH);
    model = new RendezvousPinger(context, 'rendezvous-pinger');
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
    status.textContent = 'RendezvousPinger is ready and silent.';
});

playButton.addEventListener('click', () => {
    model.play();
    playButton.disabled = true;
    rendezvousButton.disabled = false;
    status.textContent = 'Both child phasors started at phase 0.';
});

rendezvousButton.addEventListener('click', () => {
    model.event('rendezvous');
    const frequency = model.getParameter('final_freq').get();
    const phase = model.getParameter('target_phase').get();
    const duration = model.getParameter('transition_dur').get();
    status.textContent =
        `Rendezvous underway: ${frequency.toFixed(2)} Hz, phases 0 and ${phase.toFixed(2)}, over ${duration.toFixed(2)} s.`;
});

stopButton.addEventListener('click', () => {
    clearInterval(statsTimer);
    rendezvousButton.disabled = true;
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
