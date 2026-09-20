import { MaracaExtended } from './MaracaExtended.js';

// Curated Maraca Extended variant, generated from a saved preset
// (soundlib/presets/Maraca_Extended_preset.json). Every live parameter's
// min/max/default is set to exactly what's recorded in that preset (they
// currently coincide with MaracaExtended's own ranges for several
// parameters, but are set explicitly here rather than relied on by
// coincidence -- see docs/WORKLETS_AND_PRESETS.md).
export class MaracaExtendedPreset extends MaracaExtended {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = 'SHAKE this rattle!';

        const gainParam = this.getParameter('gain');
        gainParam.min = 0;
        gainParam.max = 1;
        gainParam.value = 0.6;
        gainParam.defaultValue = 0.6;

        const shakeEnergyParam = this.getParameter('shakeEnergy');
        shakeEnergyParam.min = 0;
        shakeEnergyParam.max = 1;
        shakeEnergyParam.value = 0;
        shakeEnergyParam.defaultValue = 0;
        shakeEnergyParam.preference = 'shake';

        const systemDecayParam = this.getParameter('systemDecay');
        systemDecayParam.min = 0.01;
        systemDecayParam.max = 2;
        systemDecayParam.value = 0.3;
        systemDecayParam.defaultValue = 0.3;

        const numberOfObjectsParam = this.getParameter('numberOfObjects');
        numberOfObjectsParam.min = 4;
        numberOfObjectsParam.max = 256;
        numberOfObjectsParam.value = 100;
        numberOfObjectsParam.defaultValue = 100;

        const resonanceFrequencyParam = this.getParameter('resonanceFrequency');
        resonanceFrequencyParam.min = 100;
        resonanceFrequencyParam.max = 8000;
        resonanceFrequencyParam.value = 3200;
        resonanceFrequencyParam.defaultValue = 3200;

        const resonanceBandwidthParam = this.getParameter('resonanceBandwidth');
        resonanceBandwidthParam.min = 15;
        resonanceBandwidthParam.max = 4000;
        resonanceBandwidthParam.value = 573.0373593426146;
        resonanceBandwidthParam.defaultValue = 573.0373593426146;

        const collisionRateScaleParam = this.getParameter('collisionRateScale');
        collisionRateScaleParam.min = 0.5;
        collisionRateScaleParam.max = 64;
        collisionRateScaleParam.value = 8;
        collisionRateScaleParam.defaultValue = 8;

        const collisionDecaySecondsParam = this.getParameter('collisionDecaySeconds');
        collisionDecaySecondsParam.min = 0.0001;
        collisionDecaySecondsParam.max = 0.01;
        collisionDecaySecondsParam.value = 0.00044207994889396086;
        collisionDecaySecondsParam.defaultValue = 0.00044207994889396086;
    }
}

export default MaracaExtendedPreset;
