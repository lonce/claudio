// Plain, framework-agnostic rigid-boundary reflection for waveguide-family
// models -- see FractionalDelayWaveguide.js for the shared-placement
// rationale.
//
// Phase A's FractionalDelayWaveguide loop already represents one full
// round trip (nut -> bridge -> nut), not one one-way traversal -- a real
// string's two rigid, sign-inverting ends cancel over a full round trip
// ((-1)*(-1) = +1), so the net per-loop reflection for two rigid
// terminations is non-inverting by default. Kept as an explicit,
// separable component per the spec's own requirement (section 4: "their
// state and processing responsibilities remain separable in code") rather
// than folded into LoopLossFilter's coefficient, even though both are
// currently just per-sample scalar multiplies -- Phase C's
// BridgeTermination (frequency-dependent, with real state) replaces this
// class without touching LoopLossFilter at all.

export class RigidTermination {
    constructor(reflectionCoefficient = 1) {
        this.reflectionCoefficient = reflectionCoefficient;
    }

    reflect(sample) {
        return sample * this.reflectionCoefficient;
    }
}

export default RigidTermination;
