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

window.addEventListener('load', initApp);