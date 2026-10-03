import { WG2 } from './WG2.js';
import { WG3_CONFIG } from './WG3/wg3Config.js';

/**
 * WaveguideResonator v1, Phase C (continued) -- `WG3` extends `WG2` with a
 * filtered, transmitting bridge termination (see
 * soundlib/utilities/FilteredTermination.js/BridgeTermination.js and
 * soundlib/models/WG3/wg3Processor.js), so the new bridge can actually be
 * heard: `bridgeDecayVal`/`reflectionTilt`/`bodyCouplingEfficiency` shape
 * the bridge's own frequency-dependent reflection, and
 * `transmissionGain` mixes the portion of each pluck's energy that
 * the bridge DOESN'T reflect back into the audible output. `pickupGain`
 * and `bodyRadiationGain` are the other two taps in that same output
 * mix (see below) -- all three were originally named with a "Monitor"
 * suffix (`transmissionMonitorGain`/`bodyRadiationMonitorGain`), dropped
 * for brevity once a third, symmetric tap (`pickupGain`) was added. See
 * docs/MODEL_PATTERNS.md's digital-waveguide archetype.
 *
 * Pre-C.5.3 reparameterization: `bridgeDecayVal` (a dimensionless [0,1]
 * knob, NOT seconds directly -- see bridgeDecayMath.js for the geometric
 * mapping) and `bodyCouplingEfficiency` ([0,1], fraction of the energy
 * the bridge doesn't reflect that reaches the body rather than being
 * dissipated) replace the earlier raw `reflection`/`terminationDamping`
 * controls -- a raw per-round-trip amplitude coefficient's musically
 * useful region is compressed into a sliver near 1 at any playable
 * frequency. `wg3Processor.js`'s `getBridgeDiagnostics()` exposes the
 * mapped seconds value and the computed low-level reflection coefficient
 * for inspection.
 *
 * Phase C.5.1 adds a one-way downstream body (see
 * soundlib/utilities/BodyModeBank.js / soundlib/models/WG3/bodyConfig.js):
 * the termination's own transmittedSignal drives a small, fixed bank of
 * resonant modes, with `bodyRadiationGain` mixing the body's own
 * radiated output into the audible signal -- independently of
 * `transmissionGain`, so the raw transmitted signal and the body's
 * own resonant response can be monitored separately or together. The body
 * never returns energy to the string -- strictly one-way.
 *
 * Phase C.5.2 adds `bodyPreset`, a live-switchable choice among several
 * NAMED body configurations (see bodyConfig.js's `BODY_PRESETS` registry)
 * -- the same exciter/string/termination/coupling can acquire a
 * distinctly different identity when only the body swaps, directly
 * comparable in the app, not just in offline tests. Follows the existing
 * `excitationType`/`pickupType` string-parameter pattern exactly (a
 * plain string Parameter, switched live via a worklet postMessage, not
 * an AudioParam).
 *
 * The first "extend an existing top-level model to add real new
 * capability" case in this codebase -- every other `extends` relationship
 * among SoundModels is the preset pattern (override existing parameter
 * VALUES only). Everything WG2 already does (frequency/energy/decayTime/
 * excitationPosition/pickupPosition/stiffness/dispersionPivot/
 * dispersionSlope/excitationType/pickupType, the pluck event, the attack/
 * decay lifecycle, node wiring) is inherited unchanged; only the new
 * parameters below are genuinely new here.
 *
 * A `reflectionOverride` of 1 (the WG2-equivalent no-op point, available
 * via `wg3PipelineCore.js`'s advanced/diagnostic path, not through this
 * class's own live Parameters) still renders sample-identical to the
 * equivalent WG2 settings -- that equivalence is preserved and tested.
 * `bridgeDecayVal`'s own default is NOT that no-op point -- it's measured
 * to keep the pitch clearly audible for several cycles while the body's
 * own contribution stays measurable (see wg3Config.js's own comment for
 * the measured value and why a near-1 raw coefficient default turned out
 * to be far too aggressive). `bodyRadiationGain` (default 75)
 * likewise defaults away from silent, so the body's coloration is
 * audible out of the box. `pickupGain` defaults to 1 (not 0, unlike the
 * other two gains) since it's not a new contribution -- it's a gain on
 * the signal that was always unconditionally present. `excitationType`
 * also defaults to 'impulse' here (WG2's OWN default stays 'noise',
 * untouched -- see the constructor's own comment) so a plucked pitch is
 * clearly audible.
 */
