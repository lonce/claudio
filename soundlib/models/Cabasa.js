import { MaracaExtended } from './MaracaExtended.js';
import { decaySecondsFromCoefficient, bandwidthFromDecay } from '../utilities/decayMath.js';

// STK (github.com/thestk/stk, src/Shakers.cpp) implements Maraca and Cabasa
// as ONE shared PhISEM algorithm -- identical tick() code, only a
// per-instrument constant table differs (type 0 vs type 1). These three are
// Cabasa's cited coefficients, converted the same way Maraca.js/
// maracaConfig.js already convert Maraca's own (see docs/MODEL_PATTERNS.md,
// "Decay constants must be derived, not transcribed").
//
// STK cabasa systemDecay coefficient 0.997 @44.1kHz -> ~0.00755s.
const CABASA_SYSTEM_DECAY_DEFAULT = decaySecondsFromCoefficient(0.997, 44100);
// STK cabasa resonance pole radius 0.7 @44.1kHz -> ~0.0000636s decay,
// bandwidthFromDecay(...) ~= 5007 Hz (Q@3000Hz ~= 0.6 -- barely resonant at
// all, matching an independent secondary source's description of cabasa's
// resonance as "less pronounced... a single [weak] resonance").
const CABASA_MODE_DECAY_SECONDS = decaySecondsFromCoefficient(0.7, 44100);
// STK cabasa per-event soundDecay coefficient 0.96 @44.1kHz -> ~0.000555s
// (longer/softer than Maraca's own 0.95-derived ~0.000442s -- many small
// beads read as a softer transient than few larger beans).
const CABASA_COLLISION_DECAY_SECONDS = decaySecondsFromCoefficient(0.96, 44100);

/**
 * Cabasa: the same PhISEM worklet as Maraca/MaracaExtended (no new DSP,
 * no new worklet), retuned to STK's cited Cabasa constants instead of its
 * Maraca ones -- the Phase F "close relative" test of
 * fromChat/energy/Claudio-PhISEM-Architecture-and-Maraca-First-Pass.md,
 * confirming the architecture generalizes via configuration alone. See
 * docs/MODEL_PATTERNS.md archetype 5.1.
 *
 * numberOfObjects' default (512) is STK's own cited Cabasa object count,
 * reused directly -- but our collision-probability law
 * (StochasticCollisionGenerator: rate = rateScale * energy * numberOfObjects)
 * is not the same law STK uses, so this is a same-value coincidence, not a
 * law-preserving transcription; collisionRateScale is left at Maraca's own
 * default (no STK equivalent to source it from) so numberOfObjects alone
 * carries the density difference, matching STK's own approach.
 */
export class Cabasa extends MaracaExtended {
    constructor(context, name, options = {}) {
        super(context, name, options);

        const systemDecayParam = this.getParameter('systemDecay');
        systemDecayParam.min = 0.001; // sourced default (~0.00755s) is below Maraca's inherited 0.01 floor
        systemDecayParam.value = CABASA_SYSTEM_DECAY_DEFAULT;
        systemDecayParam.defaultValue = CABASA_SYSTEM_DECAY_DEFAULT;

        const resonanceFrequencyParam = this.getParameter('resonanceFrequency');
        resonanceFrequencyParam.value = 3000;
        resonanceFrequencyParam.defaultValue = 3000;

        const cabasaResonanceBandwidth = bandwidthFromDecay(CABASA_MODE_DECAY_SECONDS);
        const resonanceBandwidthParam = this.getParameter('resonanceBandwidth');
        resonanceBandwidthParam.max = 6000; // sourced default (~5007 Hz) exceeds MaracaExtended's own 4000 max
        resonanceBandwidthParam.value = cabasaResonanceBandwidth;
        resonanceBandwidthParam.defaultValue = cabasaResonanceBandwidth;

        const collisionDecaySecondsParam = this.getParameter('collisionDecaySeconds');
        collisionDecaySecondsParam.value = CABASA_COLLISION_DECAY_SECONDS;
        collisionDecaySecondsParam.defaultValue = CABASA_COLLISION_DECAY_SECONDS;

        const numberOfObjectsParam = this.getParameter('numberOfObjects');
        numberOfObjectsParam.min = 32;
        numberOfObjectsParam.max = 1024;
        numberOfObjectsParam.value = 512;
        numberOfObjectsParam.defaultValue = 512;

        this.docstringPub = 'Scrape or shake the cabasa!';
    }
}

export default Cabasa;
