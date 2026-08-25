import { FaustClarinet } from './FaustClarinet.js';

// Curated FaustClarinet variant, generated from a saved preset
// (soundlib/presets/FaustClarinet_preset.json). Every live parameter's
// min/max/default is set to exactly what's recorded in that preset -- per
// the Save Preset dialog's policy (app/SavePresetDialog.js): the dialog
// prefills min/max from the base model's own range, but whatever ends up in
// the saved JSON (edited or not) is authoritative for the derived model.
//
// FaustClarinet discovers most of its parameters asynchronously -- only
// after the Faust WASM module loads, inside its own initialize() -- so
// unlike other preset-derived models, these overrides for the late
// parameters can't be applied synchronously in this constructor. They're
// chained onto initPromise instead, applied once the base parameters
// actually exist.
export class FaustClarinetPreset extends FaustClarinet {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = 'This is a proof-of-concept Faust language physical model of the clarinet compiled to WASM, and then wrapped in the Claudio WebAudio library.';

        // gain, note, pressure already exist synchronously (added in
        // FaustClarinet's own constructor), so set them now.
        const gainParam = this.getParameter('gain');
        gainParam.min = 0;
        gainParam.max = 1;
        gainParam.value = 0.8;
        gainParam.defaultValue = 0.8;

        const noteParam = this.getParameter('note');
        noteParam.min = 35;
        noteParam.max = 75;
        noteParam.value = 60;
        noteParam.defaultValue = 60;

        const pressureParam = this.getParameter('pressure');
        pressureParam.min = 0.01;
        pressureParam.max = 1;
        pressureParam.value = 0.6;
        pressureParam.defaultValue = 0.6;

        // breathGain, breathCutoff, vibratoFreq, vibratoGain, reedStiffness,
        // bellOpening, and outGain are discovered from the Faust UI only
        // once the async init above resolves. Apply the preset's recorded
        // min/max/default/mapping once they exist.
        this.initPromise = this.initPromise.then(() => {
            const breathGain = this.getParameter('breathGain');
            breathGain.min = 0;
            breathGain.max = 1;
            breathGain.value = 0.1;
            breathGain.defaultValue = 0.1;

            const breathCutoff = this.getParameter('breathCutoff');
            breathCutoff.min = 20;
            breathCutoff.max = 20000;
            breathCutoff.value = 2000;
            breathCutoff.defaultValue = 2000;

            const vibratoFreq = this.getParameter('vibratoFreq');
            vibratoFreq.min = 0.1;
            vibratoFreq.max = 10;
            vibratoFreq.value = 5;
            vibratoFreq.defaultValue = 5;
            vibratoFreq.preference = 'x';

            const vibratoGain = this.getParameter('vibratoGain');
            vibratoGain.min = 0;
            vibratoGain.max = 1;
            vibratoGain.value = 0.25;
            vibratoGain.defaultValue = 0.25;
            vibratoGain.preference = 'y';

            const reedStiffness = this.getParameter('reedStiffness');
            reedStiffness.min = 0;
            reedStiffness.max = 1;
            reedStiffness.value = 0.5;
            reedStiffness.defaultValue = 0.5;

            const bellOpening = this.getParameter('bellOpening');
            bellOpening.min = 0;
            bellOpening.max = 1;
            bellOpening.value = 0.5;
            bellOpening.defaultValue = 0.5;
            bellOpening.preference = 'roll';

            const outGain = this.getParameter('outGain');
            outGain.min = 0;
            outGain.max = 1;
            outGain.value = 0.5;
            outGain.defaultValue = 0.5;
        });
    }
}
