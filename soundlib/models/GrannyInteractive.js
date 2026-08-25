import { AnotherGranny } from './AnotherGranny.js';

// Curated AnotherGranny variant, generated from a saved preset
// (soundlib/presets/Granny_interactive.json). Every live parameter's
// min/max/default is set to exactly what's recorded in that preset (they
// currently coincide with AnotherGranny's own ranges, but are set
// explicitly here rather than relied on by coincidence), with two
// exceptions:
// - gain: preset default (0.8) differs from AnotherGranny's own built-in
//   default (0.6), and AnotherGranny's constructor has no way to pass a
//   custom gain default through to BaseSound, so it's set directly here.
// - grainSize: the preset's recorded default (0.9) is outside its own
//   recorded range (0.010-0.5) -- a leftover data inconsistency, not a
//   deliberate value -- so the default/value is left as AnotherGranny's own
//   built-in default rather than copied in; only min/max are applied.
export class GrannyInteractive extends AnotherGranny {
    constructor(context, name, audioFileURL = 'BeingRural22k.mp3') {
        super(context, name, audioFileURL);

        this.docstringPub = 'Granularize sounds at URLs or with Freesound ID number.';

        const gainParam = this.getParameter('gain');
        gainParam.min = 0;
        gainParam.max = 1;
        gainParam.value = 0.8;
        gainParam.defaultValue = 0.8;

        const pitchParam = this.getParameter('pitch');
        pitchParam.min = -2.0;
        pitchParam.max = 2.0;
        pitchParam.value = 0;
        pitchParam.defaultValue = 0;
        pitchParam.preference = 'x';

        const randomizePitchParam = this.getParameter('randomizePitch');
        randomizePitchParam.min = 0;
        randomizePitchParam.max = 1;
        randomizePitchParam.value = 0;
        randomizePitchParam.defaultValue = 0;
        randomizePitchParam.preference = 'y';

        const grainSizeParam = this.getParameter('grainSize');
        grainSizeParam.min = 0.010;
        grainSizeParam.max = 0.5;

        const stepSizeParam = this.getParameter('stepSize');
        stepSizeParam.min = 0;
        stepSizeParam.max = 2;
        stepSizeParam.value = 0.25;
        stepSizeParam.defaultValue = 0.25;
        stepSizeParam.preference = 'pitch';

        const grainPlayIntervalParam = this.getParameter('grainPlayInterval');
        grainPlayIntervalParam.min = 0.05;
        grainPlayIntervalParam.max = 1;
        grainPlayIntervalParam.value = 0.25;
        grainPlayIntervalParam.defaultValue = 0.25;
        grainPlayIntervalParam.preference = 'roll';

        const fileLoopStartParam = this.getParameter('fileLoopStart');
        fileLoopStartParam.min = 0;
        fileLoopStartParam.max = 1;
        fileLoopStartParam.value = 0;
        fileLoopStartParam.defaultValue = 0;

        const fileLoopLengthParam = this.getParameter('fileLoopLength');
        fileLoopLengthParam.min = 0;
        fileLoopLengthParam.max = 1;
        fileLoopLengthParam.value = 1;
        fileLoopLengthParam.defaultValue = 1;

        // fileURL_or_Freesound_soundID is a StringParameter, already set
        // correctly via the constructor arg above -- nothing to override.
    }
}
