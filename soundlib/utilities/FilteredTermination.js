// Plain, framework-agnostic frequency-dependent reflection/transmission/
// dissipation boundary for waveguide-family models -- see
// RigidTermination.js for the simpler sibling this replaces at the bridge
// boundary, and BidirectionalWaveguide.js for how a termination is called
// from tick(). Matches component.filtered-termination, the id
// scratch/WaveguideResonator-v1-Specification-and-Reasoning-Model.md's own
// worked examples (sections 9.6 and 12) anticipate for this role.
//
// Drop-in at the call-site level: reflect(incidentSample) has the exact
// same signature as RigidTermination.reflect(), so BidirectionalWaveguide
// needs no changes to use one in place of the other. Unlike
// RigidTermination, this also produces a transmittedSignal (read via
// lastTransmitted -- see BidirectionalWaveguide.lastTransmittedSignal) and
// tracks a dissipated portion, per the spec's section 5.5
// ("BridgeTermination: frequency-dependent reflection plus an estimate of
// transmitted energy").
//
// Labeled "physically informed," not "physical": this is a deliberately
// simple, stable, low-order filter (one real pole), per the spec's own
// explicit v1 allowance ("BridgeTermination may be a stable low-order
// filter rather than a full impedance-derived model"), not a design
// grounded in a specific cited source the way DispersionFilter's allpass
// cascade is.
//
// ENERGY ACCOUNTING (revised): reflected/transmitted/dissipated satisfy
// reflected^2 + transmitted^2 + dissipated^2 === incidentSample^2 exactly,
// every sample, at reflectionTilt=0 -- an ENERGY identity, not the
// AMPLITUDE identity (incident === reflected + transmitted + dissipated)
// an earlier version of this file used. The two cannot both hold exactly
// (an exact linear sum and an exact quadratic sum are generally
// incompatible for the same three-way split), and a raw `1-r` amplitude
// proxy for "everything not reflected" is NOT an energy-conserving
// quantity -- it was relabeled rather than kept as a convenient
// approximation. See WG3/knowledge/causal-claims.yaml for the superseded
// claim and its replacement. At reflectionTilt != 0, this identity is an
// approximation, not yet proven/tested exact -- see couplingEfficiency's
// own comment on reflect() below.

// Standard one-pole-lowpass design identity: the pole that gives a
// -3dB corner at fc Hz. This is NOT decayMath.js's
// perSampleCoefficient()/decaySecondsFromCoefficient() -- those solve a
// different problem (converting an amplitude-ENVELOPE decay time constant
// to/from a per-sample multiplier). This is a FILTER CUTOFF, a different
// quantity that happens to produce a similarly-shaped exp() formula --
// don't conflate the two (the same kind of flag DispersionFilter's own
// comments carry for its two different uses of the literal number 2).
function onePoleLowpassCoefficient(cornerHz, sampleRate) {
    return Math.exp((-2 * Math.PI * cornerHz) / sampleRate);
}

// Fixed sign convention for a real string-end boundary, matching
// RigidTermination's own default (see that file's header comment: two
// sign-inverting ends cancel over one WG1 round trip, but WG2's two
// separate boundaries each need the inversion individually). Not user-
// exposed -- there is no requirement here (unlike dispersion's explicit
// "leave room for negative dispersion" instruction) to expose a
// non-inverting bridge polarity in v1.
const BRIDGE_POLARITY = -1;

export class FilteredTermination {
    // couplingEfficiency (eta, [0,1]): fraction of the NON-reflected
    // energy that reaches transmittedSignal rather than being dissipated
    // -- 1 = fully transmitted, 0 = fully dissipated. Renamed from an
    // earlier terminationDamping (which was the inverted sense -- fraction
    // DISSIPATED) to match the energy-accounting language directly: this
    // is exactly the eta in transmittedEnergy = eta*(1-r^2).
    constructor(sampleRate, shelfCornerHz, reflection = 1, reflectionTilt = 0, couplingEfficiency = 0) {
        this.sampleRate = sampleRate;
        this.shelfCornerHz = shelfCornerHz;
        this.pole = onePoleLowpassCoefficient(shelfCornerHz, sampleRate);

        this.reflection = reflection;
        this.reflectionTilt = reflectionTilt;
        this.couplingEfficiency = couplingEfficiency;

        this.lpState = 0;

        this.lastReflected = 0;
        this.lastTransmitted = 0;
        this.lastDissipated = 0;
    }

    reset() {
        this.lpState = 0;
        this.lastReflected = 0;
        this.lastTransmitted = 0;
        this.lastDissipated = 0;
    }

    // Returns the sample to feed back into the waveguide (same contract as
    // RigidTermination.reflect()). transmittedSignal/dissipated are
    // produced as a side effect and read back via lastTransmitted/
    // lastDissipated, matching the established this.lastX diagnostic-field
    // convention (BidirectionalWaveguide.lastBridgeIncoming,
    // DispersionFilter.lastTarget).
    reflect(incidentSample) {
        const p = this.pole;
        const lp = (1 - p) * incidentSample + p * this.lpState;
        this.lpState = lp;
        const hp = incidentSample - lp; // exact complementary highpass, same state, no extra cost

        const tilt = this.reflectionTilt;
        const absTilt = Math.abs(tilt);
        const shapeResponse = tilt >= 0 ? lp : hp;

        // baseReflected's magnitude is <= this.reflection <= 1 at every
        // frequency: a convex combination ((1-absTilt) + absTilt, weights
        // summing to 1) of two responses each individually magnitude <= 1
        // (the flat unity response, and a standard one-pole LP/HP) stays
        // magnitude <= 1 by the triangle inequality -- passive by
        // construction. Verified empirically (swept-sinusoid steady-state
        // magnitude), not just asserted -- see FilteredTermination.test.js.
        // Unchanged by the energy-accounting revision below.
        const baseReflected = this.reflection * ((1 - absTilt) * incidentSample + absTilt * shapeResponse);
        const reflectedWave = BRIDGE_POLARITY * baseReflected;

        // Energy-exact three-way scalar split, at reflectionTilt=0:
        // reflected/transmitted/dissipated are all plain scalar multiples
        // of the SAME incident sample (r*x, t*x, d*x), with
        // r^2 + t^2 + d^2 = r^2 + (1-r^2) = 1 identically -- so
        // reflected^2 + transmitted^2 + dissipated^2 === incidentSample^2
        // exactly, every sample, by construction (not a statistical/
        // averaged property). t/d are deliberately computed from the
        // SCALAR this.reflection, not from the tilt-shaped baseReflected
        // above -- this keeps them well-defined and bounded at any tilt,
        // but means the exact identity is proven/tested only at tilt=0;
        // under tilt!=0 it is an approximation (baseReflected's own
        // magnitude can differ from this.reflection*incidentSample at a
        // given frequency, so the three squared terms no longer sum to
        // incidentSample^2 exactly) -- not yet integrated, per explicit
        // instruction to establish the broadband mapping first.
        const r = this.reflection;
        const nonReflectedEnergyFraction = Math.max(0, 1 - r * r);
        const t = Math.sqrt(this.couplingEfficiency * nonReflectedEnergyFraction);
        const d = Math.sqrt((1 - this.couplingEfficiency) * nonReflectedEnergyFraction);
        const transmittedSignal = t * incidentSample;
        const dissipated = d * incidentSample;

        this.lastReflected = reflectedWave;
        this.lastTransmitted = transmittedSignal;
        this.lastDissipated = dissipated;

        return reflectedWave;
    }
}

export default FilteredTermination;
