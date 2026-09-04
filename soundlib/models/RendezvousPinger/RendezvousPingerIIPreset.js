import { RendezvousPingerII } from './RendezvousPingerII.js';

// Curated RendezvousPingerII variant, generated from a saved preset
// (soundlib/presets/RendezvousPingerII_preset.json). Every live parameter's
// min/max/default is set to exactly what's recorded in that preset (they
// currently coincide with RendezvousPingerII's own ranges, but are set
// explicitly here rather than relied on by coincidence). Every parameter's
// preset mapping was 'slider', so no preference hints are set.
export class RendezvousPingerIIPreset extends RendezvousPingerII {
    constructor(context, name) {
        super(context, name);

        this.docstringPub = "Two phasers generate events periodically.\nThe 'rendevous' button triggers a drift to the phasor 'rendevous' freqs and phases over transition_dur, and the 'natura;' button triggers a drift back to the 'natural' frequencies and phases. \nThe freq and phase parameters have no effect until triggered. \nChords are major, minor, suspended fourth, and dimished. ";

        const gainParam = this.getParameter('gain');
        gainParam.min = 0;
        gainParam.max = 1;
        gainParam.value = 0.6;
        gainParam.defaultValue = 0.6;

        const naturalFreq1Param = this.getParameter('natural_freq_1');
        naturalFreq1Param.min = 0;
        naturalFreq1Param.max = 20;
        naturalFreq1Param.value = 1.3;
        naturalFreq1Param.defaultValue = 1.3;

        const naturalFreq2Param = this.getParameter('natural_freq_2');
        naturalFreq2Param.min = 0;
        naturalFreq2Param.max = 20;
        naturalFreq2Param.value = 2.1;
        naturalFreq2Param.defaultValue = 2.1;

        const rendezvousFreqParam = this.getParameter('rendezvous_freq');
        rendezvousFreqParam.min = 0;
        rendezvousFreqParam.max = 20;
        rendezvousFreqParam.value = 2.5;
        rendezvousFreqParam.defaultValue = 2.5;

        const rendezvousPhase1Param = this.getParameter('rendezvous_phase_1');
        rendezvousPhase1Param.min = 0;
        rendezvousPhase1Param.max = 1;
        rendezvousPhase1Param.value = 0;
        rendezvousPhase1Param.defaultValue = 0;

        const rendezvousPhase2Param = this.getParameter('rendezvous_phase_2');
        rendezvousPhase2Param.min = 0;
        rendezvousPhase2Param.max = 1;
        rendezvousPhase2Param.value = 0.5;
        rendezvousPhase2Param.defaultValue = 0.5;

        const transitionDurParam = this.getParameter('transition_dur');
        transitionDurParam.min = 0;
        transitionDurParam.max = 60;
        transitionDurParam.value = 5;
        transitionDurParam.defaultValue = 5;

        const transitionSharpnessParam = this.getParameter('transition_sharpness');
        transitionSharpnessParam.min = 0;
        transitionSharpnessParam.max = 6;
        transitionSharpnessParam.value = 3;
        transitionSharpnessParam.defaultValue = 3;

        const fundamental1Param = this.getParameter('fundamental_1');
        fundamental1Param.min = 20;
        fundamental1Param.max = 1000;
        fundamental1Param.value = 196;
        fundamental1Param.defaultValue = 196;

        const fundamental2Param = this.getParameter('fundamental_2');
        fundamental2Param.min = 20;
        fundamental2Param.max = 1000;
        fundamental2Param.value = 293.66;
        fundamental2Param.defaultValue = 293.66;

        const chord1Param = this.getParameter('chord_1');
        chord1Param.min = 1;
        chord1Param.max = 4;
        chord1Param.value = 1;
        chord1Param.defaultValue = 1;

        const chord2Param = this.getParameter('chord_2');
        chord2Param.min = 1;
        chord2Param.max = 4;
        chord2Param.value = 3;
        chord2Param.defaultValue = 3;
    }
}
