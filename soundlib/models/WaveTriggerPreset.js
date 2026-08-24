import { WaveTrigger } from './WaveTrigger.js';

// Curated WaveTrigger variant, generated from a saved preset
// (soundlib/presets/WaveTrigger_Birds_preset.json). Narrows gain and select
// to the ranges explored when the preset was saved.
export class WaveTriggerPreset extends WaveTrigger {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = 'Select between different preset wavefiles to play. Another exercise using simple WabAudio API';

        const gainParam = this.getParameter('gain');
        gainParam.preference = 'pitch';
        gainParam.min = 0.55;
        gainParam.max = 0.65;

        const selectParam = this.getParameter('select');
        selectParam.preference = 'roll';
        selectParam.min = 0;
        selectParam.max = 0.05;
    }
}
