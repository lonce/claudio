// Plain, framework-agnostic initial-condition exciter for waveguide-family
// models -- see FractionalDelayWaveguide.js for the shared-placement
// rationale.
//
// Important semantic distinction the spec calls out (section 5.1): this
// creates the resonator's STARTING WAVE STATE at trigger time -- a
// one-time buffer fill -- not an ongoing per-sample excitation signal like
// PhISEM's NoiseBurstExciter (soundlib/utilities/NoiseBurstExciter.js),
// which is a genuinely different operation despite the surface-level
// "noise-based exciter" similarity.
//
// Phase A supports only `noise` and `impulse` shapes -- `triangle`
// (needs excitation position to be meaningful), `filteredNoise`, and
// `externalBuffer` are deferred to later phases per the spec's own
// staging (section 2).

import { SeededRandom } from './SeededRandom.js';

export class InitialConditionExciter {
    constructor(seed = 1) {
        this.random = new SeededRandom(seed);
    }

    reset(seed) {
        this.random.reset(seed);
    }

    // Fills `waveguide`'s loop (delaySamples worth of state) via its own
    // write() -- the same mechanism the steady-state feedback loop uses,
    // so there is only one code path that knows how loop positions map to
    // buffer indices.
    excite(waveguide, delaySamples, shape, energy) {
        const length = Math.max(1, Math.round(delaySamples));

        if (shape === 'impulse') {
            waveguide.write(energy);
            for (let i = 1; i < length; i++) waveguide.write(0);
            return;
        }

        // Default/'noise': classic Karplus-Strong noise-filled state.
        for (let i = 0; i < length; i++) {
            waveguide.write(this.random.bipolar() * energy);
        }
    }
}

export default InitialConditionExciter;
