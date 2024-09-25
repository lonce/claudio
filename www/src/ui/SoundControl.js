export function createSoundControl(sound) {
    console.log(`createSoundControl for ${sound.name}`);
    
    const container = document.createElement('div');
    container.className = 'sound-control';

    const nameElement = document.createElement('h2');
    nameElement.textContent = sound.name;
    container.appendChild(nameElement);

    const playButton = document.createElement('button');
    playButton.textContent = 'Play';
    playButton.addEventListener('click', () => sound.play());
    container.appendChild(playButton);

    const stopButton = document.createElement('button');
    stopButton.textContent = 'Stop';
    stopButton.addEventListener('click', () => sound.stop());
    container.appendChild(stopButton);

    const parameterContainer = document.createElement('div');
    parameterContainer.className = 'parameter-container';
    container.appendChild(parameterContainer);

    sound.getParameters().forEach(param => {
        const paramControl = document.createElement('div');
        paramControl.className = 'parameter-control';

        const label = document.createElement('label');
        label.textContent = param.name;
        paramControl.appendChild(label);

        if (param.isStringParameter && param.isStringParameter()) {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = param.get();
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault(); // Prevent default to avoid any unintended form submission
                    currentSound.setParameter(param.name, input.value);
                }
            });
            // Prevent updateSliderValues from changing the input while typing
            input.addEventListener('focus', () => {
                input.dataset.editing = 'true';
            });
            input.addEventListener('blur', () => {
                input.dataset.editing = 'false';
                // Update the parameter value when the input loses focus
                currentSound.setParameter(param.name, input.value);
            });
            paramControl.appendChild(input);
        } else {
            // Numerical parameter
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = 0;
            slider.max = 1;
            slider.step = 0.01;
            slider.value = param.getNormalized();
            slider.addEventListener('input', () => {
                param.setNormalized(parseFloat(slider.value));
                sound.setParameter(param.name, param.get());
                valueDisplay.textContent = param.get().toFixed(2);
            });
            paramControl.appendChild(slider);

            const valueDisplay = document.createElement('span');
            valueDisplay.textContent = param.get().toFixed(2);
            paramControl.appendChild(valueDisplay);
        }

        parameterContainer.appendChild(paramControl);
    });

    return container;
}