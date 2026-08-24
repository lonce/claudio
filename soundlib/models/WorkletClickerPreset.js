import { ClickerWorkletSoundModel } from './ClickerWorkletSoundModel.js';

// Curated Clicker variant, generated from a saved preset
// (soundlib/presets/Worklet_Clicker_preset.json). Narrows gain and rate to
// the ranges explored when the preset was saved. Reuses the same worklet as
// ClickerWorkletSoundModel.js -- WORKLET_PATH is inherited via the prototype
// chain, no need to redeclare it.
export class WorkletClickerPreset extends ClickerWorkletSoundModel {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = 'A little exercize using worklets - a phasor is built in the worklet with a rate that can change continuously (between clicks)';

        const gainParam = this.getParameter('gain');
        gainParam.preference = 'pitch';
        gainParam.min = 0.55;
        gainParam.max = 0.65;

        const rateParam = this.getParameter('rate');
        rateParam.preference = 'roll';
        rateParam.min = 9.05;
        rateParam.max = 10.95;
    }
}
