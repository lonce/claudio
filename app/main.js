import { AudioSystem } from '/soundlib/AudioSystem.js';
import { DroneModel, ClickerWorkletSoundModel, AnotherGranny, FaustClarinet } from '/soundlib/models/index.js';


const audioSystem = new AudioSystem();
let currentSound = null;
let parameterControls = new Map();
let hasOrientationSupport = false;
let hasOrientationPermission = false;

let needsPermissionRequest = false;

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

    try {
        console.log('Loading sounds...');
        // The third argument can be greater than 0 in which case you get a pool of sounds that can sound simultaneously
        const drone = await audioSystem.createSound(DroneModel, 'Drone', 0);
        const workletClicker = await audioSystem.createSound(ClickerWorkletSoundModel, 'Worklet_Clicker', 0);
        //const granny = await audioSystem.createSound(AnotherGranny, 'Granny', 0, 'https://claudio.sonicthings.org/audioResources/BeingRural22k.mp3');
        //const granny = await audioSystem.createSound(AnotherGranny, 'Granny', 0, 'https://hugofloresgarcia.art/sketch2sound/audio/car-racing/in.wav');
        const granny = await audioSystem.createSound(AnotherGranny, 'Granny', 0, 200995); //808191);
        const faustClarinet = await audioSystem.createSound(FaustClarinet, 'FaustClarinet', 0);

        const sounds = [drone, workletClicker, granny, faustClarinet];

        console.log('Sounds loaded');
        checkOrientationSupport();
        console.log ('Orientation support checked');

        sounds.forEach(sound => {
            const option = document.createElement('option');
            option.value = sound.name;
            option.textContent = sound.name;
            soundSelector.appendChild(option);
        });

        console.log('Sound selector populated');
        soundSelector.addEventListener('change', (e) => {
            audioSystem.resume();
            currentSound = sounds.find(s => s.name === e.target.value);
            initializeParameterControls();
            updateSliderBox();
        });





       // Auto-select from URL if provided
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
        xyPad.addEventListener('mousedown', function(event) {
            mouseDownP=true
        });
        xyPad.addEventListener('mousedown', startSound);
        xyPad.addEventListener('mousemove', updateSound);
        xyPad.addEventListener('mouseup', stopSound);
        xyPad.addEventListener('mouseup', function(event) {
            mouseDownP=false
        });
        xyPad.addEventListener('mouseleave', stopSound);

        xyPad.addEventListener('touchstart', function(event) {
            mouseDownP=true
        });
        xyPad.addEventListener('touchstart', startSound);
        xyPad.addEventListener('touchmove', updateSound);
        xyPad.addEventListener('touchend', stopSound);
        xyPad.addEventListener('touchend', function(event) {
            mouseDownP=false
        });
        xyPad.addEventListener('touchcancel', stopSound);


        console.log(`now initialize parameter controls`);
        initializeParameterControls();
        updateSliderBox();
        console.log('Slider box updated');

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



function checkOrientationSupport() {
    const enableButton = document.createElement('button');
    enableButton.textContent = 'Enable Motion Sensors';
    enableButton.style.position = 'absolute';
    enableButton.style.top = '20px';
    enableButton.style.left = '20px';
    enableButton.style.zIndex = 1000;
    enableButton.style.fontSize = '16px';
    enableButton.style.padding = '10px';

    document.body.appendChild(enableButton);

    if ('DeviceOrientationEvent' in window) {
        hasOrientationSupport = true;
        log('✅ Device orientation support detected');

        enableButton.addEventListener('click', () => {
            if (audioSystem?.resume) {
                audioSystem.resume();
            }

            if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
                // iOS: request permission
                const motionPermission = DeviceMotionEvent?.requestPermission?.();
                const orientationPermission = DeviceOrientationEvent?.requestPermission?.();

                Promise.all([motionPermission, orientationPermission].filter(Boolean))
                    .then(async results => {
                        if (results.includes('granted')) {
                            hasOrientationPermission = true;
                            window.addEventListener('deviceorientation', handleOrientation);
                            log('✅ Orientation permission granted');

                            // 🔒 Attempt fullscreen mode (required for locking orientation)
                            const docEl = document.documentElement;
                            try {
                                if (docEl.requestFullscreen) {
                                    await docEl.requestFullscreen();
                                } else if (docEl.webkitRequestFullscreen) {
                                    await docEl.webkitRequestFullscreen();
                                }
                            } catch (fsErr) {
                                log('⚠️ Fullscreen request failed: ' + (fsErr.name || fsErr.message));
                            }

                            // 🔒 Attempt to lock screen orientation
                            if (screen.orientation?.lock) {
                                try {
                                    await screen.orientation.lock('portrait');
                                    log('🔒 Screen orientation locked to portrait');
                                } catch (err) {
                                    log('⚠️ Screen orientation lock failed: ' + (err.name || err.message));
                                }
                            } else {
                                log('⚠️ Screen orientation lock not supported on this device/browser');
                            }
                        } else {
                            log('❌ Orientation permission denied');
                        }
                    })
                    .catch(err => {
                        log(`❌ Permission error: ${err.name || err.message}`);
                    })
                    .finally(() => {
                        enableButton.remove();
                    });

            } else {
                // Android / desktop — no permission API; just start
                hasOrientationPermission = true;
                window.addEventListener('deviceorientation', handleOrientation);
                log('✅ Orientation event listener attached (no permission needed)');

                // 🔒 Try to lock orientation (with fullscreen)
                const docEl = document.documentElement;
                if (docEl.requestFullscreen || docEl.webkitRequestFullscreen) {
                    try {
                        if (docEl.requestFullscreen) {
                            docEl.requestFullscreen();
                        } else {
                            docEl.webkitRequestFullscreen();
                        }
                    } catch (fsErr) {
                        log('⚠️ Fullscreen request failed: ' + (fsErr.name || fsErr.message));
                    }
                }

                if (screen.orientation?.lock) {
                    screen.orientation.lock('portrait')
                        .then(() => log('🔒 Screen orientation locked to portrait'))
                        .catch(err => log('⚠️ Screen orientation lock failed: ' + (err.name || err.message)));
                }

                enableButton.remove();
            }
        }, { once: true });
    } else {
        log('❌ Device orientation not supported');
    }
}


