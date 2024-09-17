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
import { AudioSystem } from './AudioSystem.js';
import { DroneModel } from './models/DroneModel.js'; // any sound models you will use
```

2. Create an instance of the AudioSystem:

```javascript
const audioSystem = new AudioSystem();
```

3. Create sound instances:

```javascript
const drone = await audioSystem.createSound(DroneModel, 'Drone');
```

4. Control the sounds:

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

## Local Development Setup

For local development, follow these steps:

1. Generate SSL certificates for HTTPS:

```bash
node generate-cert.js
```

This creates `server.key` and `server.cert` files in your project directory.

2. Start the local development server:

```bash
node claudioserver.local.js [port]
```

Replace `[port]` with your desired port number (default is 3000).

3. Access your application:
   - HTTP: `http://localhost:[port]`
   - HTTPS: `https://localhost:[port+443]`

Note: When accessing via HTTPS, you may see a browser warning about the certificate. This is normal for self-signed certificates in development.

---

For more detailed information, please refer to the API documentation or contact the project maintainers.

lonce.wyse@upf.edu
