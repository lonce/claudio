import { WaveTrigger } from './WaveTrigger.js';

// Curated WaveTrigger variant, generated from a saved preset
// (soundlib/presets/WaveTrigger_Birds_preset.json). Every live parameter's
// min/max/default is set to exactly what's recorded in that preset (they
// currently coincide with WaveTrigger's own ranges, but are set explicitly
// here rather than relied on by coincidence).
export class WaveTriggerPreset extends WaveTrigger {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = 'Select between different preset wavefiles to play. Another exercise using simple WabAudio API';

        const gainParam = this.getParameter('gain');
        gainParam.min = 0;
        gainParam.max = 1;
        gainParam.value = 0.6;
        gainParam.defaultValue = 0.6;
        gainParam.preference = 'pitch';

        const selectParam = this.getParameter('select');
        selectParam.min = 0;
        selectParam.max = 1;
        selectParam.value = 0;
        selectParam.defaultValue = 0;
        selectParam.preference = 'roll';
    }
}
