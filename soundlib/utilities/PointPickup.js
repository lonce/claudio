// Plain, framework-agnostic position-aware pickup for a
// BidirectionalWaveguide -- see FractionalDelayWaveguide.js for the
// placement rationale and docs/MODEL_PATTERNS.md's digital-waveguide
// archetype.
//
// Displacement and particle velocity fall directly out of the sum/
// difference of the two traveling-wave components at a position -- a
// standard digital-waveguide identity, not an approximation: displacement
// is proportional to (rightGoing + leftGoing) at a point, particle
// velocity to (rightGoing - leftGoing). No separate differentiator filter
// needed for 'velocity'.
//
// 'bridgeForce' is inherently a bridge-specific quantity (the raw,
// pre-reflection bridge-incoming sample) -- it does NOT depend on
// `position` at all, unlike the other two types. Stateless: takes
// position/type per call rather than holding them, since the model reads
// pickupPosition/pickupType fresh each block like every other k-rate
// parameter in this codebase.

export class PointPickup {
    observe(waveguide, position, type) {
        if (type === 'bridgeForce') {
            return waveguide.lastBridgeIncoming;
        }

        const rightValue = waveguide.rightGoing.readAt(position * waveguide.railLength);
        const leftValue = waveguide.leftGoing.readAt((1 - position) * waveguide.railLength);

        if (type === 'velocity') {
            return rightValue - leftValue;
        }

        // Default/'displacement'.
        return rightValue + leftValue;
    }
}

export default PointPickup;
