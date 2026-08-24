import { FaustClarinet } from './FaustClarinet.js';

// Curated FaustClarinet variant, generated from a saved preset
// (soundlib/presets/FaustClarinet_preset.json). Parameters keep
// FaustClarinet's full min/max ranges; only the preset's recorded control
// mappings and defaults are applied.
//
// FaustClarinet discovers most of its parameters asynchronously -- only
// after the Faust WASM module loads, inside its own initialize() -- so
// unlike other preset-derived models, the mapping/default overrides for
// those late parameters can't be set synchronously in this constructor.
// They're chained onto initPromise instead, applied once the base
// parameters actually exist.
export class FaustClarinetPreset extends FaustClarinet {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = 'This is a proof-of-concept Faust language physical model of the clarinet compiled to WASM, and then wrapped in the Claudio WebAudio library.';

        // gain: preset default (0.8) differs from FaustClarinet's own
        // built-in default (0.25); this parameter already exists
        // synchronously (added in FaustClarinet's constructor), so set now.
        const gainParam = this.getParameter('gain');
        gainParam.value = 0.8;
        gainParam.defaultValue = 0.8;

        // note/pressure already match the preset's recorded defaults (60,
        // 0.6) -- nothing to override.

        // breathGain, breathCutoff, vibratoFreq, vibratoGain, reedStiffness,
        // bellOpening, and outGain are discovered from the Faust UI only
        // once the async init above resolves, and their built-in Faust
        // defaults aren't knowable without reading the compiled Faust code
        // (off limits). Set them explicitly from the preset once they exist,
        // so this model's tuning matches what was saved regardless of
        // whatever the compiled module happens to default to.
        this.initPromise = this.initPromise.then(() => {
            const breathGain = this.getParameter('breathGain');
            breathGain.value = 0.1;
            breathGain.defaultValue = 0.1;

            const breathCutoff = this.getParameter('breathCutoff');
            breathCutoff.value = 2000;
            breathCutoff.defaultValue = 2000;

            const vibratoFreq = this.getParameter('vibratoFreq');
            vibratoFreq.value = 5;
            vibratoFreq.defaultValue = 5;
            vibratoFreq.preference = 'x';

            const vibratoGain = this.getParameter('vibratoGain');
            vibratoGain.value = 0.25;
            vibratoGain.defaultValue = 0.25;
            vibratoGain.preference = 'y';

            const reedStiffness = this.getParameter('reedStiffness');
            reedStiffness.value = 0.5;
            reedStiffness.defaultValue = 0.5;

            const bellOpening = this.getParameter('bellOpening');
            bellOpening.value = 0.5;
            bellOpening.defaultValue = 0.5;
            bellOpening.preference = 'roll';

            const outGain = this.getParameter('outGain');
            outGain.value = 0.5;
            outGain.defaultValue = 0.5;
        });
    }
}
