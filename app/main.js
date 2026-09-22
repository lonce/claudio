import { AudioSystem } from '/soundlib/AudioSystem.js';
import { RissetBasic, DroneModel, WaveTrigger, ClickerWorkletSoundModel, AnotherGranny, FaustClarinet, WorkerFM, WaterFillRNN, Ping, ChuaOscillator, RendezvousPingerII, RendezvousPingerIII, RendezvousChimes, ChimeTube, WindChimes, BellStrike, Maraca, MaracaExtended, Cabasa, BambooChimes, ChimeVocoder, Wind } from '/soundlib/models/index.js';
import { HamburgerLadyChua13, DronePreset, RissetPreset, WaveTriggerPreset, WorkletClickerPreset, GrannyInteractive, FaustClarinetPreset, RendezvousPingerIIPreset, ChimeStrikePreset, WindChimesPreset, MaracaExtendedPreset } from '/soundlib/models/index_presets.js';
import { requestMotionPermissions } from './MotionPermission.js';
import { createNudgeSliderControl } from './NudgeSlider.js';
import { openSavePresetDialog } from './SavePresetDialog.js';
import { formatFixedDigits } from './formatNumber.js';
import { ShakeControlSource } from './ShakeControlSource.js';

// Designer mode (?mode=designer): NudgeSliders + Save Preset button.
// Normal mode (default): plain sliders, no Save button.
const isDesignerMode = new URLSearchParams(window.location.search).get('mode') === 'designer';
const USE_NUDGE_SLIDER = isDesignerMode;

const audioSystem = new AudioSystem();
let currentSound = null;
let parameterControls = new Map();

// One shared detector for the whole app -- per
// scratch/Shake-Control-Source-Specification.md section 4, multiple
// parameters mapped to 'shake' all follow the same value, not one
// detector instance each.
const shakeDetector = new ShakeControlSource();
let lastSentShakeValue = 0;

let ocount=0; // orientation event counter
let mouseDownP=false;
let requestedSoundName = new URLSearchParams(window.location.search).get('sound');

// Initialized in initApp, used by other functions
let logElement = null;
function log(message) {
    logElement.textContent += message + '\n';
    console.log(message);  // Still log to console for desktop debugging
}

