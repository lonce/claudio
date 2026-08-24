import { DroneModel } from './DroneModel.js';

// Curated Drone variant, generated from a saved preset
// (soundlib/presets/Drone_preset.json). Parameters keep DroneModel's full
// min/max ranges; only the preset's recorded control mappings are applied.
export class DronePreset extends DroneModel {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = 'Just the most basic wavetable oscillator in straight-up WebAudio API. Here when you need it.';

        this.getParameter('gain').preference = 'pitch';
        this.getParameter('frequency').preference = 'roll';
    }
}
