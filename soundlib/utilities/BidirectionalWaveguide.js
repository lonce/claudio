// Plain, framework-agnostic bidirectional (two-rail) digital waveguide --
// the Phase B propagation primitive for waveguide-family models. See
// FractionalDelayWaveguide.js for the placement rationale (shared, not
// model-local) and docs/MODEL_PATTERNS.md's digital-waveguide archetype.
//
// Owns two one-way delay lines -- rightGoing (nut -> bridge) and leftGoing
// (bridge -> nut) -- each a plain FractionalDelayWaveguide used as a rail
// rather than a self-feedback loop (see that file's own comment). This is
// the standard Smith digital-waveguide bidirectional-delay-line
// formulation: the sample that emerges from one rail's far end reflects,
// that same instant, into the OTHER rail's near end at that same
// boundary -- not an invented simplification.
//
// Position convention: p=0 is the nut, p=1 is the bridge. The sample
// currently AT position p on rightGoing is the one written p*railLength
// samples ago (it has travelled that far from the nut); on leftGoing,
// currently at p is the one written (1-p)*railLength samples ago (it
// started at the bridge). Callers (PointPickup, InitialConditionExciter's
// exciteAtPosition()) use this directly via readAt()/writeAt() -- this
// class does not wrap position lookups itself, to keep the propagation
// primitive and the position-interpretation logic separable, per the
// spec's own component-separability requirement (section 4).
//
// Deliberately owns only the two rails and the boundary-reflection
// orchestration, not the terminations or loss filter -- those are passed
// into tick() each call (matching WG1's own compositional style: the
// processor wires everything together explicitly, not hidden inside one
// object), so a future model can supply different termination/loss
// components without reaching into this class's internals.

import { FractionalDelayWaveguide } from './FractionalDelayWaveguide.js';

export class BidirectionalWaveguide {
    constructor(maxRailSamples) {
        this.rightGoing = new FractionalDelayWaveguide(maxRailSamples);
        this.leftGoing = new FractionalDelayWaveguide(maxRailSamples);
        this.railLength = this.rightGoing.buffer.length - 1;
        // The raw bridge-incoming sample, before reflection -- exposed for
        // PointPickup's 'bridgeForce' type, which is inherently a
        // bridge-specific quantity, not a function of pickupPosition.
        this.lastBridgeIncoming = 0;
    }

    reset() {
        this.rightGoing.reset();
        this.leftGoing.reset();
        this.lastBridgeIncoming = 0;
    }

    setRailLength(railLength) {
        const clamped = Math.max(1, Math.min(railLength, this.rightGoing.buffer.length - 2));
        this.railLength = clamped;
    }

    // Advances both rails by one sample: reads what has arrived at each
    // boundary, reflects and applies loss (once per boundary crossing --
    // see LoopLossFilter.js's own comment on why railLength, not the full
    // loop length, is the right argument here so two half-trip
    // applications match WG1's single full-trip one), and writes the
    // result into the OPPOSITE rail's near end.
    tick(nutTermination, bridgeTermination, lossFilter) {
        const bridgeIncoming = this.rightGoing.readAt(this.railLength);
        const nutIncoming = this.leftGoing.readAt(this.railLength);
        this.lastBridgeIncoming = bridgeIncoming;

        const bridgeReflected = lossFilter.process(bridgeTermination.reflect(bridgeIncoming));
        const nutReflected = lossFilter.process(nutTermination.reflect(nutIncoming));

        this.leftGoing.write(bridgeReflected);
        this.rightGoing.write(nutReflected);
    }
}

export default BidirectionalWaveguide;