async function initApp() {
    const appContainer = document.getElementById('app');

    logElement = document.createElement('div');
    logElement.style.whiteSpace = 'pre-wrap';
    logElement.style.fontFamily = 'monospace';
    logElement.style.marginBottom = '20px';
    appContainer.appendChild(logElement);

    const soundSelector = document.getElementById('soundSelector');
    const xyPad = document.getElementById('xyPad');
    const sliderBox = document.getElementById('sliderBox');

    loadXyPadInfo(xyPad);

    try {
        // Requested before any sound is loaded (rather than after, as
        // before) so the dialog appears immediately instead of waiting on
        // however long the 28 createSound() calls below take (worklet
        // module loads, audio file fetches/decodes -- network/device-
        // dependent, easily a few seconds). audioSystem and document.body
        // are the only things this depends on, and both already exist here.
        const orientationApiPresent = 'DeviceOrientationEvent' in window;
        if (orientationApiPresent) {
            await requestMotionPermissions(audioSystem, handleOrientation, log, onOrientationAvailabilityChange);
        } else {
            window.hasOrientationSupport = false;
            window.hasOrientationPermission = false;
        }
        console.log('Orientation support checked');

        console.log('Loading sounds...');
        const risset = await audioSystem.createSound(RissetBasic, 'Risset', 0);
        const drone = await audioSystem.createSound(DroneModel, 'Drone', 0);
        const waveTrigger = await audioSystem.createSound(WaveTrigger, 'WaveTrigger', 0);
        const workletClicker = await audioSystem.createSound(ClickerWorkletSoundModel, 'Worklet_Clicker', 0);
        const granny = await audioSystem.createSound(AnotherGranny, 'Granny', 0, 'BeingRural22k.mp3');
        const faustClarinet = await audioSystem.createSound(FaustClarinet, 'FaustClarinet', 0);
        const workerFM = await audioSystem.createSound(WorkerFM, 'WorkerFM', 0, 
            {
                lookaheadFrames: 12,  // Configurable buffer size
                centerFreq: 220,     // Start at A3
                modRate: 1.5,        // Slow modulation
                modDepth: 0.3        // Moderate frequency variation
            });
        const waterFillRNN = await audioSystem.createSound(WaterFillRNN, 'WaterFillRNN', 0, {
            lookaheadFrames: 12,
            centerFreq: 220,
            modRate: 1.5,
            modDepth: 0.3
        });
        const ping = await audioSystem.createSound(Ping, 'Ping', 0);
        const chuaOscillator = await audioSystem.createSound(ChuaOscillator, 'ChuaOscillator', 0);
        const rendezvousPingerII = await audioSystem.createSound(RendezvousPingerII, 'RendezvousPingerII', 0);
        const rendezvousPingerIII = await audioSystem.createSound(RendezvousPingerIII, 'RendezvousPingerIII', 0);
        const rendezvousChimes = await audioSystem.createSound(RendezvousChimes, 'RendezvousChimes', 0);
        const chimeTube = await audioSystem.createSound(ChimeTube, 'Chime Tube', 0, { seed: 1 });
        const windChimes = await audioSystem.createSound(WindChimes, 'Wind Chimes', 0);
        const bellStrike = await audioSystem.createSound(BellStrike, 'Bell Strike', 0);
        const maraca = await audioSystem.createSound(Maraca, 'Maraca', 0);
        const maracaExtended = await audioSystem.createSound(MaracaExtended, 'Maraca Extended', 0);
        const cabasa = await audioSystem.createSound(Cabasa, 'Cabasa', 0);
        const bambooChimes = await audioSystem.createSound(BambooChimes, 'Bamboo Chimes', 0);
        const chimeVocoder = await audioSystem.createSound(ChimeVocoder, 'Chime Vocoder', 0);
        const wind = await audioSystem.createSound(Wind, 'Wind', 0);
        const hamburgerLadyChua13 = await audioSystem.createSound(HamburgerLadyChua13, 'Hamburger Lady (Chua13)', 0);
        const dronePreset = await audioSystem.createSound(DronePreset, 'Drone preset', 0);
        const rissetPreset = await audioSystem.createSound(RissetPreset, 'Risset preset', 0);
        const waveTriggerPreset = await audioSystem.createSound(WaveTriggerPreset, 'WaveTrigger preset', 0);
        const workletClickerPreset = await audioSystem.createSound(WorkletClickerPreset, 'Worklet_Clicker preset', 0);
        const grannyInteractive = await audioSystem.createSound(GrannyInteractive, 'Granny interactive', 0, 'BeingRural22k.mp3');
        const faustClarinetPreset = await audioSystem.createSound(FaustClarinetPreset, 'FaustClarinet preset', 0);
        const rendezvousPingerIIPreset = await audioSystem.createSound(RendezvousPingerIIPreset, 'RendezvousPingerII preset', 0);
        const chimeStrikePreset = await audioSystem.createSound(ChimeStrikePreset, 'Chime Strike preset', 0);
        const windChimesPreset = await audioSystem.createSound(WindChimesPreset, 'Wind Chimes preset', 0);
        const maracaExtendedPreset = await audioSystem.createSound(MaracaExtendedPreset, 'Maraca Extended preset', 0);

        const sounds = [risset, drone, waveTrigger, workletClicker, granny, faustClarinet, workerFM, waterFillRNN, ping, chuaOscillator, rendezvousPingerII, rendezvousPingerIII, rendezvousChimes, chimeTube, windChimes, bellStrike, maraca, maracaExtended, cabasa, bambooChimes, chimeVocoder, wind, hamburgerLadyChua13, dronePreset, rissetPreset, waveTriggerPreset, workletClickerPreset, grannyInteractive, faustClarinetPreset, rendezvousPingerIIPreset, chimeStrikePreset, windChimesPreset, maracaExtendedPreset];

        console.log('Sounds loaded');

        // Sort only the dropdown's display order alphabetically -- `sounds`
        // itself stays in creation order since sounds[0] is still used
        // below as the default-on-load sound.
        const soundsAlphabetical = [...sounds].sort((a, b) => a.name.localeCompare(b.name));
        soundsAlphabetical.forEach(sound => {
            const option = document.createElement('option');
            option.value = sound.name;
            option.textContent = sound.name;
            soundSelector.appendChild(option);
        });

        console.log('Sound selector populated');

        soundSelector.addEventListener('change', () => {
            if (currentSound && currentSound.isPlaying) {
                currentSound.stop();
            }
            audioSystem.resume();
            const selectedName = soundSelector.value;
            currentSound = sounds.find(s => s.name === selectedName);
            initializeParameterControls();
            updateSliderBox(currentSound.parameters);
        });

        let autoSelected = false;
        if (requestedSoundName) {
            const match = sounds.find(s => s.name.toLowerCase() === requestedSoundName.toLowerCase());
            if (match) {
                soundSelector.value = match.name;
                currentSound = match;
                autoSelected = true;
            }
        }

        if (!autoSelected) {
            currentSound = sounds[0];
            soundSelector.value = currentSound.name;
        }

        initializeParameterControls();
        updateSliderBox();

        console.log('Sound selector event listener added, now initializing xyPad event listeners');
        xyPad.addEventListener('mousedown', function(event) { mouseDownP=true });
        xyPad.addEventListener('mousedown', startSound);
        xyPad.addEventListener('mousemove', updateSound);
        xyPad.addEventListener('mouseup', stopSound);
        xyPad.addEventListener('mouseup', function(event) { mouseDownP=false });
        xyPad.addEventListener('mouseleave', stopSound);

        xyPad.addEventListener('touchstart', function(event) { mouseDownP=true });
        xyPad.addEventListener('touchstart', startSound);
        xyPad.addEventListener('touchmove', updateSound);
        xyPad.addEventListener('touchend', stopSound);
        xyPad.addEventListener('touchend', function(event) { mouseDownP=false });
        xyPad.addEventListener('touchcancel', stopSound);

        console.log(`now initialize parameter controls`);
        initializeParameterControls();
        updateSliderBox();
        console.log('Slider box updated');

        requestAnimationFrame(shakeAnimationFrame);

    } catch (error) {
        console.error('Failed to initialize app:', error);
        appContainer.textContent = 'Failed to load audio components. Please check the console for details.';
    }
}


