import { ClickerWorkletSoundModel } from './ClickerWorkletSoundModel.js';

// Curated Clicker variant, generated from a saved preset
// (soundlib/presets/Worklet_Clicker_preset.json). Every live parameter's
// min/max/default is set to exactly what's recorded in that preset (they
// currently coincide with ClickerWorkletSoundModel's own ranges, but are
// set explicitly here rather than relied on by coincidence). Reuses the
// same worklet as ClickerWorkletSoundModel.js -- WORKLET_PATH is inherited
// via the prototype chain, no need to redeclare it.
export class WorkletClickerPreset extends ClickerWorkletSoundModel {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = 'A little exercize using worklets - a phasor is built in the worklet with a rate that can change continuously (between clicks)';

        const gainParam = this.getParameter('gain');
        gainParam.min = 0;
        gainParam.max = 1;
        gainParam.value = 0.6;
        gainParam.defaultValue = 0.6;
        gainParam.preference = 'pitch';

        const rateParam = this.getParameter('rate');
        rateParam.min = 1;
        rateParam.max = 20;
        rateParam.value = 10;
        rateParam.defaultValue = 10;
        rateParam.preference = 'roll';
    }
}
