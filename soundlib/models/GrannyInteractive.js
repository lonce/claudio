import { AnotherGranny } from './AnotherGranny.js';

// Curated AnotherGranny variant, generated from a saved preset
// (soundlib/presets/Granny_interactive.json). Parameters keep AnotherGranny's
// full min/max ranges; only the preset's recorded control mappings are
// applied, plus one intentional default:
// - gain: preset default (0.8) differs from AnotherGranny's own built-in
//   default (0.6), and AnotherGranny's constructor has no way to pass a
//   custom gain default through to BaseSound, so it's set directly here.
export class GrannyInteractive extends AnotherGranny {
    constructor(context, name, audioFileURL = 'BeingRural22k.mp3') {
        super(context, name, audioFileURL);

        this.docstringPub = 'Granularize sounds at URLs or with Freesound ID number.';

        const gainParam = this.getParameter('gain');
        gainParam.value = 0.8;
        gainParam.defaultValue = 0.8;

        this.getParameter('pitch').preference = 'x';
        this.getParameter('randomizePitch').preference = 'y';
        this.getParameter('stepSize').preference = 'pitch';
        this.getParameter('grainPlayInterval').preference = 'roll';

        // fileURL_or_Freesound_soundID is a StringParameter, already set
        // correctly via the constructor arg above -- nothing to override.
    }
}
