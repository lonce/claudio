import { WaveTrigger } from './WaveTrigger.js';

// Curated WaveTrigger variant, generated from a saved preset
// (soundlib/presets/WaveTrigger_Birds_preset.json). Parameters keep
// WaveTrigger's full min/max ranges; only the preset's recorded control
// mappings are applied.
export class WaveTriggerPreset extends WaveTrigger {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = 'Select between different preset wavefiles to play. Another exercise using simple WabAudio API';

        this.getParameter('gain').preference = 'pitch';
        this.getParameter('select').preference = 'roll';
    }
}
