# Claudio Sound Modeling 

This project provides a flexible system for creating and manipulating sound models in a web environment. It leverages the Web Audio API to create complex audio experiences directly in the browser.

## Table of Contents

- [Using Sound Models](#using-sound-models)
- [Developing New Sound Models](#developing-new-sound-models)
- [Local Development Setup](#local-development-setup)

## Using Sound Models

To use the sound models in your application, follow these steps:

1. Import the necessary modules:

```javascript
import { AudioSystem } from '/soundlib/AudioSystem.js';
import { DroneModel, ClickerWorkletSoundModel, AnotherGranny, FaustClarinet } from '/soundlib/models/index.js';
```

2. Create an instance of the AudioSystem:

```javascript
const audioSystem = new AudioSystem();
```

3. Create sound instances:

```javascript
# (classname, arbitrary name, max-polyphony)
const drone = await audioSystem.createSound(DroneModel, 'Drone', 0);
```

4. Control the sounds using the API exploxed by  `BaseSound`:

```javascript
// Play a sound
drone.play();

// Stop a sound
drone.stop();

// Adjust parameters
drone.setParameter('frequency', 440);
clickTrain.setParameter('rate', 5);
```

5. Serving the main app:

```javascript
// install in root directory
npm install 
// run the server, supply an optional port number
node claudioserver.js 7777 

// point your browser to the machine (best to use IP address:port)
// The current app allows you to control parameters with sliders, XY box, or pitch/roll sensors on devices that have them (most phones). Not tested on Safari on iPhones where I believe we need explicit permissions to use sensors.  
```



## Developing New Sound Models

To create a new sound model:

1. Create a new class that extends `BaseSound`:

```javascript
export class MyNewSound extends BaseSound {
    constructor(context, name) {
        super(context, name);
        
        // Initialize your sound-specific properties
        this.oscillator = this.context.createOscillator();
        this.gainNode = this.context.createGain();
        
        // Set up the audio graph
        this.oscillator.connect(this.gainNode);
        this.outputNode = this.gainNode;
        
        // Add parameters
        this.addParameter('frequency', 440, 20, 20000);
        this.addParameter('gain', 0.5, 0, 1);
    }

    startSound() {
        this.oscillator.start();
    }

    stopSound() {
        this.oscillator.stop();
    }

    updateParameter(name) {
        const param = this.getParameter(name);
        switch(name) {
            case 'frequency':
                this.oscillator.frequency.setValueAtTime(param.get(), this.context.currentTime);
                break;
            case 'gain':
                this.gainNode.gain.setTargetAtTime(param.get(), this.context.currentTime, 0.01);
                break;
        }
    }
}
```

2. Implement the required methods:
   - `startSound()`: Called when the sound starts playing.
   - `stopSound()`: Called when the sound stops playing.
   - `updateParameter(name)`: Called when a parameter value changes.

3. Use `this.addParameter()` in the constructor to define adjustable parameters for your sound.

4. Remember to set `this.outputNode` to the final node in your audio graph.

## The App

The sndlib is *entirely* separate from the app. You can simply copy /sndlib into your own app directory tree and load and control the sounds here, or your own (as long as they extend Basesound as described).

This particular app provides a GUI for controlling any sndlib model. Sounds can be controlled through sliders, xy plane coordinates, or pitch and roll accelerators.  

---

For more detailed information, please refer to the API documentation or contact the project maintainers.

lonce.wyse@upf.edu