// Called by MotionPermission.js if/when its post-dialog liveness check
// finds that no real deviceorientation events actually arrived (sensors
// blocked by the browser/OS despite an apparently-successful grant).
// Refreshes any already-displayed control dropdown so pitch/roll/shake
// drop back out without needing a page reload.
function onOrientationAvailabilityChange(state) {
    if (currentSound) {
        initializeParameterControls();
        updateSliderBox();
    }
}

function initializeParameterControls() {
    parameterControls.clear();
    // The selected sound is changing -- any in-progress stroke tracked
    // against the old mapping is no longer meaningful.
    shakeDetector.reset();
    lastSentShakeValue = 0;
    const claimed = new Set();
    // In designer mode, treat pitch/roll as available for default-mapping
    // resolution even on a machine with no motion sensors -- lets a preset's
    // pitch/roll mappings be authored at a desk, to be functional later on a
    // device that actually has them.
    const hasAccelerometers = isDesignerMode || (window.hasOrientationSupport && window.hasOrientationPermission);

    currentSound.getParameters().forEach(param => {
        let type = 'slider';
        const pref = param.preference;

        if (pref === 'pitch' || pref === 'roll') {
            type = hasAccelerometers ? pref : (pref === 'pitch' ? 'y' : 'x');
        } else if (pref === 'x' || pref === 'y') {
            type = pref;
        } else if (pref === 'shake') {
            // Same sensor/permission dependency as pitch/roll; unlike those,
            // there's no natural non-sensor substitute for a shake pulse, so
            // this falls back to a plain slider rather than another axis.
            type = hasAccelerometers ? 'shake' : 'slider';
        }

        if (type !== 'slider' && claimed.has(type)) {
            type = 'slider';
        }
        if (type !== 'slider') {
            claimed.add(type);
        }

        parameterControls.set(param.name, { type, param });
    });
}





