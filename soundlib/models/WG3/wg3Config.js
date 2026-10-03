// Plain data, no worklet dependency -- same shape as wg2Config.js/
// wg1Config.js. WG3 reuses every WG2 constant via the spread below rather
// than retyping it (per this model's own "no duplication" directive) --
// only the new filtered/transmitting-bridge-termination constants are
// declared fresh here.

import { WG2_CONFIG } from '../WG2/wg2Config.js';
import { BODY_PRESETS, BODY_PRESET_DEFAULT } from './bodyConfig.js';

// SUPERSEDED (pre-C.5.3 reparameterization): a raw amplitude reflection
// coefficient `reflection` was WG3's primary bridge control through
// C.5.1/C.5.2, including a brief default of 0.6 that turned out to be
// far too aggressive -- amplitude decays as r^(f0*t) per round trip, so
// the musically useful region of a coefficient control is compressed
// into a tiny sliver near r=1 at any playable frequency (reflection=0.6
// "destroys the string" in a couple of cycles at most fundamentals).
// Replaced below by `bridgeDecayVal`, a dimensionless [0,1] knob mapped
// (in bridgeDecayMath.js, NOT here, and NOT in Parameter.js) onto an
// actual bridge-only T60 in seconds -- the physically intelligible
// quantity a listener actually experiences. The raw coefficient `r`
// itself still exists -- FilteredTermination.reflection is still a
// plain field, computed fresh from bridgeDecayVal each block -- it's
// simply no longer a live, independently-settable WG3 Parameter. See
// bridgeDecayMath.js and WG3/knowledge/causal-claims.yaml for the
// verification (one bridge encounter per round trip = once per
// fundamental period) this mapping relies on.

// Dimensionless, [0,1] -- NOT seconds. Deliberately a plain, ordinary
// FloatParameter (ordinary linear getNormalized()/setNormalized(),
// Parameter.js untouched) -- the geometric (log-like) mapping onto
// actual seconds lives entirely in bridgeDecayMath.js's
// bridgeDecayValToSeconds(), so equal slider travel corresponds to equal
// RATIOS of bridge decay time, not equal absolute seconds (matching how
// decay time is perceived, and avoiding relocating the old
// near-1-reflection compression problem into a near-0-seconds one).
// bridgeDecayVal=0.5 lands on sqrt(min*max) seconds (the geometric mean),
// not the arithmetic mean.
export const BRIDGE_DECAY_VAL_MIN = 0;
export const BRIDGE_DECAY_VAL_MAX = 1;
// Default measured directly (see wg3Pipeline.test.js's own default-
// behavior test): musically useful means the pitch stays clearly
// audible for several cycles while the body's own contribution is still
// measurable, replacing the old reflection=0.6 default's "destroys the
// string almost immediately" behavior. 0.55 maps to a bridge-only T60 of
// ~1.69s (bridgeDecayValToSeconds(0.55, 0.05, 30)) -- a clearly sustained
// ring, not a near-instant choke.
export const BRIDGE_DECAY_VAL_DEFAULT = 0.55;

// The actual seconds range bridgeDecayVal maps onto -- provisional, per
// explicit instruction ("may be tested... choose the final range from
// measurements and listening rather than treating these numbers as
// requirements"). 0.05s is a short, percussive bridge decay; 30s is long
// enough to be perceptually close to "no bridge loss" at any playable
// frequency without needing a literal Infinity reachable through the
// live knob (Infinity/off is still supported, exactly, by
// bridgeDecayMath.js's computeBridgeReflectionCoefficient() for direct
// API/diagnostic use -- see that file).
export const BRIDGE_DECAY_TIME_MIN_SECONDS = 0.05;
export const BRIDGE_DECAY_TIME_MAX_SECONDS = 30;

// Physically informed, [-1,1]: blends the bridge's reflection toward a
// one-pole lowpass shape (positive -- high frequencies reflect less,
// "darker") or its complementary highpass shape (negative, "brighter").
// 0 = flat, matching RigidTermination-equivalent behavior in frequency as
// well as magnitude.
export const TERMINATION_REFLECTION_TILT_MIN = -1;
export const TERMINATION_REFLECTION_TILT_MAX = 1;
export const TERMINATION_REFLECTION_TILT_DEFAULT = 0;

