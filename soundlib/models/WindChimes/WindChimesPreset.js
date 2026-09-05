import { WindChimes } from './WindChimes.js';

// Curated WindChimes variant, generated from a saved preset
// (soundlib/presets/Wind_Chimes_preset.json). Every live parameter's
// min/max/default is set to exactly what's recorded in that preset.
//
// pitch_1..pitch_5 are set via setParameter() rather than a direct .value
// assignment (unlike gain/strength below, and unlike every other preset in
// this codebase): WindChimes forwards each pitch_N to its underlying
// ChimeTube once, at construction time (in _createChildren()), so a plain
// .value mutation here would only change the displayed parameter, not the
// tube actually sounding it. setParameter() re-runs that forwarding via
// updateParameter('pitch_N'). gain and strength don't need this -- both
// are only ever read fresh at play/strike time.
export class WindChimesPreset extends WindChimes {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = 'Wind chime ensemble, ported from syntex.sonicthings.org.\n' +
            'Strength is of wind, controlling density and amplitude.\n' +
            'Each pitch has its own stretching factor for partials.\n' +
            'Each strike randomizes the partical relative amplitudes.\n' +
            'Simplex noise zero crossings determine strike times. ';

        const gainParam = this.getParameter('gain');
        gainParam.min = 0;
        gainParam.max = 1;
        gainParam.value = 0.6;
        gainParam.defaultValue = 0.6;
        gainParam.preference = 'pitch';

        const strengthParam = this.getParameter('strength');
        strengthParam.min = 0;
        strengthParam.max = 1;
        strengthParam.value = 0.5;
        strengthParam.defaultValue = 0.5;
        strengthParam.preference = 'roll';

        const pitch1Param = this.getParameter('pitch_1');
        pitch1Param.min = 54;
        pitch1Param.max = 90;
        this.setParameter('pitch_1', 56.98425435044651);
        pitch1Param.defaultValue = 56.98425435044651;

        const pitch2Param = this.getParameter('pitch_2');
        pitch2Param.min = 54;
        pitch2Param.max = 90;
        this.setParameter('pitch_2', 59.19239351251245);
        pitch2Param.defaultValue = 59.19239351251245;

        const pitch3Param = this.getParameter('pitch_3');
        pitch3Param.min = 54;
        pitch3Param.max = 90;
        this.setParameter('pitch_3', 61.4005326745784);
        pitch3Param.defaultValue = 61.4005326745784;

        const pitch4Param = this.getParameter('pitch_4');
        pitch4Param.min = 54;
        pitch4Param.max = 90;
        this.setParameter('pitch_4', 63.60867183664434);
        pitch4Param.defaultValue = 63.60867183664434;

        const pitch5Param = this.getParameter('pitch_5');
        pitch5Param.min = 54;
        pitch5Param.max = 90;
        this.setParameter('pitch_5', 65.81681099871028);
        pitch5Param.defaultValue = 65.81681099871028;
    }
}

export default WindChimesPreset;
