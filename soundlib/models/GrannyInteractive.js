import { AnotherGranny } from './AnotherGranny.js';

// Curated AnotherGranny variant, generated from a saved preset
// (soundlib/presets/Granny_interactive.json). Narrows most parameters to
// the ranges explored when the preset was saved.
//
// Two preset values needed correcting rather than copying as-is:
// - gain: preset default (0.8) differs from AnotherGranny's own built-in
//   default (0.6), and AnotherGranny's constructor has no way to pass a
//   custom gain default through to BaseSound, so gain's value/defaultValue
//   are set directly here alongside its min/max.
// - grainSize: preset recorded min == max == 0.5 (the value actually
//   explored) but default == 0.9 (AnotherGranny's own unrelated built-in
//   default -- a stale prefill from the Save dialog), which falls outside
//   that range. Corrected the default to 0.5 to stay consistent with the
//   narrow range actually explored, going through setParameter() (rather
//   than a direct field assignment) because AnotherGranny caches grainSize
//   into an internal this.m_grainDuration field that only updateParameter()
//   keeps in sync.
export class GrannyInteractive extends AnotherGranny {
    constructor(context, name, audioFileURL = 'BeingRural22k.mp3') {
        super(context, name, audioFileURL);

        this.docstringPub = 'Granularize sounds at URLs or with Freesound ID number.';

        const gainParam = this.getParameter('gain');
        gainParam.min = 0.75;
        gainParam.max = 0.8500000000000001;
        gainParam.value = 0.8;
        gainParam.defaultValue = 0.8;

        const pitchParam = this.getParameter('pitch');
        pitchParam.preference = 'x';
        pitchParam.min = -0.2;
        pitchParam.max = 0.2;

        const randomizePitchParam = this.getParameter('randomizePitch');
        randomizePitchParam.preference = 'y';
        randomizePitchParam.min = 0;
        randomizePitchParam.max = 0.05;

        const grainSizeParam = this.getParameter('grainSize');
        grainSizeParam.min = 0.5;
        grainSizeParam.max = 0.5;
        grainSizeParam.defaultValue = 0.5;
        this.setParameter('grainSize', 0.5);

        const stepSizeParam = this.getParameter('stepSize');
        stepSizeParam.preference = 'pitch';
        stepSizeParam.min = 0.15;
        stepSizeParam.max = 0.35;

        const grainPlayIntervalParam = this.getParameter('grainPlayInterval');
        grainPlayIntervalParam.preference = 'roll';
        grainPlayIntervalParam.min = 0.2025;
        grainPlayIntervalParam.max = 0.2975;

        const fileLoopStartParam = this.getParameter('fileLoopStart');
        fileLoopStartParam.min = 0;
        fileLoopStartParam.max = 0.05;

        const fileLoopLengthParam = this.getParameter('fileLoopLength');
        fileLoopLengthParam.min = 0.95;
        fileLoopLengthParam.max = 1;

        // fileURL_or_Freesound_soundID is a StringParameter, already set
        // correctly via the constructor arg above -- nothing to override.
    }
}