function requestPermission() {
    if (needsPermissionRequest) {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    hasOrientationPermission = true;
                    window.addEventListener('deviceorientation', handleOrientation);
                    log('Orientation permission granted');
                } else {
                    log('Orientation permission denied');
                }
            })
            .catch(console.error)
            .finally(() => {
                // Reset XY div
                const xyDiv = document.getElementById('xyPad');
                xyDiv.textContent = '';
                xyDiv.removeEventListener('click', requestPermission);
            });
    }
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

///////////////////////////////////////////////////////////////
function updateSliderBox() {
    //log("updateSliderBox")
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

        if (param.isStringParameter()) {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = param.get();
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    currentSound.setParameter(param.name, input.value);
                }
            });
            input.addEventListener('focus', () => {
                input.dataset.editing = 'true';
            });
            input.addEventListener('blur', () => {
                input.dataset.editing = 'false';
                currentSound.setParameter(param.name, input.value);
            });
            paramControl.appendChild(input);
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
            });
            paramControl.appendChild(slider);

            const valueDisplay = document.createElement('span');
            valueDisplay.textContent = param.get();
            paramControl.appendChild(valueDisplay);
        } else {
            // Float parameter
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
        }

        sliderBox.appendChild(paramControl);
    });
}



function startSound(e) {
    //log("start sound");

    e.preventDefault();
    updateSound(e, true);
    currentSound.play()
    
}

function updateSound(e, force=false) {
    if (! mouseDownP) return;

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
                if (valueDisplay) valueDisplay.textContent = param.get().toFixed(2);
            }
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





