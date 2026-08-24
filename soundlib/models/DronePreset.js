import { DroneModel } from './DroneModel.js';

// Curated Drone variant, generated from a saved preset
// (soundlib/presets/Drone_preset.json). Narrows gain and frequency to the
// ranges explored when the preset was saved; waveshape keeps its full range.
export class DronePreset extends DroneModel {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = 'Just the most basic wavetable oscillator in straight-up WebAudio API. Here when you need it.';

        const gainParam = this.getParameter('gain');
        gainParam.preference = 'pitch';
        gainParam.min = 0.55;
        gainParam.max = 0.65;

        const freqParam = this.getParameter('frequency');
        freqParam.preference = 'roll';
        freqParam.min = 341;
        freqParam.max = 539;
    }
}
