// Model-local helper (WG3-specific domain assumptions live here, not in
// soundlib/utilities/ -- the "one bridge encounter per round trip" model
// is specific to this digital-waveguide architecture, not a general DSP
// mechanism) -- same placement logic as bodyConfig.js.
//
// Replaces the raw amplitude reflection coefficient `reflection` as WG3's
// primary bridge control. The symptom that motivated this: amplitude
// decays as r^(f0*t) per round trip, so a coefficient's musically useful
// region is compressed into a tiny sliver near r=1 at any playable
// frequency -- reflection=0.6 (briefly WG3's own default) was already far
// too aggressive. bridgeDecayVal expresses the SAME underlying control as
// a T60 in seconds instead, which is what a listener actually experiences
// as "how long the bridge lets the string ring."

import { decaySecondsFromT60, perSampleCoefficient } from '../../utilities/decayMath.js';

// Geometric (log-like) map: a dimensionless [0,1] knob -> seconds.
// Deliberately NOT implemented via Parameter's own getNormalized()/
// setNormalized() (which stay linear, unmodified) -- bridgeDecayVal is a
// plain, ordinary FloatParameter; this mapping lives entirely here, in
// WG3-local code, so soundlib/Parameter.js needs zero changes. At
// bridgeDecayVal=0.5, this lands on sqrt(minSeconds*maxSeconds) (the
// geometric mean), not the arithmetic mean -- the whole point of a log
// scale: equal slider travel covers equal RATIOS of seconds, not equal
// absolute seconds, so the musically dense short-decay region isn't
// compressed into a sliver the way the old linear reflection coefficient
// was.
export function bridgeDecayValToSeconds(bridgeDecayVal, minSeconds, maxSeconds) {
    return minSeconds * (maxSeconds / minSeconds) ** bridgeDecayVal;
}

// r = exp(-1/(tau_bridge * f0)) -- reusing decayMath.js's own
// perSampleCoefficient(decaySeconds, sampleRate) with f0 (round trips per
// second) standing in for "sample rate." This is a deliberate reuse, not
// a coincidence: perSampleCoefficient's own job is "the per-period
// multiplier for exponential decay with time constant tau, given periods
// per second = rate" -- generically applicable to ANY discrete periodic
// process, not just literal audio samples. Valid here specifically
// because one bridge encounter happens per physical round trip, and one
// round trip takes exactly 1/f0 seconds (railLength = (sampleRate/f0 -
// compensation)/2, so a full round trip = sampleRate/f0 samples = one
// fundamental period) -- verified directly against
// BidirectionalWaveguide.js/wg2Processor.js, not assumed.
//
// bridgeDecayTimeSeconds of Infinity (or any non-finite value) returns
// r=1 exactly -- perfect reflection, zero transmitted/dissipated energy.
// Reachable via direct calls to this function (tests, diagnostics) even
// though the live bridgeDecayVal knob's own finite [0,1] range doesn't
// reach it through the normal mapping above.
export function computeBridgeReflectionCoefficient(bridgeDecayTimeSeconds, frequencyHz) {
    if (!Number.isFinite(bridgeDecayTimeSeconds)) return 1;
    const tauBridge = decaySecondsFromT60(bridgeDecayTimeSeconds);
    return perSampleCoefficient(tauBridge, frequencyHz);
}

export default { bridgeDecayValToSeconds, computeBridgeReflectionCoefficient };