function handleOrientation(event) {
    //console.log('orientation event...' + ocount++);
    //if (!currentSound || !currentSound.isPlaying) return;
    if (!currentSound ) return;

    // Helper function to map and clamp values
    function mapAndClamp(value, inMin, inMax, outMin, outMax) {
        // First, clamp the input value to the input range
        const clampedValue = Math.min(Math.max(value, inMin), inMax);
        // Then map the clamped value to the output range
        return ((clampedValue - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
    }

    // Map pitch (beta) from -45 to 45 degrees to 0 to 1
    const pitch = mapAndClamp(event.beta, -45, 45, 0, 1);

    // Map roll (gamma) from -45 to 45 degrees to 0 to 1
    const roll = mapAndClamp(event.gamma, -45, 45, 0, 1);

    updateSoundFromOrientation(pitch, roll);

    // Raw, unclamped beta -- clamping (as the pitch mapping above does)
    // would flatten velocity right at the extremes of a vigorous shake,
    // exactly where direction reversals happen. Independent of the pitch
    // mapping above; feeding it here doesn't change that mapping's own
    // behavior at all.
    if (Number.isFinite(event.beta)) {
        shakeDetector.update(event.beta, performance.now() / 1000);
    }
}

function updateSoundFromOrientation(pitch, roll) {
    parameterControls.forEach((control, paramName) => {
        const param = control.param;
        if (control.type === 'pitch') {
            param.setNormalized(pitch);
            //-- currentSound.updateParameter(paramName);
        } else if (control.type === 'roll') {
            param.setNormalized(roll);
            //- currentSound.updateParameter(paramName);
        }
    });

    updateSliderValues();
}

function updateSoundFromShake(value) {
    // Avoid redundant parameter messages when the value hasn't moved
    // materially, per the shake-control-source spec's section 11.
    if (Math.abs(value - lastSentShakeValue) < shakeDetector.config.outputEpsilon) return;
    lastSentShakeValue = value;

    let touched = false;
    parameterControls.forEach((control) => {
        if (control.type === 'shake') {
            control.param.setNormalized(value);
            touched = true;
        }
    });
    if (touched) updateSliderValues();
}

// One shared animation loop drives the shake envelope's decay at a steady
// rate, rather than only updating whenever a new deviceorientation event
// happens to arrive (the app has no other continuous-update loop today).
// Runs for the app's whole lifetime -- harmless and cheap even when no
// parameter is currently mapped to 'shake'.
function shakeAnimationFrame(domHighResTimestamp) {
    updateSoundFromShake(shakeDetector.tick(domHighResTimestamp / 1000));
    requestAnimationFrame(shakeAnimationFrame);
}

// Static text describing how to use the XY plane, same for every sound.
// A property of the XY plane itself, not of any sound model, so it's loaded
// once here rather than through a per-sound field like docstringPub.
async function loadXyPadInfo(xyPad) {
    try {
        const response = await fetch('/soundlib/sharedResources/xyuserinfo.txt');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const text = await response.text();
        const infoEl = document.createElement('div');
        infoEl.className = 'xy-info';
        infoEl.textContent = text;
        xyPad.appendChild(infoEl);
    } catch (error) {
        console.error('Failed to load xyPad info text:', error);
    }
}

function updateXyPadDoc() {
    const xyPad = document.getElementById('xyPad');
    let docEl = xyPad.querySelector('.xy-doc');
    if (!docEl) {
        docEl = document.createElement('div');
        docEl.className = 'xy-doc';
        xyPad.appendChild(docEl);
    }
    docEl.textContent = currentSound.docstringPub || '';
    docEl.style.display = currentSound.docstringPub ? 'block' : 'none';
}

// Draws a green crosshair on the x/y pad at wherever the first parameter
// mapped to 'x' (vertical line) and the first mapped to 'y' (horizontal
// line) currently sit -- moves live while dragging the pad, and stays in
// sync with any other way those values change (a snapshot recall, the
// auto-resolved default mapping on sound switch, etc), since this is
// called from updateSliderValues(), the app's existing catch-all refresh
// point. Either line is simply absent if nothing is currently mapped to
// that axis.
function updateXyCrosshair() {
    const xyPad = document.getElementById('xyPad');

    let vLine = xyPad.querySelector('.xy-crosshair-v');
    if (!vLine) {
        vLine = document.createElement('div');
        vLine.className = 'xy-crosshair-v';
        xyPad.appendChild(vLine);
    }

    let hLine = xyPad.querySelector('.xy-crosshair-h');
    if (!hLine) {
        hLine = document.createElement('div');
        hLine.className = 'xy-crosshair-h';
        xyPad.appendChild(hLine);
    }

    let xControl = null;
    let yControl = null;
    parameterControls.forEach((control) => {
        if (control.type === 'x' && !xControl) xControl = control;
        if (control.type === 'y' && !yControl) yControl = control;
    });

    if (xControl) {
        vLine.style.left = `${xControl.param.getNormalized() * 100}%`;
        vLine.style.display = 'block';
    } else {
        vLine.style.display = 'none';
    }

    if (yControl) {
        // CSS `top` is measured from the pad's visual top, but
        // getNormalized() follows updateSound()'s own convention (0 at
        // the bottom) -- invert to convert between the two.
        hLine.style.top = `${(1 - yControl.param.getNormalized()) * 100}%`;
        hLine.style.display = 'block';
    } else {
        hLine.style.display = 'none';
    }
}

///////////////////////////////////////////////////////////////
// Snapshots: lightweight, per-sound localStorage recall of slider values.
// Distinct from the designer-mode "Save Preset" workflow
// (SavePresetDialog.js), which downloads a JSON file meant to become a new
// permanent SoundModel class -- snapshots never leave the browser.
//
// Known, accepted limitation: keyed by the sound's display name
// (currentSound.name). If that name is ever changed in this file, its
// previously-saved snapshots become orphaned under the old name -- no
// stable identifier separate from the display string exists anywhere in
// this codebase today, and introducing one isn't worth it for this feature.
function snapshotStorageKey(soundName) {
    return `claudio:snapshots:${soundName}`;
}

function loadSnapshots(soundName) {
    try {
        const raw = localStorage.getItem(snapshotStorageKey(soundName));
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Failed to load snapshots for', soundName, error);
        return [];
    }
}

function saveSnapshots(soundName, snapshots) {
    try {
        localStorage.setItem(snapshotStorageKey(soundName), JSON.stringify(snapshots));
    } catch (error) {
        console.error('Failed to save snapshots for', soundName, error);
    }
}

function captureSnapshotValues(sound) {
    const values = {};
    sound.getParameters().forEach(param => {
        values[param.name] = param.get();
    });
    return values;
}

function captureDefaultValues(sound) {
    const values = {};
    sound.getParameters().forEach(param => {
        values[param.name] = param.defaultValue;
    });
    return values;
}

function applySnapshotValues(sound, values) {
    Object.entries(values).forEach(([name, value]) => {
        if (sound.getParameter(name)) {
            sound.setParameter(name, value);
        }
    });
    updateSliderValues();
}

function promptNewSnapshot(sound, select) {
    const name = window.prompt('Name this snapshot:');
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const snapshots = loadSnapshots(sound.name);
    const existingIndex = snapshots.findIndex(s => s.name === trimmed);
    const entry = { name: trimmed, values: captureSnapshotValues(sound) };
    if (existingIndex !== -1) {
        if (!window.confirm(`Overwrite "${trimmed}"?`)) return;
        snapshots[existingIndex] = entry;
    } else {
        snapshots.push(entry);
    }
    saveSnapshots(sound.name, snapshots);
    populateSnapshotSelect(select, sound.name);
}

function populateSnapshotSelect(select, soundName) {
    select.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— select —';
    select.appendChild(placeholder);

    const defaultOption = document.createElement('option');
    defaultOption.value = '__default__';
    defaultOption.textContent = 'Default';
    select.appendChild(defaultOption);

    loadSnapshots(soundName).forEach(snapshot => {
        const option = document.createElement('option');
        option.value = snapshot.name;
        option.textContent = snapshot.name;
        select.appendChild(option);
    });

    const newOption = document.createElement('option');
    newOption.value = '__new__';
    newOption.textContent = '+ New snapshot';
    select.appendChild(newOption);

    select.value = '';
}

///////////////////////////////////////////////////////////////
function updateSliderBox() {
    //log("updateSliderBox")
    updateXyPadDoc();

    const sliderBox = document.getElementById('sliderBox');
    sliderBox.innerHTML = '';

    const playButton = document.createElement('button');
    playButton.textContent = 'Play';
    playButton.addEventListener('mousedown', () => {
        currentSound.play();
        triggerSoleEventIfAny();
    });
    sliderBox.appendChild(playButton);

    const stopButton = document.createElement('button');
    stopButton.textContent = 'Stop';
    stopButton.addEventListener('click', () => currentSound.stop());
    sliderBox.appendChild(stopButton);

    if (typeof currentSound.getEvents === 'function') {
        currentSound.getEvents().forEach(({ name, description }) => {
            const eventButton = document.createElement('button');
            eventButton.textContent = name;
            if (description) eventButton.title = description;
            // mousedown/touchstart, not click -- fire immediately on press
            // rather than waiting for release, same as the Play button.
            // preventDefault on touchstart suppresses the synthetic
            // mousedown/click browsers fire afterward, which would
            // otherwise trigger the event a second time.
            eventButton.addEventListener('mousedown', () => currentSound.event(name));
            eventButton.addEventListener('touchstart', (event) => {
                event.preventDefault();
                currentSound.event(name);
            });
            sliderBox.appendChild(eventButton);
        });
    }

    if (isDesignerMode) {
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save Preset';
        saveButton.addEventListener('click', () => {
            openSavePresetDialog(sliderBox, currentSound, parameterControls);
        });
        sliderBox.appendChild(saveButton);
    }

    const controlOptions = ['none', 'slider', 'x', 'y'];
    // Same designer-mode override as initializeParameterControls(): offer
    // pitch/roll/shake as selectable mappings even without motion sensors
    // here, so a preset's mapping can be manually set (or corrected) at a
    // desk too. 'shake' rides the same deviceorientation permission as
    // pitch/roll (it's derived from the same sensor), so it shares this
    // exact availability check rather than needing its own.
    if (isDesignerMode || (window.hasOrientationSupport && window.hasOrientationPermission)) {
        controlOptions.push('pitch', 'roll', 'shake');
    }

    function addControlSelect(param, paramControl) {
        const controlSelect = document.createElement('select');
        controlOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            controlSelect.appendChild(optionElement);
        });
        controlSelect.value = parameterControls.get(param.name).type;
        controlSelect.addEventListener('change', (e) => {
            parameterControls.get(param.name).type = e.target.value;
            if (e.target.value === 'shake') {
                // A parameter is newly assigned to 'shake' -- any
                // in-progress stroke tracked before this assignment isn't
                // meaningful to it.
                shakeDetector.reset();
                lastSentShakeValue = 0;
            }
            const isSlider = e.target.value === 'slider';
            const rangeInput = paramControl.querySelector('input[type="range"]');
            if (rangeInput) rangeInput.disabled = !isSlider;
            paramControl.querySelectorAll('.nudge-slider button').forEach(btn => btn.disabled = !isSlider);
        });
        paramControl.appendChild(controlSelect);
    }

    currentSound.getParameters().forEach(param => {
        const paramControl = document.createElement('div');
        paramControl.className = 'parameter-control';
        paramControl.dataset.paramName = param.name;

        const label = document.createElement('label');
        label.textContent = param.name;
        paramControl.appendChild(label);

        const controlRow = document.createElement('div');
        controlRow.className = 'parameter-control-row';
        paramControl.appendChild(controlRow);

        if (param.isStringParameter()) {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = param.get();
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    currentSound.setParameter(param.name, input.value);
                    updateSliderValues();
                }
            });
            input.addEventListener('focus', () => {
                input.dataset.editing = 'true';
            });
            input.addEventListener('blur', () => {
                input.dataset.editing = 'false';
                currentSound.setParameter(param.name, input.value);
                updateSliderValues();
            });
            controlRow.appendChild(input);
        } else if (param.isIntegerParameter()) {
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = param.min;
            slider.max = param.max;
            slider.step = 1;
            slider.value = param.get();
            slider.addEventListener('input', () => {
                //-- param.set(parseInt(slider.value));
                // -- currentSound.updateParameter(param.name);
                currentSound.setParameter(param.name, slider.value);
                valueDisplay.textContent = param.get();
                updateSliderValues();
            });
            controlRow.appendChild(slider);

            const valueDisplay = document.createElement('span');
            valueDisplay.className = 'parameter-value';
            valueDisplay.style.display = 'inline-block';
            valueDisplay.style.minWidth = '5.5em';
            valueDisplay.style.textAlign = 'right';
            valueDisplay.style.fontFamily = 'monospace';
            valueDisplay.textContent = param.get();
            controlRow.appendChild(valueDisplay);

            addControlSelect(param, controlRow);
        } else {
            // Float parameter
            if (USE_NUDGE_SLIDER) {
                const nudgeSlider = createNudgeSliderControl(param, (value) => {
                    currentSound.setParameter(param.name, value);
                    updateSliderValues();
                });
                controlRow.appendChild(nudgeSlider.element);
            } else {
                const slider = document.createElement('input');
                slider.type = 'range';
                slider.min = 0;
                slider.max = 1;
                slider.step = 0.01;
                slider.value = param.getNormalized();
                slider.addEventListener('input', () => {
                    //-- param.setNormalized(parseFloat(slider.value));
                    //-- currentSound.updateParameter(param.name);
                    currentSound.setParameterNormalized(param.name, slider.value);
                    valueDisplay.textContent = formatFixedDigits(param.get());
                    updateSliderValues();
                });
                controlRow.appendChild(slider);

                const valueDisplay = document.createElement('span');
                valueDisplay.className = 'parameter-value';
                valueDisplay.style.display = 'inline-block';
                valueDisplay.style.minWidth = '5.5em';
                valueDisplay.style.textAlign = 'right';
                valueDisplay.style.fontFamily = 'monospace';
                valueDisplay.textContent = formatFixedDigits(param.get());
                controlRow.appendChild(valueDisplay);
            }

            addControlSelect(param, controlRow);
        }

        sliderBox.appendChild(paramControl);
    });

    const snapshotRow = document.createElement('div');
    snapshotRow.className = 'snapshot-controls';

    const snapshotLabel = document.createElement('label');
    snapshotLabel.textContent = 'Snapshots';
    snapshotRow.appendChild(snapshotLabel);

    const snapshotSelect = document.createElement('select');
    populateSnapshotSelect(snapshotSelect, currentSound.name);
    snapshotSelect.addEventListener('change', () => {
        const value = snapshotSelect.value;
        if (value === '') return;
        if (value === '__new__') {
            promptNewSnapshot(currentSound, snapshotSelect);
        } else if (value === '__default__') {
            applySnapshotValues(currentSound, captureDefaultValues(currentSound));
        } else {
            const snapshot = loadSnapshots(currentSound.name).find(s => s.name === value);
            if (snapshot) applySnapshotValues(currentSound, snapshot.values);
        }
        snapshotSelect.value = '';
    });
    snapshotRow.appendChild(snapshotSelect);

    sliderBox.appendChild(snapshotRow);

    updateXyCrosshair();
}



