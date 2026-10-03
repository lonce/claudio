// A thin preset/specialization of FilteredTermination -- the concrete
// bridge-boundary class WG3 instantiates and names. Ships with no
// different defaults from FilteredTermination itself for v1: there is no
// sourced "typical bridge" tilt/damping value to calibrate against yet
// (see FilteredTermination.js's own grounding note). Its purpose is
// purely to keep "BridgeTermination" as one specialization of the general
// filtered-termination role -- not the universal type -- per the project's
// multiport-compatibility documentation (soundlib/models/WG3/knowledge/
// components.yaml's future_generalization field), so a future
// bridge-specific default or behavior refinement has its own place to
// live without touching FilteredTermination's general mechanism.
//
// First subclass of a plain soundlib/utilities/ DSP component in this
// codebase -- every existing one (interpolators, RigidTermination, etc.)
// is a flat, non-inheriting class. Justified here the same way the
// preset-SoundModel pattern already is elsewhere in this codebase
// (DronePreset extends DroneModel, etc.): same mechanism, a named,
// possibly-diverging specialization.

import { FilteredTermination } from './FilteredTermination.js';

export class BridgeTermination extends FilteredTermination {}

export default BridgeTermination;
