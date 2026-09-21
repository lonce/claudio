// Plain data, no AudioWorkletProcessor dependency -- same pattern as
// soundlib/worklets/bambooChimeConfig.js. Reuses BambooChimes' own tuned-
// tube constants directly (not duplicated) since ChimeVocoder's hidden
// chime engine is the exact same engine, just never summed into output.

import { BAMBOO_CHIME_CONFIG, BAMBOO_TUBE_FREQUENCIES, NUMBER_OF_TUBES } from '../../worklets/bambooChimeConfig.js';

export { BAMBOO_CHIME_CONFIG, BAMBOO_TUBE_FREQUENCIES, NUMBER_OF_TUBES };

// Not sourced from STK/Cook -- no PhISEM-family precedent for a vocoder
// envelope-follower time constant. Informed starting point only, needs a
// listening pass, same caveat as BambooChimes' own outputGain.
export const ENVELOPE_SMOOTHING_DEFAULT = 0.02; // 20ms
export const ENVELOPE_SMOOTHING_MIN = 0.001;    // 1ms
export const ENVELOPE_SMOOTHING_MAX = 0.25;     // 250ms

// Not sourced -- empirically checked, not just guessed: with a plain
// white-noise stand-in carrier, the summed carrier filterbank (7 high-Q
// resonators, strongly correlated since they share one input) hit the
// output's hard clamp even at outputGain=0.1 before the processor's
// 1/sqrt(NUMBER_OF_TUBES) band-sum normalization was added; with that
// normalization in place, 0.2 leaves headroom below the clamp for that
// same test signal. Still needs a real listening pass with the actual
// GrannyInteractive carrier, whose loudness profile differs from white
// noise.
export const OUTPUT_GAIN = 0.2;

export const CHIME_VOCODER_CONFIG = {
    envelopeSmoothingDefault: ENVELOPE_SMOOTHING_DEFAULT,
    envelopeSmoothingMin: ENVELOPE_SMOOTHING_MIN,
    envelopeSmoothingMax: ENVELOPE_SMOOTHING_MAX,
    outputGain: OUTPUT_GAIN
};

export default CHIME_VOCODER_CONFIG;
