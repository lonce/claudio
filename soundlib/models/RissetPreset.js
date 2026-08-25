import { RissetBasic } from './RissetBasic.js';

// Curated Risset variant, generated from a saved preset
// (soundlib/presets/Risset_preset.json). Every live parameter's
// min/max/default is set to exactly what's recorded in that preset (they
// currently coincide with RissetBasic's own ranges, but are set explicitly
// here rather than relied on by coincidence).
export class RissetPreset extends RissetBasic {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = "Risset's Arpeggio is based on set of rich harmonic tones that are ever so slightly mistuned. Here the main frequency as well as the spacing are playable.";

        const gainParam = this.getParameter('gain');
        gainParam.min = 0;
        gainParam.max = 1;
        gainParam.value = 0.3;
        gainParam.defaultValue = 0.3;

        const frequencyParam = this.getParameter('frequency');
        frequencyParam.min = 20;
        frequencyParam.max = 100;
        frequencyParam.value = 60;
        frequencyParam.defaultValue = 60;
        frequencyParam.preference = 'pitch';

        const spacingParam = this.getParameter('spacing');
        spacingParam.min = 0;
        spacingParam.max = 0.25;
        spacingParam.value = 0.05;
        spacingParam.defaultValue = 0.05;
        spacingParam.preference = 'roll';

        const waveshapeParam = this.getParameter('waveshape');
        waveshapeParam.min = 0;
        waveshapeParam.max = 2;
        waveshapeParam.value = 1;
        waveshapeParam.defaultValue = 1;
    }
}
