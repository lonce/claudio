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
// Phase A (WG1, excite()) supports only `noise` and `impulse` shapes,
// filling a single lumped loop uniformly -- position has no meaning on
// that structure. Phase B (WG2, exciteAtPosition()) adds `triangle` and
// makes `noise`/`impulse` position-localized point excitations, writing
// into both rails of a BidirectionalWaveguide via writeAt() -- setting an
// initial spatial condition, not injecting one sample to propagate later.
// `filteredNoise` and `externalBuffer` remain deferred to later phases.

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

    // Sets an initial condition on a bidirectional pair of rails
    // (soundlib/utilities/BidirectionalWaveguide.js's rightGoing/
    // leftGoing), localized at `position` (0=nut, 1=bridge) along a rail
    // of length `railLength` samples.
    //
    // 'noise'/'impulse': a point excitation -- a single sample per rail at
    // the offset corresponding to `position` (each rail gets half the
    // requested amplitude, since displacement = rightGoing + leftGoing at
    // a given position).
    //
    // 'triangle': NOT localized -- fills the *entire* pair of rails with
    // the classic idealized plucked-string shape (linear ramp from 0 at
    // the nut up to `energy` at `position`, back down to 0 at the bridge),
    // split evenly between both rails (pure initial displacement, zero
    // initial velocity). Both rails are filled independently from the
    // SAME shape function, each evaluated at whatever physical position
    // that rail's own offset-to-position mapping gives for that index --
    // this is what makes the two rails sum back to the correct shape when
    // read together later, not merely each rail resembling the shape on
    // its own.
    exciteAtPosition(rightGoing, leftGoing, railLength, position, shape, energy) {
        const length = Math.max(1, Math.round(railLength));

        if (shape === 'triangle') {
            for (let offset = 0; offset <= length; offset++) {
                const rightPosition = offset / length;
                const rightShape = rightPosition <= position
                    ? energy * (rightPosition / position)
                    : energy * ((1 - rightPosition) / (1 - position));
                rightGoing.writeAt(offset, rightShape / 2);

                const leftPosition = 1 - offset / length;
                const leftShape = leftPosition <= position
                    ? energy * (leftPosition / position)
                    : energy * ((1 - leftPosition) / (1 - position));
                leftGoing.writeAt(offset, leftShape / 2);
            }
            return;
        }

        const value = shape === 'impulse' ? energy : this.random.bipolar() * energy;
        rightGoing.writeAt(position * railLength, value / 2);
        leftGoing.writeAt((1 - position) * railLength, value / 2);
    }
}

export default InitialConditionExciter;