// SUPERSEDED: `terminationDamping` (fraction DISSIPATED, [0,1]) is
// replaced by `bodyCouplingEfficiency` (eta, fraction TRANSMITTED,
// [0,1] -- the INVERTED sense, matching the new energy-accounting
// formula directly: transmittedEnergyFraction = eta*(1-r^2)). Renamed,
// not just re-ranged, so FilteredTermination's own low-level
// couplingEfficiency field reads consistently with this one -- no sign-
// flip needed when wiring WG3's parameter straight onto it.
//
// Perceptual macro, [0,1]: what fraction of the energy the bridge
// doesn't reflect reaches the body (transmittedSignal) rather than being
// dissipated at the termination. Irrelevant at bridgeDecayVal's own
// "off" extreme (nothing is ever non-reflected there regardless of
// couplingEfficiency), so changing this alone has no audible effect
// unless bridgeDecayVal is also away from its own no-transmission point.
export const BODY_COUPLING_EFFICIENCY_MIN = 0;
export const BODY_COUPLING_EFFICIENCY_MAX = 1;
// Default measured directly alongside bodyRadiationGain's own
// default (see wg3Pipeline.test.js) -- a balanced starting split between
// transmission and dissipation.
export const BODY_COUPLING_EFFICIENCY_DEFAULT = 0.5;

// Fixed internal shelf-corner frequency for FilteredTermination's one-pole
// tilt filter -- a real constructor argument (not inlined inside
// FilteredTermination.js), matching DispersionFilter's own established
// "internal constants should be real constructor args, not hardcoded
// module constants" precedent, so exposing it as a live Parameter later
// needs no filter rewrite. Physically informed, not physical: 1500Hz is a
// plausible treble-rolloff region for a bridge-like termination, chosen to
// give a clearly audible tilt effect across most of WG3's own 20-4000Hz
// playable range -- not measured against a specific real bridge's own
// impedance curve (no such measurement was done; see
// FilteredTermination.js's own grounding note).
export const BRIDGE_SHELF_CORNER_HZ = 1500;

// Renamed from transmissionMonitorGain/bodyRadiationMonitorGain
// (dropping "Monitor" from all three gain names below, including this
// new one) -- purely cosmetic, no semantic change to either existing
// gain; see wg3PipelineCore.js/wg3Processor.js for where all three are
// actually summed.
//
// pickupGain is the THIRD tap in that same output mix, on the one signal
// that was always unconditionally present with no gain of its own: the
// plain string pickup (`observed`). Unlike transmissionGain/
// bodyRadiationGain (new, opt-in contributions, so they default to 0),
// pickupGain's default MUST be 1 -- it is not a new contribution, it's
// finally giving a name/gain to a signal that was already there, and a
// default of 1 is what keeps every existing render/preset byte-identical.
// Range [0,2] matches transmissionGain's own range below (same kind of
// raw, unfiltered signal magnitude); re-measured together with the other
// two at their own maxes simultaneously -- see wg3Pipeline.test.js's own
// combined gain-staging test for the actual numbers.
export const PICKUP_GAIN_MIN = 0;
export const PICKUP_GAIN_MAX = 2;
export const PICKUP_GAIN_DEFAULT = 1;

// Purely additive output-stage mixing gain -- see wg3Processor.js's
// _finalizeSample()/wg3PipelineCore.js's onSample. Default 0: the
// transmission-port monitor path itself stays silent/opt-in. WG3 at
// EXPLICIT reflectionOverride=1/bodyRadiationGain=0 (not WG3's own
// current defaults -- see those below) renders sample-identical to
// the equivalent WG2 settings (see wg3Pipeline.test.js).
//
// RAISED 2 -> 10 after listening: at 2, transmissionGain's own
// contribution was consistently overshadowed by the (much louder,
// always-present) pickupGain=1 signal, making the parameter read as
// having "no effect" even though it measurably did -- see the
// transmissionMonitorGain investigation this followed up on. At this
// gain alone (pickupGain/bodyRadiationGain left at THEIR OWN
// defaults, not maxed), worst-case peak=3.29, RMS stays low --
// comfortable margin below the 4.0 clamp still holds for the common
// case of raising just this one gain.
//
// ACCEPTED TRADEOFF: when ALL THREE gains (this, pickupGainMax,
// bodyRadiationGainMax) are pushed to their own max SIMULTANEOUSLY, the
// true unclamped peak at one specific corner (low frequency, bridgeDecayVal=0,
// reflectionTilt=-1, bodyCouplingEfficiency=1) measures ~4.68 -- genuinely
// over the 4.0 hard clamp, which will therefore audibly engage there.
// RMS stays low (~0.12) even at that corner -- a single clipped
// transient at one deliberately-extreme combination, not a sustained
// loud/distorted signal or an instability. Explicitly accepted (not
// discovered-and-ignored) after being measured and reported -- see
// wg3Pipeline.test.js's combined gain-staging test for the full
// numbers, and docs/MODEL_PATTERNS.md for the writeup.
export const TRANSMISSION_GAIN_MIN = 0;
export const TRANSMISSION_GAIN_MAX = 10;
export const TRANSMISSION_GAIN_DEFAULT = 0;

