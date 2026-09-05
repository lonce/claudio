import { ChimeStrike } from './WindChimes/_ChimeStrike.js';

// Curated ChimeStrike variant, generated from a saved preset
// (soundlib/presets/Chime_Strike_preset.json). Every live parameter's
// min/max/default is set to exactly what's recorded in that preset (they
// currently coincide with ChimeStrike's own ranges, but are set explicitly
// here rather than relied on by coincidence).
export class ChimeStrikePreset extends ChimeStrike {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = 'One wind-chime tube, struck. Ported from a syntex.sonicthings.org python wind-chime sound (5 fixed-ration independently-decaying sine partials per strike).';

        const gainParam = this.getParameter('gain');
        gainParam.min = 0;
        gainParam.max = 1;
        gainParam.value = 0.6;
        gainParam.defaultValue = 0.6;
        gainParam.preference = 'pitch';

        const pitchParam = this.getParameter('pitch');
        pitchParam.min = 54;
        pitchParam.max = 90;
        pitchParam.value = 60;
        pitchParam.defaultValue = 60;
        pitchParam.preference = 'roll';

        const strikeStrengthParam = this.getParameter('strikeStrength');
        strikeStrengthParam.min = 0;
        strikeStrengthParam.max = 1;
        strikeStrengthParam.value = 0.6;
        strikeStrengthParam.defaultValue = 0.6;

        const ampVariationParam = this.getParameter('ampVariation');
        ampVariationParam.min = 0;
        ampVariationParam.max = 1;
        ampVariationParam.value = 0.7;
        ampVariationParam.defaultValue = 0.7;
    }
}