// A model with exactly one event (e.g. Maraca's 'strike') is silent until
// that event fires -- Play alone shouldn't require a second trigger to
// hear anything. Models with more than one event (e.g. RendezvousChimes's
// two rendezvous events) already produce sound on their own after Play,
// and there's no single unambiguous event to pick, so this only applies
// to the exactly-one case. Shared by the Play button and the x/y pad's
// own press-down gesture below.
function triggerSoleEventIfAny() {
    if (typeof currentSound.getEvents !== 'function') return;
    const events = currentSound.getEvents();
    if (events.length === 1) currentSound.event(events[0].name);
}

function startSound(e) {
    //log("start sound");

    e.preventDefault();
    updateSound(e, true);
    currentSound.play()
    triggerSoleEventIfAny();
}

function updateSound(e, force=false) {
    //if (! mouseDownP) return;

    e.preventDefault();
    if (!currentSound.isPlaying  && !force) return;

    const rect = e.target.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    const normalizedX = x / rect.width;
    const normalizedY = 1 - (y / rect.height);  // Invert Y so 0 is at the bottom

    parameterControls.forEach((control, paramName) => {
        const param = control.param;
        if (control.type === 'x') {
            //-- param.setNormalized(normalizedX);
            //-- currentSound.updateParameter(paramName);
            currentSound.setParameterNormalized(paramName, normalizedX);
        } else if (control.type === 'y') {
            //-- param.setNormalized(normalizedY);
            //-- currentSound.updateParameter(paramName);
            currentSound.setParameterNormalized(paramName, normalizedY);
        }
        // Note: pitch and roll are handled in handleOrientation
    });

   updateSliderValues();
}