export class WG3 extends WG2 {
    static WORKLET_PATH = new URL('./WG3/wg3Processor.js', import.meta.url).href;
    static PROCESSOR_NAME = 'wg3Processor';

    constructor(context, name, options = {}) {
        super(context, name, options);

        // WG2's own constructor (just run via super() above) already
        // added 'excitationType' using WG2_CONFIG.excitationTypeDefault
        // ('noise') -- WG2.js reads that constant directly, not
        // WG3_CONFIG, so WG2's own shipped default is untouched by this.
        // WG3 wants a different default ('impulse') without touching
        // WG2 at all, so it's reapplied here directly on the
        // already-existing Parameter object -- the same pattern
        // preset-derived models use (e.g. DronePreset.js: set
        // defaultValue/value directly, no new addParameter() call).
        const excitationTypeParam = this.getParameter('excitationType');
        excitationTypeParam.defaultValue = WG3_CONFIG.excitationTypeDefault;
        excitationTypeParam.value = WG3_CONFIG.excitationTypeDefault;

        this.addParameter(
            'bridgeDecayVal',
            WG3_CONFIG.bridgeDecayValDefault,
            WG3_CONFIG.bridgeDecayValMin,
            WG3_CONFIG.bridgeDecayValMax,
            0,
            0
        );
        this.addParameter(
            'reflectionTilt',
            WG3_CONFIG.terminationReflectionTiltDefault,
            WG3_CONFIG.terminationReflectionTiltMin,
            WG3_CONFIG.terminationReflectionTiltMax,
            0,
            0
        );
        this.addParameter(
            'bodyCouplingEfficiency',
            WG3_CONFIG.bodyCouplingEfficiencyDefault,
            WG3_CONFIG.bodyCouplingEfficiencyMin,
            WG3_CONFIG.bodyCouplingEfficiencyMax,
            0,
            0
        );
        this.addParameter(
            'pickupGain',
            WG3_CONFIG.pickupGainDefault,
            WG3_CONFIG.pickupGainMin,
            WG3_CONFIG.pickupGainMax,
            0,
            0
        );
        this.addParameter(
            'transmissionGain',
            WG3_CONFIG.transmissionGainDefault,
            WG3_CONFIG.transmissionGainMin,
            WG3_CONFIG.transmissionGainMax,
            0,
            0
        );
        this.addParameter(
            'bodyRadiationGain',
            WG3_CONFIG.bodyRadiationGainDefault,
            WG3_CONFIG.bodyRadiationGainMin,
            WG3_CONFIG.bodyRadiationGainMax,
            0,
            0
        );
        this.addStringParameter('bodyPreset', WG3_CONFIG.bodyPresetDefault, WG3_CONFIG.bodyPresetChoices);

        this.docstringPub = 'Pluck the string -- raise transmissionGain or bodyRadiationGain to hear the bridge\'s transmitted signal and its downstream body, or lower pickupGain to isolate them; switch bodyPreset to hear a different body.';
    }

    updateParameter(name) {
        const now = this.context.currentTime;
        switch (name) {
            case 'bridgeDecayVal':
            case 'reflectionTilt':
            case 'bodyCouplingEfficiency':
            case 'pickupGain':
            case 'transmissionGain':
            case 'bodyRadiationGain':
                if (this.workletNode) {
                    this.workletNode.parameters.get(name).setValueAtTime(this.getParameter(name).get(), now);
                }
                return;
            case 'bodyPreset':
                if (this.workletNode) {
                    this.workletNode.port.postMessage({ type: 'set-body-preset', bodyPreset: this.getParameter(name).get() });
                }
                return;
        }
        super.updateParameter(name);
    }

    startSound() {
        super.startSound();
        ['bridgeDecayVal', 'reflectionTilt', 'bodyCouplingEfficiency', 'pickupGain', 'transmissionGain', 'bodyRadiationGain', 'bodyPreset']
            .forEach((name) => this.updateParameter(name));
    }
}

export default WG3;
