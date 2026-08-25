import { DroneModel } from './DroneModel.js';

// Curated Drone variant, generated from a saved preset
// (soundlib/presets/Drone_preset.json). Every live parameter's
// min/max/default is set to exactly what's recorded in that preset (they
// currently coincide with DroneModel's own ranges, but are set explicitly
// here rather than relied on by coincidence).
export class DronePreset extends DroneModel {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = 'Just the most basic wavetable oscillator in straight-up WebAudio API. Here when you need it.';

        const gainParam = this.getParameter('gain');
        gainParam.min = 0;
        gainParam.max = 1;
        gainParam.value = 0.6;
        gainParam.defaultValue = 0.6;
        gainParam.preference = 'pitch';

        const frequencyParam = this.getParameter('frequency');
        frequencyParam.min = 20;
        frequencyParam.max = 2000;
        frequencyParam.value = 440;
        frequencyParam.defaultValue = 440;
        frequencyParam.preference = 'roll';

        const waveshapeParam = this.getParameter('waveshape');
        waveshapeParam.min = 0;
        waveshapeParam.max = 3;
        waveshapeParam.value = 0;
        waveshapeParam.defaultValue = 0;
    }
}
