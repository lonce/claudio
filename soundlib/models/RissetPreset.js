import { RissetBasic } from './RissetBasic.js';

// Curated Risset variant, generated from a saved preset
// (soundlib/presets/Risset_preset.json). Narrows gain, frequency, and
// spacing to the ranges explored when the preset was saved; waveshape
// keeps its full range (the preset recorded the same [0, 2] already
// declared by RissetBasic).
export class RissetPreset extends RissetBasic {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = "Risset's Arpeggio is based on set of rich harmonic tones that are ever so slightly mistuned. Here the main frequency as well as the spacing are playable.";

        const gainParam = this.getParameter('gain');
        gainParam.min = 0.25;
        gainParam.max = 0.35;

        const freqParam = this.getParameter('frequency');
        freqParam.preference = 'pitch';
        freqParam.min = 56;
        freqParam.max = 64;

        const spacingParam = this.getParameter('spacing');
        spacingParam.preference = 'roll';
        spacingParam.min = 0.0375;
        spacingParam.max = 0.0625;
    }
}
