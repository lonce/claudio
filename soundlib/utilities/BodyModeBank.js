// Plain, framework-agnostic shared-excitation mode bank -- the reusable
// mechanism behind a physical "body" downstream of a termination's
// transmission port (see FilteredTermination.js). Reuses ResonatorBank.js
// entirely unchanged; this wraps it for the specific pattern a body
// needs: every mode driven by the SAME shared excitation each sample
// (the way a soundboard responds to whatever arrives at one coupling
// point), not ResonatorBank's own more general per-mode-targeted
// excite(index, amount), which PhISEM models (Maraca/BambooChimes) use
// for per-collision mode SELECTION -- a genuinely different pattern, not
// applicable here.

import { ResonatorBank } from './ResonatorBank.js';
import { discreteResonatorGainAtCenter } from './decayMath.js';

export class BodyModeBank {
    // modeConfigs: array of { frequencyHz, decaySeconds, relativeGain }
    // (a `q` field may also be present, e.g. in bodyConfig.js's own
    // preset data, but is informational only -- this class consumes
    // frequencyHz/decaySeconds directly, never re-derives from q), plain
    // construction-time data -- see e.g.
    // soundlib/models/WG3/bodyConfig.js. Kept deliberately separate from
    // this class: the DSP mechanism here is reusable outside any one
    // string model, the specific mode set is instance/model-specific
    // data.
    //
    // relativeGain is compensated here, at the ACTUAL runtime sampleRate,
    // via decayMath.js's discreteResonatorGainAtCenter -- a continuously-
    // driven near-unity-pole resonant mode's own steady-state gain at
    // resonance is enormous (hundreds to thousands, even at a genuinely
    // low Q) and depends on sampleRate, so this cannot be precomputed
    // once into static config (see bodyConfig.js's own comment). Each
    // mode's compensated gain targets unity steady-state response at its
    // own center frequency under sustained drive, scaled by its
    // relativeGain.
    constructor(sampleRate, modeConfigs) {
        this.bank = new ResonatorBank(sampleRate, modeConfigs.length);
        modeConfigs.forEach((mode, i) => {
            const uncompensatedGain = discreteResonatorGainAtCenter(mode.frequencyHz, mode.decaySeconds, sampleRate);
            const compensatedGain = mode.relativeGain / uncompensatedGain;
            this.bank.setMode(i, mode.frequencyHz, mode.decaySeconds, compensatedGain);
        });
    }

    reset() {
        this.bank.reset();
    }

    // Drives every configured mode with the same shared sample -- the
    // one-point-coupling pattern a physical body needs.
    excite(amount) {
        for (let i = 0; i < this.bank.activeModes; i++) {
            this.bank.excite(i, amount);
        }
    }

    // 1/sqrt(activeModes) normalization -- the same correlated-shared-
    // excitation-sources rationale already established and empirically
    // validated for BellStrike's noise-bank summing and ChimeVocoder's
    // band summing (docs/MODEL_PATTERNS.md archetypes 2 and 10): several
    // modes driven by the identical input are correlated, not
    // independent, sources, so a plain sum would grow roughly with mode
    // count rather than staying level-consistent as modes are added or
    // removed. Documented explicitly (C.5.2): this is a HEADROOM
    // HEURISTIC for a fixed mode count, not a physical energy-
    // conservation guarantee -- correlation between modes varies with
    // their frequencies/Q/the actual drive signal's own spectrum, so
    // 1/sqrt(N) is a reasonable, not exact, correction. Valid for every
    // C.5.2 preset (all four keep mode count at 4); revisit if a future
    // preset changes mode count.
    tick() {
        return this.bank.tick() / Math.sqrt(this.bank.activeModes);
    }
}

export default BodyModeBank;
