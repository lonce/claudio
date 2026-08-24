import { RissetBasic } from './RissetBasic.js';

// Curated Risset variant, generated from a saved preset
// (soundlib/presets/Risset_preset.json). Parameters keep RissetBasic's full
// min/max ranges; only the preset's recorded control mappings are applied.
export class RissetPreset extends RissetBasic {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = "Risset's Arpeggio is based on set of rich harmonic tones that are ever so slightly mistuned. Here the main frequency as well as the spacing are playable.";

        this.getParameter('frequency').preference = 'pitch';
        this.getParameter('spacing').preference = 'roll';
    }
}
