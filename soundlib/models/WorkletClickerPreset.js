import { ClickerWorkletSoundModel } from './ClickerWorkletSoundModel.js';

// Curated Clicker variant, generated from a saved preset
// (soundlib/presets/Worklet_Clicker_preset.json). Parameters keep
// ClickerWorkletSoundModel's full min/max ranges; only the preset's
// recorded control mappings are applied. Reuses the same worklet as
// ClickerWorkletSoundModel.js -- WORKLET_PATH is inherited via the
// prototype chain, no need to redeclare it.
export class WorkletClickerPreset extends ClickerWorkletSoundModel {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = 'A little exercize using worklets - a phasor is built in the worklet with a rate that can change continuously (between clicks)';

        this.getParameter('gain').preference = 'pitch';
        this.getParameter('rate').preference = 'roll';
    }
}
