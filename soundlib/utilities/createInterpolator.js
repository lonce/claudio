// Shared factory for the swappable fractional-delay interpolation
// strategies (see LinearInterpolator.js/AllpassInterpolator.js/
// LagrangeInterpolator.js for each one's own comment and measured
// tradeoffs). One place that knows the mode-string-to-class mapping and
// the actual default, so BidirectionalWaveguide.js, WG1's processor, and
// both pipeline cores can't drift out of sync with each other about which
// one is currently the default.
//
// lagrange3 is the default -- chosen from a measured comparison (see
// docs/MODEL_PATTERNS.md's digital-waveguide archetype and
// soundlib/models/WG1/knowledge/causal-claims.yaml): it fixes linear
// interpolation's high-frequency energy-preservation/decay-time-accuracy
// problem almost as completely as allpass1 does, while introducing none
// of allpass1's serious side effects (frequency-dependent mistuning up to
// -18% at high frequency, measurable low-harmonic phase distortion, and a
// ~40x transient spike during a live frequency ramp -- a real risk here
// specifically, since `frequency` is a continuously live-retunable
// parameter in every model built on this class).

import { LinearInterpolator } from './LinearInterpolator.js';
import { AllpassInterpolator } from './AllpassInterpolator.js';
import { LagrangeInterpolator } from './LagrangeInterpolator.js';

export const DEFAULT_INTERPOLATION_MODE = 'lagrange3';

export function createInterpolator(interpolationMode = DEFAULT_INTERPOLATION_MODE) {
    if (interpolationMode === 'linear') return new LinearInterpolator();
    if (interpolationMode === 'allpass1') return new AllpassInterpolator();
    return new LagrangeInterpolator(); // 'lagrange3' and the default
}

export default createInterpolator;