function updateSliderValues() {
    
    const sliderBox = document.getElementById('sliderBox');

    parameterControls.forEach((control, paramName) => {
        const paramControl = sliderBox.querySelector(`.parameter-control[data-param-name="${paramName}"]`);
        if (paramControl) {
            const param = control.param;
            if (param.isStringParameter()) {
                const input = paramControl.querySelector('input[type="text"]');
                if (input && input.dataset.editing !== 'true') {
                    input.value = param.get();
                }
            } else if (param.isIntegerParameter()) {
                const slider = paramControl.querySelector('input[type="range"]');
                const valueDisplay = paramControl.querySelector('span');
                if (slider) slider.value = param.get();
                if (valueDisplay) valueDisplay.textContent = param.get();
            } else {
                // Handle float parameters
                const slider = paramControl.querySelector('input[type="range"]');
                const valueDisplay = paramControl.querySelector('.parameter-value');
                if (slider) slider.value = param.getNormalized();
                if (valueDisplay) valueDisplay.textContent = formatFixedDigits(param.get());
            }
        }
    });

    updateXyCrosshair();
}

function stopSound(e) {
    e.preventDefault();
    currentSound.stop();
}

window.addEventListener('load', initApp);

// Ensure AudioContext is resumed on user interaction
document.body.addEventListener('touchstart', function() {
    if (audioSystem.context.state === 'suspended') {
        audioSystem.resume();
    }
}, {once: true});





