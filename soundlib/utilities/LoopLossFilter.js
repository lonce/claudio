// Plain, framework-agnostic broadband loop-loss stage for waveguide-family
// models -- see FractionalDelayWaveguide.js for the placement rationale
// (shared, not model-local; spec's own stated reuse intent).
//
// A separate, explicit component deliberately -- the spec (section 5.3)
// warns against the classic original-Karplus-Strong pitfall of folding
// loss into a two-point averaging filter, which conflates damping with a
// slight, inseparable pitch shift. This stays a pure per-sample scalar
// multiply, with zero phase delay of its own, so it never contributes to
// mistuning -- only FractionalDelayWaveguide's own interpolation does.
//
// Phase A is broadband-only (no frequency-dependent loss/brightnessDecay
// yet -- that's Phase C's dispersion/bridge work per the spec's own
// staging), so this intentionally stays a scalar gain rather than a real
// filter with memory.
//
// IMPORTANT, found empirically (not assumed): decayMath.js's
// perSampleCoefficient(seconds, sampleRate) is NOT the right primitive
// here, despite looking like an obvious fit -- an earlier version of this
// file used it directly and measured a decay roughly `delaySamples` times
// slower than the requested decayTime (confirmed by rendering and
// tracking RMS over time, not by inspection). The reason: this filter is
// only applied once per LOOP TRIP (each sample of stored energy passes
// through it once every `delaySamples` samples, then just sits in the
// delay buffer untouched until it comes back around) -- not once per
// elapsed sample the way perSampleCoefficient assumes. The correct
// per-loop-trip coefficient scales by the loop length itself:
// exp(-delaySamples / (decaySeconds * sampleRate)). setDecayTime() takes
// the current delaySamples explicitly (recomputed every block, alongside
// the delay length itself, since both change together when frequency is
// retuned live).

export class LoopLossFilter {
    constructor(decaySeconds, sampleRate, delaySamples) {
        this.setDecayTime(decaySeconds, sampleRate, delaySamples);
    }

    setDecayTime(decaySeconds, sampleRate, delaySamples) {
        this.coefficient = Math.exp(-delaySamples / (decaySeconds * sampleRate));
    }

    process(sample) {
        return sample * this.coefficient;
    }
}

export default LoopLossFilter;
