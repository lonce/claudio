import { AudioSystem } from './AudioSystem.js';
import { DroneModel } from './models/DroneModel.js';
import { ClickTrainModel } from './models/ClickTrainModel.js';
import { ClickerWorkletSoundModel } from './models/ClickerWorkletSoundModel.js';
import { createSoundControl } from './ui/SoundControl.js';

const audioSystem = new AudioSystem();

async function initApp() {
    const appContainer = document.getElementById('app');

    try {
        const drone = await audioSystem.createSound(DroneModel, 'Drone');
        const clickTrain = await audioSystem.createSound(ClickTrainModel, 'Click Train');
        const workletClicker = await audioSystem.createSound(ClickerWorkletSoundModel, 'Worklet Clicker');

        appContainer.appendChild(createSoundControl(drone));
        appContainer.appendChild(createSoundControl(clickTrain));
        appContainer.appendChild(createSoundControl(workletClicker));

        // Resume AudioContext on user interaction
        appContainer.addEventListener('click', () => {
            audioSystem.resume();
        }, { once: true });
    } catch (error) {
        console.error('Failed to initialize app:', error);
        appContainer.textContent = 'Failed to load audio components. Please check the console for details.';
    }
}

// async function initApp() {
//     const appContainer = document.getElementById('app');
//     const logElement = document.createElement('div');
//     logElement.style.whiteSpace = 'pre-wrap';
//     logElement.style.fontFamily = 'monospace';
//     logElement.style.marginBottom = '20px';
//     appContainer.appendChild(logElement);

//     function log(message) {
//         logElement.textContent += message + '\n';
//         console.log(message);  // Still log to console for desktop debugging
//     }

//     try {
//         log("Initializing audio system...");
//         await audioSystem.resume();
//         log("Audio system resumed");

//         log("Creating Drone...");
//         const drone = await audioSystem.createSound(DroneModel, 'Drone');
//         log("Drone created");

//         log("Creating Click Train...");
//         const clickTrain = await audioSystem.createSound(ClickTrainModel, 'Click Train');
//         log("Click Train created");

//         log("Creating Worklet Clicker...");
//         const workletClicker = await audioSystem.createSound(ClickerWorkletSoundModel, 'Worklet Clicker');
//         log("Worklet Clicker created");

//         appContainer.appendChild(createSoundControl(drone));
//         appContainer.appendChild(createSoundControl(clickTrain));
//         appContainer.appendChild(createSoundControl(workletClicker));

//         log("All components initialized successfully");
//     } catch (error) {
//         log(`Error: ${error.name}: ${error.message}`);
//         if (error.stack) {
//             log(`Stack trace: ${error.stack}`);
//         }
//     }
// }

// // Ensure AudioContext is resumed on user interaction
// document.body.addEventListener('touchstart', function() {
//     if (audioSystem.context.state === 'suspended') {
//         audioSystem.resume().then(() => {
//             log("AudioContext resumed after user interaction");
//         }).catch(error => {
//             log(`Failed to resume AudioContext: ${error.message}`);
//         });
//     }
// }, {once: true});

// // Ensure AudioContext is resumed on user interaction
// document.body.addEventListener('click', function() {
//     if (audioSystem.context.state === 'suspended') {
//         audioSystem.resume().then(() => {
//             log("AudioContext resumed after user interaction");
//         }).catch(error => {
//             log(`Failed to resume AudioContext: ${error.message}`);
//         });
//     }
// }, {once: true});

window.addEventListener('load', initApp);