// Phase C.5.1 -- see soundlib/utilities/BodyModeBank.js and
// soundlib/models/WG3/bodyConfig.js. Purely additive output-stage mixing
// gain, same shape/rationale as TRANSMISSION_GAIN above: default
// 0 keeps the body monitor path silent/opt-in (the body is always being
// DRIVEN once anything is transmitted -- physical signal flow is never
// gated by this value -- only whether you HEAR its output is). Max set
// from a direct worst-case peak/RMS measurement across the parameter grid
// (see wg3Pipeline.test.js's own gain-staging check) -- NOT guessed.
// Max measured directly, not guessed -- and NOT the same order of
// magnitude as TRANSMISSION_GAIN_MAX above, for a real, measured
// reason: transmittedSignal is a broadband signal of comparable
// magnitude to the waveguide's own internal samples, but BodyModeBank's
// own 4 modes are narrowband (Q=4 each) and only capture a small slice of
// that broadband signal's energy, even after per-mode steady-state-at-
// resonance gain compensation (see BodyModeBank.js/decayMath.js's
// discreteResonatorGainAtCenter) -- a real, physically-expected
// consequence of narrowband filtering against a broadband source, not a
// bug.
//
// RE-MEASURED (pre-C.5.3 reparameterization) against the new
// bridgeDecayVal/bodyCouplingEfficiency formula across all 4 body
// presets: worst-case peak=0.885, RMS=0.168 at this max (100) -- still
// comfortable margin below the 4.0 clamp, confirming this limit remains
// safe under the new accounting.
export const BODY_RADIATION_GAIN_MIN = 0;
export const BODY_RADIATION_GAIN_MAX = 100;
// Default (75) re-confirmed, not just carried over: still gives a
// clearly audible body contribution alongside the new bridgeDecayVal
// default below -- see wg3Pipeline.test.js's "pitch remains clearly
// audible... body contribution also measurable" test.
export const BODY_RADIATION_GAIN_DEFAULT = 75;

export const WG3_CONFIG = {
    ...WG2_CONFIG,
    // WG3-specific override of the INHERITED excitationType parameter's
    // default -- WG2.js's own constructor adds this parameter directly
    // from WG2_CONFIG.excitationTypeDefault ('noise'), not from this
    // object, so changing this key alone does nothing on its own; WG3.js
    // explicitly re-applies it after calling super() (see WG3.js's own
    // constructor), matching the established preset-model pattern
    // (DronePreset.js etc.: set defaultValue/value directly on the
    // already-existing Parameter, no new addParameter() call) rather
    // than touching WG2_CONFIG/WG2.js's own shipped default at all.
    excitationTypeDefault: 'impulse',
    bridgeDecayValMin: BRIDGE_DECAY_VAL_MIN,
    bridgeDecayValMax: BRIDGE_DECAY_VAL_MAX,
    bridgeDecayValDefault: BRIDGE_DECAY_VAL_DEFAULT,
    bridgeDecayTimeMinSeconds: BRIDGE_DECAY_TIME_MIN_SECONDS,
    bridgeDecayTimeMaxSeconds: BRIDGE_DECAY_TIME_MAX_SECONDS,
    terminationReflectionTiltMin: TERMINATION_REFLECTION_TILT_MIN,
    terminationReflectionTiltMax: TERMINATION_REFLECTION_TILT_MAX,
    terminationReflectionTiltDefault: TERMINATION_REFLECTION_TILT_DEFAULT,
    bodyCouplingEfficiencyMin: BODY_COUPLING_EFFICIENCY_MIN,
    bodyCouplingEfficiencyMax: BODY_COUPLING_EFFICIENCY_MAX,
    bodyCouplingEfficiencyDefault: BODY_COUPLING_EFFICIENCY_DEFAULT,
    bridgeShelfCornerHz: BRIDGE_SHELF_CORNER_HZ,
    pickupGainMin: PICKUP_GAIN_MIN,
    pickupGainMax: PICKUP_GAIN_MAX,
    pickupGainDefault: PICKUP_GAIN_DEFAULT,
    transmissionGainMin: TRANSMISSION_GAIN_MIN,
    transmissionGainMax: TRANSMISSION_GAIN_MAX,
    transmissionGainDefault: TRANSMISSION_GAIN_DEFAULT,
    bodyPresets: BODY_PRESETS,
    bodyPresetDefault: BODY_PRESET_DEFAULT,
    bodyPresetChoices: Object.keys(BODY_PRESETS),
    bodyRadiationGainMin: BODY_RADIATION_GAIN_MIN,
    bodyRadiationGainMax: BODY_RADIATION_GAIN_MAX,
    bodyRadiationGainDefault: BODY_RADIATION_GAIN_DEFAULT
};

export default WG3_CONFIG;
