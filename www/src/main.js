import { AudioSystem } from './AudioSystem.js';
import { DroneModel } from './models/DroneModel.js';
//import { ClickTrainModel } from './models/ClickTrainModel.js';
import { ClickerWorkletSoundModel } from './models/ClickerWorkletSoundModel.js';
import { AnotherGranny } from './models/AnotherGranny.js';
import { FaustClarinet } from './models/FaustClarinet.js';


const audioSystem = new AudioSystem();
let currentSound = null;
let parameterControls = new Map();
let hasOrientationSupport = false;


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

    try {
        const drone = await audioSystem.createSound(DroneModel, 'Drone');
//        const clickTrain = await audioSystem.createSound(ClickTrainModel, 'Click Train');
        const workletClicker = await audioSystem.createSound(ClickerWorkletSoundModel, 'Worklet Clicker');
        const granny = await audioSystem.createSound(AnotherGranny, 'Granny', 'audioResources/BeingRural22k.mp3');
        const faustClarinet = await audioSystem.createSound(FaustClarinet, 'FaustClarinet');

        const sounds = [drone, workletClicker, granny, faustClarinet];

        checkOrientationSupport();

        sounds.forEach(sound => {
            const option = document.createElement('option');
            option.value = sound.name;
            option.textContent = sound.name;
            soundSelector.appendChild(option);
        });

        soundSelector.addEventListener('change', (e) => {
            audioSystem.resume();
            currentSound = sounds.find(s => s.name === e.target.value);
            initializeParameterControls();
            updateSliderBox();
        });

        xyPad.addEventListener('mousedown', startSound);
        xyPad.addEventListener('mousemove', updateSound);
        xyPad.addEventListener('mouseup', stopSound);
        xyPad.addEventListener('mouseleave', stopSound);

        xyPad.addEventListener('touchstart', startSound);
        xyPad.addEventListener('touchmove', updateSound);
        xyPad.addEventListener('touchend', stopSound);
        xyPad.addEventListener('touchcancel', stopSound);

        currentSound = sounds[0];
        initializeParameterControls();
        updateSliderBox();

    } catch (error) {
        console.error('Failed to initialize app:', error);
        appContainer.textContent = 'Failed to load audio components. Please check the console for details.';
    }
}

function initializeParameterControls() {
    parameterControls.clear();
    currentSound.getParameters().forEach(param => {
        parameterControls.set(param.name, { type: 'slider', param: param });
    });
}


//////////////////////////////////////////////////////////////
function checkOrientationSupport() {
    if ('DeviceOrientationEvent' in window) {
        hasOrientationSupport = true;
        window.addEventListener('deviceorientation', handleOrientation);
        log('Device orientation support detected');
    } else {
        log('Device orientation not supported');
    }
}

function handleOrientation(event) {
    if (!currentSound || !currentSound.isPlaying) return;

    const pitch = (event.beta + 90) / 180; // Map -90 to 90 to 0 to 1
    const roll = (event.gamma + 90) / 180; // Map -90 to 90 to 0 to 1

    updateSoundFromOrientation(pitch, roll);
}

function updateSoundFromOrientation(pitch, roll) {
    parameterControls.forEach((control, paramName) => {
        const param = control.param;
        if (control.type === 'pitch') {
            param.setNormalized(pitch);
            currentSound.updateParameter(paramName);
        } else if (control.type === 'roll') {
            param.setNormalized(roll);
            currentSound.updateParameter(paramName);
        }
    });

    updateSliderValues();
}

///////////////////////////////////////////////////////////////
function updateSliderBox() {
    const sliderBox = document.getElementById('sliderBox');
    sliderBox.innerHTML = '';

    const playButton = document.createElement('button');
    playButton.textContent = 'Play';
    playButton.addEventListener('click', () => currentSound.play());
    sliderBox.appendChild(playButton);

    const stopButton = document.createElement('button');
    stopButton.textContent = 'Stop';
    stopButton.addEventListener('click', () => currentSound.stop());
    sliderBox.appendChild(stopButton);

    const controlOptions = ['none', 'slider', 'x', 'y'];
    if (hasOrientationSupport) {
        controlOptions.push('pitch', 'roll');
    }

    currentSound.getParameters().forEach(param => {
        const paramControl = document.createElement('div');
        paramControl.className = 'parameter-control';
        paramControl.dataset.paramName = param.name;

        const label = document.createElement('label');
        label.textContent = param.name;
        paramControl.appendChild(label);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 1;
        slider.step = 0.01;
        slider.value = param.getNormalized();
        slider.addEventListener('input', () => {
            param.setNormalized(parseFloat(slider.value));
            currentSound.updateParameter(param.name);
            valueDisplay.textContent = param.get().toFixed(2);
        });
        paramControl.appendChild(slider);

        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'parameter-value';
        valueDisplay.textContent = param.get().toFixed(2);
        paramControl.appendChild(valueDisplay);

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
            slider.disabled = e.target.value !== 'slider';
        });
        paramControl.appendChild(controlSelect);

        sliderBox.appendChild(paramControl);
    });
}

function startSound(e) {
    e.preventDefault();
    currentSound.play();
    updateSound(e);
}

function updateSound(e) {
    e.preventDefault();
    if (!currentSound.isPlaying) return;

    const rect = e.target.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    const normalizedX = x / rect.width;
    const normalizedY = 1 - (y / rect.height);  // Invert Y so 0 is at the bottom

    parameterControls.forEach((control, paramName) => {
        const param = control.param;
        if (control.type === 'x') {
            param.setNormalized(normalizedX);
            currentSound.updateParameter(paramName);
        } else if (control.type === 'y') {
            param.setNormalized(normalizedY);
            currentSound.updateParameter(paramName);
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
            const slider = paramControl.querySelector('input[type="range"]');
            const valueDisplay = paramControl.querySelector('.parameter-value');
            slider.value = control.param.getNormalized();
            valueDisplay.textContent = control.param.get().toFixed(2);
        }
    });
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





