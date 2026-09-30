import { WG1 } from './WG1.js';

// Curated WG1 variant, generated from a saved preset
// (soundlib/presets/WG1_preset.json). Every live parameter's
// min/max/default is set to exactly what's recorded in that preset --
// decayTime and energy's range happen to coincide with WG1's own, but are
// set explicitly here rather than relied on by coincidence; frequency's
// range (40-1200) is deliberately narrower than WG1's full 20-4000.
export class WG1Preset extends WG1 {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = 'Classic and simplified waveguide (Smith, 1983) model.\nPluck the string, roll for for freq, pitch for energy.';

        const gainParam = this.getParameter('gain');
        gainParam.min = 0;
        gainParam.max = 1;
        gainParam.value = 0.6;
        gainParam.defaultValue = 0.6;

        const frequencyParam = this.getParameter('frequency');
        frequencyParam.min = 40;
        frequencyParam.max = 1200;
        frequencyParam.value = 220;
        frequencyParam.defaultValue = 220;
        frequencyParam.preference = 'roll';

        const energyParam = this.getParameter('energy');
        energyParam.min = 0;
        energyParam.max = 1;
        energyParam.value = 0.6;
        energyParam.defaultValue = 0.6;
        energyParam.preference = 'pitch';

        const decayTimeParam = this.getParameter('decayTime');
        decayTimeParam.min = 0.05;
        decayTimeParam.max = 30;
        decayTimeParam.value = 2.5;
        decayTimeParam.defaultValue = 2.5;

        const excitationTypeParam = this.getParameter('excitationType');
        excitationTypeParam.value = 'noise';
        excitationTypeParam.defaultValue = 'noise';
    }
}

export default WG1Preset;
