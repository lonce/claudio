# Model Architecture Patterns

This is a catalog of the *architectural* patterns used across Claudio's
sound models — not a description of every model's sound design, and not a
substitute for reading the code. Its job is narrow: help you find the
closest existing model to use as a reference before writing something new,
and carry forward protocol details that aren't obvious from a cold read of
one file.

This catalog is itself a product of the broader intent recorded in
`docs/MODEL_DESIGN_CHARTER.md` — models and their per-model knowledge
records (`soundlib/models/*/knowledge/*.yaml`) are meant to function as
executable causal lessons, not just working code. Read that charter for
the vocabulary (causal layers, component roles, claim-evidence
distinctions) this catalog's entries are increasingly trying to use
consistently; it's the place to look for *why* a components.yaml/
causal-claims.yaml entry is shaped the way it is, and for open
representational questions not yet resolved here.

## How to use this doc

Before building a new sound model, find the archetype below closest to
what you're building, read its canonical file(s), and follow that file's
structure — this is what `CLAUDE.md`'s "Before modifying a sound model,
inspect `BaseSound.js` and at least one current working model" instruction
means in practice. If nothing here is close, say so and treat the new model
as a fresh archetype (see "Keeping this doc current" at the bottom).

## Model catalog

Every model currently exported from `soundlib/models/index.js` or
`soundlib/models/index_presets.js` (the two files that are the actual
public API), annotated with which archetype below it follows. This table
doesn't replace those files — it's an index into this doc, not into the
library.

| Model | Archetype | File |
|---|---|---|
| `DroneModel` | Oscillator-bank leaf | `soundlib/models/DroneModel.js` |
| `RissetBasic` | Oscillator-bank leaf | `soundlib/models/RissetBasic.js` |
| `Ping` | Oscillator-bank leaf | `soundlib/models/Ping.js` |
| `BellStrike` | Physically-informed modal synthesis | `soundlib/models/ChurchBells/BellStrike.js` |
| `RendezvousPingerII` | Meta-model composition | `soundlib/models/RendezvousPinger/RendezvousPingerII.js` |
| `RendezvousPingerIII` | Meta-model composition | `soundlib/models/RendezvousPinger/RendezvousPingerIII.js` |
| `RendezvousChimes` | Meta-model composition | `soundlib/models/RendezvousChimes.js` |
| `ChimeTube` | Meta-model composition (+ worklet event generator) | `soundlib/models/WindChimes/ChimeTube.js` |
| `WindChimes` | Meta-model composition (ensemble) | `soundlib/models/WindChimes/WindChimes.js` |
| `ClickerWorkletSoundModel` | Worklet audio source (simple) | `soundlib/models/ClickerWorkletSoundModel.js` |
| `ChuaOscillator` | Worklet audio source (numerical integration) | `soundlib/models/ChuaOscillator.js` |
| `Maraca` | Worklet audio source (stochastic/physically-informed, PhISEM) | `soundlib/models/Maraca.js` |
| `MaracaExtended` | Worklet audio source (stochastic/physically-informed, PhISEM) | `soundlib/models/MaracaExtended.js` |
| `Cabasa` | Worklet audio source (stochastic/physically-informed, PhISEM) | `soundlib/models/Cabasa.js` |
| `BambooChimes` | Worklet audio source (stochastic/physically-informed, PhISEM) | `soundlib/models/BambooChimes.js` |
| `ChimeVocoder` | Cross-synthesis / vocoder (hidden PhISEM engine + external-audio carrier filterbank) | `soundlib/models/ChimeVocoder.js` |
| `Wind` | Continuous noise-excited, simplex-modulated resonant filter | `soundlib/models/Wind.js` |
| `WG1` | Digital waveguide (delay-line propagation), Phase A | `soundlib/models/WG1.js` |
| `WG2` | Digital waveguide (delay-line propagation), Phase B (bidirectional two-rail) + Phase C (dispersion) | `soundlib/models/WG2.js` |
| `WG3` | Digital waveguide, Phase C (continued) -- filtered, transmitting bridge termination + one-way body coupling with 4 contrasting static-body presets (C.5.1/C.5.2); extends `WG2` directly | `soundlib/models/WG3.js` |
| `WorkerFM` | Worker-offloaded generation | `soundlib/models/WorkerFM.js` |
| `WaterFillRNN` | Worker-offloaded generation (ML/ONNX) | `soundlib/models/WaterFillRNN.js` |
| `WaveTrigger` | File/sample playback (plain) | `soundlib/models/WaveTrigger.js` |
| `AnotherGranny` | File/sample playback (granular) | `soundlib/models/AnotherGranny.js` |
| `FaustClarinet` | Faust/WASM-wrapped | `soundlib/models/FaustClarinet.js` |
| `HamburgerLadyChua13` | Preset-derived *(exception: standalone copy, not a subclass — see below)* | `soundlib/models/HamburgerLadyChua13.js` |
| `DronePreset` | Preset-derived | `soundlib/models/DronePreset.js` |
| `RissetPreset` | Preset-derived | `soundlib/models/RissetPreset.js` |
| `WaveTriggerPreset` | Preset-derived | `soundlib/models/WaveTriggerPreset.js` |
| `WorkletClickerPreset` | Preset-derived | `soundlib/models/WorkletClickerPreset.js` |
| `GrannyInteractive` | Preset-derived | `soundlib/models/GrannyInteractive.js` |
| `FaustClarinetPreset` | Preset-derived *(exception: async `initPromise` chaining — see below)* | `soundlib/models/FaustClarinetPreset.js` |
| `RendezvousPingerIIPreset` | Preset-derived | `soundlib/models/RendezvousPinger/RendezvousPingerIIPreset.js` |
| `ChimeStrikePreset` | Preset-derived | `soundlib/models/ChimeStrikePreset.js` |
| `WindChimesPreset` | Preset-derived *(exception: `setParameter()` forwarding needed — see below)* | `soundlib/models/WindChimes/WindChimesPreset.js` |
| `MaracaExtendedPreset` | Preset-derived | `soundlib/models/MaracaExtendedPreset.js` |

## Archetypes

### 1. Oscillator-bank leaf

The simplest shape: one or more `OscillatorNode`s straight into a shared
gain, no worklet, no children. Canonical: `DroneModel.js` (already
`CLAUDE.md`'s pick — start there for the base lifecycle). `RissetBasic.js`
and `Ping.js` are further examples of the same shape at slightly higher
voice counts.

### 2. Physically-informed modal synthesis

A bank of *damped* oscillators (a percussive/struck sound, not a sustained
tone) modeling a real physical object — a struck bar, tube, or bell.
Canonical: `soundlib/models/WindChimes/_ChimeStrike.js` (internal helper,
not itself exported — see `ChimeStrikePreset.js` for the public wrapper),
`soundlib/models/ChurchBells/BellStrike.js`.

Key protocol details:
- Partial ratios, amplitudes, and decay times are **fixed module
  constants**, not exposed `Parameter`s — they define the object's
  identity, not something a user tunes per-note.
- `play()` is **overridden to force-retrigger unconditionally**
  (`this.isPlaying = true; this.startSound();`), bypassing `BaseSound`'s
  default "no-op if already playing and not decaying" guard. A percussive
  strike must restart cleanly mid-ring without requiring `Stop` first;
  `startSound()` already disconnects the previous strike's nodes and
  `scheduleAttack()` already cancels any pending decay, so the override is
  safe on its own.
- **The outer gain envelope's `attackTime` should be near-instant** (e.g.
  `0.005`), not `BaseSound`'s generic 150ms default — the audible
  "attack" of a percussive/self-enveloping instrument already comes from
  its own synthesis (each partial's own attack here; a worklet's internal
  energy/collision/resonator response for archetype 5.1's PhISEM family),
  not from this outer node. Leaving the default in place layers a second,
  slower fade-in on top of it, and — worse — only on whichever `play()`
  path actually invokes `scheduleAttack()` (a fresh start, or a resume
  from decay), not on a `play()` that's a no-op because the model is
  already marked playing but has gone silent on its own; that
  inconsistency reads as "sometimes a soft attack, sometimes sharp," not
  as a single wrong constant. `decayTime` is unaffected — it only matters
  on an explicit `stop()`, not on a strike's own attack.
- Per-strike amplitude jitter uses a **triangular distribution**
  (`1 + ampVariation * (Math.random() + Math.random() - 1)`), not a
  uniform one (`2 * Math.random() - 1`) — a uniform draw makes every
  swing, including the extremes, equally likely, which reads as abrupt;
  averaging two draws clusters typical strikes near nominal and makes
  large swings rarer without changing the nominal range.
- **Doublet/beating** (`BellStrike.js`): a partial rendered as *two*
  detuned oscillators instead of one produces the slow warble real bells
  have from imperfect casting symmetry. The detuning pattern is drawn
  **once per instance, at construction** (`Math.random()`, no seed) — it
  represents a fixed physical property of that specific object, not
  something that should reroll every strike. A live parameter can scale
  how strongly that fixed pattern expresses (0 = no beating, 1 = full),
  but doesn't change the pattern itself. The oscillator *pair*'s relative
  **phase** should still be randomized per strike (a small random start-
  time offset on the second oscillator, within one period of the carrier)
  — otherwise the beat envelope begins at the same point in its cycle
  every time, which reads as the exact same temporal pattern on every
  strike even though the detuning itself is randomized.
- **Noise-transient synthesis** (`BellStrike.js`'s "clang"): a single
  broad `BiquadFilterNode` reads as a plain noise swell, not an attack
  transient. A small bank (4-6) of narrow, high-`Q` bandpass filters, all
  fed from one shared noise buffer, with independently-varying center
  frequency/`Q`/decay per filter, reads as a cluster of sharp resonances —
  much closer to a real percussive "clang." Normalize the combined peak by
  `1/sqrt(filterCount)` (summed roughly-independent sources add in power,
  not amplitude) so overall level doesn't scale with however many filters
  you use.

**Grounding a physically-informed model in real data**: when the target is
a real physical object (a specific instrument family, not an abstract
synthesis idea), research the real numbers before designing — dispatch a
research fork (WebSearch/WebFetch) rather than guessing from general
impressions, and require it to cite sources. In the resulting code,
explicitly distinguish **sourced fact** (e.g. `BellStrike.js`'s partial
ratios, cited to specific acoustics literature) from **informed
construction** (e.g. its amplitude/decay constants, built from qualitative
descriptions because no measured table existed) — say so directly in
comments rather than presenting a plausible-sounding number as measured
when it isn't.

**Parameter mapping classification (four categories, not just two)**:
`scratch/WaveguideResonator-v1-Specification-and-Reasoning-Model.md`
(section 7, the design document behind the `WG1`/digital-waveguide
archetype — see 5.3 below) proposes a more complete version of the
sourced-fact/informed-construction split above, worth using generally
going forward, not just for that one model:

- **physical**: derived from a physical quantity or equation (e.g.
  `BellStrike.js`'s partial ratios).
- **physically informed**: preserves the expected causal direction but is
  simplified (e.g. `BellStrike.js`'s amplitude/decay constants; `Wind`'s
  lowpass-position compensation, exact for the *known* fixed filter it
  corrects, not a measured physical property).
- **perceptual macro**: a convenient control over several lower-level
  parameters (e.g. most PhISEM `systemDecay`/`collisionDensity`-style
  controls).
- **synthetic extension**: intentionally exceeds the assumed physical
  object while remaining stable and causally intelligible (e.g. `Wind`'s
  `Q_COMPENSATION_EXPONENT`, an empirically-fit correction with no
  physical-object equivalent — deliberately chosen, not a stand-in for a
  physical measurement that wasn't done). State which category a mapping
  falls into directly in its comment; a model-building agent (human or
  otherwise) should be able to tell a deliberate synthetic choice from a
  measured physical property without reading the derivation.

### 3. Meta-model composition

A model that owns and triggers other `SoundModel` instances as children,
rather than creating raw `AudioNode`s itself. Canonical:
`soundlib/models/RendezvousPinger/RendezvousPingerII.js` (owns two
`_PhaseEventPinger.js` children) and `soundlib/models/WindChimes/WindChimes.js`
(owns N `ChimeTube.js` children, which in turn each own one `_ChimeStrike.js`).

Key protocol details:
- **`stopSound(onReleased)` collects all children, waits for every one to
  release, then finalizes.** Count the playing children, decrement in each
  child's own `stop(callback)` completion, and only zero the parent's own
  gain and call the parent's `onReleased` once the count reaches zero. This
  shape repeats at every nesting level (`WindChimes` waiting on `ChimeTube`s,
  `ChimeTube` waiting on its one `ChimeStrike`) — copy it exactly rather
  than inventing a variant.
- **`static WORKLET_PATH` can be borrowed from a child** so `AudioSystem`
  preloads the worklet before construction, even when the parent never
  touches an `AudioWorkletNode` directly (`RendezvousPingerII.WORKLET_PATH
  = PhaseEventPinger.WORKLET_PATH`). `AudioSystem.loadWorklet()` already
  dedupes by path, so this is free even when multiple levels declare the
  same path.
- **Stored-destination vs. live parameters.** A parameter a child only
  picks up at its *next* trigger (a pitch, a target frequency) is a stored
  destination — `updateParameter()` ignores it, no forwarding needed. A
  parameter that should take effect immediately (an overall
  strength/density control) is live — `updateParameter()` forwards it to
  every child right away. Decide per-parameter which one you mean; don't
  default to either.
- **Event vocabularies translate at each layer**, they don't thread
  through raw. `RendezvousPingerII`'s `'rendezvous'` event stages
  destinations then calls its children's own `'transition'` event, which
  itself becomes a `postMessage` to a worklet — three different vocabularies,
  each appropriate to its own layer.
- **Set both `this.gainNode` and `this.outputNode`** to the shared master
  gain, even though only `outputNode` is required by `AudioSystem`.
  `BaseSound.play()`'s resume-from-decay path
  (`this.scheduleAttack(this.gainNode, true)`) specifically reads
  `this.gainNode` — a model that only sets `outputNode` will throw if
  `play()` is ever called while `inDecaySegment` is true.
- **A doubled "stored destination" set isn't the only shape.**
  `RendezvousPingerII/III` bake in two named destinations per child
  (`natural_*` and `rendezvous_*`) because the model itself has to
  remember both. `RendezvousChimes.js` instead keeps one live destination
  per child (`freq_N`/`weight_N`/`phase_N`) and exposes two events that
  differ only in whether an endpoint phase is imposed — both just
  transition from wherever a child currently is to whatever its own
  parameters say right now. This works once there's an external way to
  save/recall a full destination configuration (the app's Snapshots
  feature); without one, the doubled shape is still the right call. Also
  note `RendezvousChimes.js` keeps its N children in an array rather than
  N named fields (`child1`, `child2`, ...) — reasonable once N gets much
  past 2.

### 4. AudioWorklet as a precise event/timing generator

A worklet that doesn't produce audible output itself — it advances some
state on the audio-render clock (a phasor, a noise process) and posts
discrete events to the main thread when something crosses a threshold.
Canonical: `soundlib/worklets/phaseEventProcessor.js` (drives
`soundlib/utilities/TransitionPhasor.js`),
`soundlib/worklets/noiseControlProcessor.js` (drives
`soundlib/utilities/SimplexNoise.js` -- see its own bullet below for a
second capability this one worklet has beyond the rest of this archetype),
and `soundlib/worklets/plusSimplexPhaseEventProcessor.js` (drives
`soundlib/utilities/PlusSimplexPhasor.js` -- a generalization of
`TransitionPhasor` that adds a simplex-driven timing-irregularity `weight`
parameter, on top of a corrected version of the branch-search below that
sorts candidates nearest-first and exits on the first feasible one, rather
than evaluating the full candidate window unconditionally).

Key protocol details:
- The worklet owns **timing precision**; the **main-thread model** owns
  **what an event means** — the processor should stay usable by a future
  model with entirely different trigger semantics (`noiseControlProcessor.js`
  has zero knowledge of chimes, tubes, or Claudio parameters at all).
- **`noiseControlProcessor.js` is not purely an event generator — it also
  writes a continuous k-rate signal to its own audio output every block**
  (`channel.fill(currentValue)`, one value computed once per block from
  `this.noiseTime += rate * blockDuration`), coexisting with its
  threshold-crossing `postMessage`s, not instead of them. This means a
  *second*, likely simpler way to use it for continuously modulating
  another model's parameter (e.g. a wind sound's gust strength) needs
  **zero code changes** to either this file or `SimplexNoise.js`:
  `.connect()` this worklet's `AudioWorkletNode` output directly into the
  target `AudioParam` (`noiseNode.connect(otherWorkletNode.parameters.get
  ('gustStrength'))`), exactly like connecting into any other `AudioParam`.
  Web Audio sums a connected modulator with whatever intrinsic value is
  set via `setValueAtTime()` and automatically clamps the result to that
  param's own declared `minValue`/`maxValue` — so a base level set through
  the normal `Parameter`/`setParameter()` path plus this noise connected on
  top gives "base level + fluctuating modulation" for free, sample-
  accurate, no extra latency, no message-port round-trip. The tradeoff:
  this bypasses the JS-side `Parameter` bookkeeping entirely, so the UI
  (if the target is ever independently exposed to it) won't reflect the
  actual instantaneous modulated value, only whatever base value was last
  set — a non-issue for a parent model modulating its own hidden,
  never-independently-exposed child (archetype 3's composition shape), but
  worth knowing before reaching for it on a directly user-facing parameter.
  Only if you specifically want the noise-driven value to flow through the
  visible `Parameter`/`setParameter()` path instead (so it's inspectable,
  clamped by the *Claudio* parameter's own range, recorded in snapshots,
  etc.) does something need to change: add a periodic (throttled — posting
  every block at audio rate would flood the port, per the guidance already
  below about never posting per-event messages at audio-block granularity)
  `port.postMessage({ value: currentValue })` and have the owning model's
  `onmessage` call `child.setParameter(name, value)`. Also note `enabled`
  defaults to `false` — a parent needs to `postMessage({type:'set-enabled',
  enabled:true})` in its own `startSound()` before anything (event or
  continuous signal) is produced, and `rate`/`amplitude`/`offset` are
  already exposed `AudioParam`s for shaping the noise's speed and range
  before it reaches whatever it's connected to.
- An `acceptingXEvents` flag on the model (not the worklet), set `true` in
  `startSound()` and `false` at the very start of `stopSound()`, rejects
  any notification still in flight after `stop()` — a worklet message can
  arrive after the model has already begun releasing.
- A worklet that produces no audible signal still needs a connected output
  to stay in the actively-rendered graph in some browsers — connect it
  through a zero-gain "keep-alive" `GainNode` rather than leaving it
  unconnected.
- A worklet processor can `import` a plain, framework-agnostic utility
  class from `soundlib/utilities/` exactly the way a model file would
  (`import { TransitionPhasor } from '../utilities/TransitionPhasor.js';`)
  — keep the actual math/algorithm in that plain class, separate from the
  `process()`-loop plumbing, so it stays testable and reusable outside the
  worklet context too.
- **A phase-targeted `PlusSimplexPhasor.beginTransition` can blow an audio
  callback's budget even with the nearest-first search working correctly.**
  The search itself typically only needs one candidate/one bisection (that
  part is cheap), but the bisection's own simulation resolution —
  `planningSteps`, default 1024 — is not: measured at ~7-10ms for a single
  phasor's `_prepareTransition`, called synchronously inside `process()`,
  against a ~2.67ms budget at 128 samples/48kHz. A model that fires this on
  several children in the same render quantum (`RendezvousChimes.js`,
  `RendezvousPingerIII.js`'s `'rendezvous'` event) will audibly glitch.
  Pass a much lower `planningSteps` (128 measured ~20x cheaper, no loss of
  landing accuracy — only the interior rate/weight glide's resolution gets
  coarser, immaterial over a multi-second transition) via
  `processorOptions` at construction. `beginNaturalTransition` (no target
  phase) skips this search path entirely and stays cheap regardless.

### 5. AudioWorklet as the audio source

The worklet itself generates the signal you hear, sample by sample —
simplest form is `ClickerWorkletSoundModel.js` (a click train, the
existing `CLAUDE.md` canonical pick for basic `WORKLET_PATH` usage); the
more demanding form is `ChuaOscillator.js`, which numerically integrates a
chaotic ODE system per sample. For the numerical-integration variant, see
`docs/WORKLETS_AND_PRESETS.md`'s "Numerical safety for iterative/chaotic
worklets" section — an uncaught exception or unchecked `NaN` in a
worklet's `process()` can permanently kill that node with no recovery
short of a page reload, so explicit `Number.isFinite()` checks and a
"fail toward silence" flag matter here in a way they don't for a stateless
worklet.

### 5.1. Stochastic/physically-informed audio source (PhISEM)

A variant of archetype 5 where the worklet's internal state isn't one
deterministic system (an oscillator, an ODE) but a stochastic process:
accumulated mechanical energy driving probabilistic micro-collisions,
excitations, and modal resonance. Canonical: `soundlib/models/Maraca.js` /
`soundlib/worklets/maracaProcessor.js`, following Perry Cook's PhISEM
approach (see `fromChat/energy/Claudio-PhISEM-Architecture-and-Maraca-
First-Pass.md` for the full architecture rationale this was built from).
Intended as the first of a family (cabasa/sekere as a close relative,
bamboo chimes as a structural-generalization test) -- read the source doc
before assuming these boundaries are final.

Key protocol details:
- **The DSP is decomposed into plain, framework-agnostic classes in
  `soundlib/utilities/`** (`SeededRandom`, `EnergyAccumulator`,
  `StochasticCollisionGenerator`, `NoiseBurstExciter`, `ResonatorBank`,
  `OutputConditioner`), imported and composed by one processor -- same
  "keep the math separate from the `process()`-loop plumbing" principle
  archetype 4 already established, extended here to *several* composed
  components in a single audio-source worklet rather than one. They live
  in `soundlib/utilities/` flat (not nested under `Maraca/`) because
  they're meant to be reused across the whole PhISEM family, not private
  to one model.
- **Model-specific tuning constants live in their own plain data file**
  (`soundlib/worklets/maracaConfig.js`), imported by both the processor
  and by Node-side tests -- not inlined in the processor, specifically so
  `node --test` can exercise the exact same constants the browser uses
  without needing an `AudioWorkletProcessor` stub.
- **Every time-based coefficient uses `exp(-1 / (seconds * sampleRate))`**,
  never an approximation tied to one assumed sample rate -- the exact
  per-sample coefficient for continuous exponential decay at any sample
  rate. Applied identically for energy decay, collision/noise-burst decay,
  and resonator-mode decay (via pole radius). Continuous drive is likewise
  divided by `sampleRate` so total energy added per second of held drive
  doesn't change with sample rate either.
- **Resonator frequencies are clamped well below Nyquist** (45% of
  `sampleRate`) before computing filter coefficients -- at or above
  Nyquist the mode folds back audibly and the coefficient math stops
  meaning what it assumes. `ResonatorBank` also finite-checks every
  computed sample and zeros that mode's state rather than letting a
  diverged coefficient set poison every future sample, the same
  fail-toward-silence principle `docs/WORKLETS_AND_PRESETS.md`'s
  numerical-safety section documents for `ChuaOscillator`.
- **A discrete public action (`strike()`) is deliberately coarse-grained.**
  The worklet reuses the established `pendingCommands` array + `port.
  onmessage` + drain-once-per-block pattern from
  `plusSimplexPhaseEventProcessor.js` (archetype 4) rather than inventing
  a new one -- an injected energy impulse then drives many independent,
  genuinely stochastic per-sample collision decisions over its decay
  tail, which is what actually produces a convincing decaying "cloud" of
  micro-collisions rather than one fixed-shape transient. Reusing the
  block-granularity command queue for this is deliberate: it keeps
  collision-level events entirely off the message port (`docs/
  WORKLETS_AND_PRESETS.md`'s guidance never to post per-event messages
  applies doubly here, since a maraca shake can be hundreds of collisions
  a second).
- **`{ type: 'reset' }` is applied every `startSound()`, not just at
  construction**, and is drained even while the worklet's `active` gate is
  0 -- otherwise a fast stop-then-replay resumes from whatever energy,
  resonator, and DC-blocker state a prior shake left behind, since the
  `active` gate stops *output*, not internal state. An
  `acceptingShakes`-style flag on the model (matching archetype 4's
  `acceptingXEvents` convention) guards `strike()` itself from firing after
  `stop()` has begun.
- **Decay constants must be derived from their cited coefficient, not
  transcribed from an architecture doc's placeholder.** The first-pass
  `collisionDecaySeconds`/`modeDecaySeconds` were copied verbatim from
  the architecture doc's own illustrative config (explicitly marked there
  as "not approved constants") and never actually computed from the
  STK coefficients the model cited as its basis -- the resulting
  resonator Q (~201) was ~36x higher than the STK-implied value (~5.6),
  producing an audibly metallic, bell-like ring instead of a damped gourd
  knock (diagnosed and corrected September 2026). A comment citing a
  source is a claim of provenance; if the number wasn't actually derived
  from that source, the comment is misleading. Use
  `soundlib/utilities/decayMath.js`'s `decaySecondsFromCoefficient(coefficient,
  referenceSampleRate)` (and its siblings -- `perSampleCoefficient`, `t60`,
  `bandwidthFromDecay`, `qFromDecay`, and their inverses) rather than
  reimplementing the conversion inline, and show the derivation next to
  the constant (source coefficient, its sample rate, resulting tau/T60 in
  a comment) so it's auditable -- see `maracaConfig.js` for the pattern.
  If a decay constant has no such derivation, treat it as an unverified
  placeholder regardless of what surrounding comments imply. This applies
  most cleanly to fixed config constants where a single-strike reference
  coefficient maps directly onto a single-strike component; a live,
  continuously-excited `Parameter` like `systemDecay` doesn't map 1:1
  onto a single-strike coefficient the same way -- compute the
  STK-implied value for comparison anyway, but treat the live default as
  a judgment call and say so in the comment (matching archetype 2's
  sourced-fact-vs-informed-construction distinction).
- **The near-instant `gain.attackTime` override (see archetype 2) applies
  here too, and matters even more.** A worklet-driven instrument's
  `play()` can take three different paths (fresh start, resume-from-decay,
  or a no-op while already marked playing but gone silent on its own),
  and only some of them invoke `scheduleAttack()` at all. With
  `BaseSound`'s generic 150ms default, the paths that do call it sound
  audibly softer than the one that doesn't — diagnosed on `Maraca.js` as
  "sometimes a soft attack, sometimes sharp" (not an obvious single wrong
  constant from reading the code). It only fully resolved once
  `attackTime` itself became too fast for the difference between paths to
  be audible — an earlier, narrower fix that instead tried to make
  `play()`'s resume-from-decay path behave identically to a fresh start
  had to be partly undone once this was found, since it no longer served
  a purpose and fought against the next bullet's intended behavior.
- **A discrete trigger that should read as a consistent, comparable hit
  needs `EnergyAccumulator.setEnergy()`, not `injectImpulse()`.**
  `injectImpulse()` is additive by design — a genuine accumulator, correct
  for a model where sustained/rapid triggering should audibly build up.
  `Maraca.js`'s `strike()` used it for its one-shot trigger too, which let
  a shake landing during a previous one's still-decaying tail sum with
  the residual and land at a noticeably louder peak than an isolated
  shake — not obviously wrong from reading the code, only audible by ear.
  Decide which behavior a new trigger actually wants before wiring it up:
  `setEnergy()` for "every trigger should feel the same regardless of
  recent history," `injectImpulse()` for "triggering faster/more should
  build."
- **Phase F confirmed: a close-relative instrument needs no new DSP, just
  retuned parameters.** `Cabasa.js` subclasses `MaracaExtended` and only
  overrides already-declared `Parameter` defaults/ranges -- no new
  worklet, no new config file, no changes to `maracaProcessor.js` or any
  of the six plain DSP classes. This was verified, not assumed: Perry
  Cook/STK's own `Shakers.cpp` implements Maraca and Cabasa as one shared
  algorithm, differing only in a per-instrument constant table (object
  count, resonance frequency/Q, per-event and system decay), which is
  exactly the parameter surface `Maraca`/`MaracaExtended` already expose
  as live `AudioParam`s. Not every STK constant transcribes validly,
  though -- our collision-probability law
  (`StochasticCollisionGenerator`) and output-gain normalization are not
  the same laws STK uses, so `Cabasa.js` explicitly distinguishes
  *sourced* constants (system decay, resonance frequency/bandwidth,
  collision decay -- same physical quantity, safe to transcribe) from
  *STK-value-reused-as-a-starting-point* (`numberOfObjects`' default) and
  *not sourced at all* (`collisionRateScale`, outer `gain` -- left
  unchanged, no STK equivalent under our differing laws). This doesn't
  extend to Phase G (bamboo chimes), which the architecture doc identifies
  as the harder *structural* test -- it will be the first model to
  actually configure more than one `ResonatorBank` mode (every PhISEM
  model so far, including Cabasa, only ever uses mode 0 of the bank's
  existing multi-mode capacity).
- **Phase G (`BambooChimes.js`) confirmed the structural generalization
  too, but it needed one small, generic DSP change, not just config.**
  Cook/STK's own `Shakers.h`/`.cpp` implements two different "bamboo"
  instruments with genuinely different `tick()` control flow: a plain
  type (3 fixed resonances, all excited by the *same* shared collision
  signal every hit -- architecturally identical to Maraca/Cabasa's single-
  shared-excitation family, just more modes) and a "Tuned"/angklung type
  (STK's own internal constants are literally named `ANGKLUNG_*`; 7
  resonances at real musical pitches, one randomly-chosen tube excited per
  collision while the other 6 keep ringing on their own persistent filter
  state). `BambooChimes.js` builds the second one, since that's the
  actual per-collision-resonator-selection case. This required adding
  `ResonatorBank.excite(index, amount)` + changing `tick(excitation)` to
  a no-argument `tick()` that consumes whatever's been accumulated per
  mode -- a real, generic capability the class didn't have (feed one
  mode's excitation independently of the others), not a bamboo-specific
  special case. `maracaProcessor.js`'s one call site was updated to the
  new two-step form (`excite(0, ...)` then `tick()`), numerically
  identical for its single-mode use -- proven, not just argued, by
  `maracaPipeline.test.js`'s existing bit-identical-seed-reproduction test
  still passing unchanged after the refactor. `BambooChimes` uses its own
  `bambooChimeProcessor.js` rather than sharing `maracaProcessor.js` --
  per-collision tube selection is a different composition/routing loop,
  not just different constants on the same loop, so sharing would have
  meant instrument-specific branching inside what's meant to stay a
  generic composition. Not to be confused with the pre-existing, wholly
  unrelated `WindChimes`/`ChimeTube` (archetype 3, meta-model composition
  of full child `SoundModel` instances) -- same category of instrument,
  completely different implementation technique.

### 5.2. Continuous noise-excited, simplex-modulated resonant filter

A sibling to 5.1, not a variant of it: broadband noise, fixed-lowpass-
filtered, excites a single `ResonatorBank` mode whose center frequency
*and* gain are both driven, every block, by ONE shared multi-octave
simplex trajectory (`SimplexNoise.noise1DMultiOctave` -- see archetype 4's
k-rate note; this is a from-scratch worklet composition, not a
`noiseControlProcessor.js` consumer). `Q` is set independently and stays
constant while the shared trajectory continues to drive both destinations.
Unlike 5.1, there is no discrete trigger/energy-accumulator concept --
this is a continuously-playing texture from the moment `play()` is called,
so the model extends plain `BaseSound` (not `BaseSoundWithEvents`) and
uses the default attack/decay lifecycle, matching archetype 1/
`DroneModel`, not `Maraca`'s. Canonical: `soundlib/models/Wind.js` /
`soundlib/models/Wind/windProcessor.js`, ported from a non-real-time
Python prototype (`scratch/DS_Wind_1.1/DSWind.py`) that recomputed its
resonator coefficients every sample and globally peak-normalized its
output after the fact -- neither ports directly to a continuous
real-time stream.

Key protocol details:

- **One shared trajectory driving two destinations reads as a coherent
  gust, not a filtered drone with an LFO bolted on.** `cf` moves in
  octaves around a `strength`-set center; gain moves linearly; both come
  from the *same* per-block simplex sample, not two independent generators
  -- this is what makes a pitch shift and a loudness swell arrive together
  as one perceptual event.
- **A fixed-gain continuous resonant model has no natural normalization
  point.** A percussive model (archetype 2) gets one for free from its own
  attack transient; the Python prototype had one from its offline global
  peak-normalize; a continuous real-time resonant filter has neither --
  expect to need an explicit, derived loudness-compensation term, and
  expect it to need MORE than one factor (see next two bullets).
- **Q-compensation must be derived empirically, not assumed from the
  textbook `RMS ~ sqrt(Q)` relationship.** That analytical guess
  (exponent 0.5) was measured to be wrong for this specific
  resonator/exciter combination -- rendering uncompensated across
  `howliness`'s full range and comparing RMS gave the actually-needed
  exponent (~0.154 here), a large enough gap from the analytical guess
  that skipping the empirical check would have shipped an audibly
  Q-dependent loudness swing.
- **A resonator's output level also depends on WHERE its center frequency
  sits relative to the noise source's own spectral shape** -- a mode deep
  in a fixed lowpass's passband extracts far more energy than one near/
  above its cutoff. Unlike Q-compensation, this does NOT need to be a
  measured/fitted constant: since the noise pre-filter is a fixed, known
  filter, its exact magnitude response at any frequency is analytically
  computable (a closed-form formula for a cascaded one-pole lowpass, in
  `windProcessor.js`'s `lowpassMagnitudeAt()`) and can be inverted
  directly as a second, independent compensation factor alongside
  Q-compensation. This is a real, substantial improvement over leaving it
  uncompensated (measured on Wind: a 327x worst-case/quietest-case RMS
  ratio across the full parameter grid dropped to ~52-57x once both
  compensations were applied) -- but even combined, the two don't fully
  flatten loudness across the grid; a complete fix would need a genuinely
  spectrum-aware adaptive normalizer, which is a different, larger
  undertaking than this archetype's "reasonable estimate" scope.
- **`outputGain` cannot be sized by "render N seconds and take the max
  peak."** A high-Q resonator driven by broadband noise behaves like a
  narrowband Gaussian process -- its RMS is a stable, well-behaved
  quantity, but its PEAK is a property of a stochastic process with no
  finite upper bound over unbounded listening time; peak measured this way
  keeps creeping up the longer the test render runs (confirmed empirically
  on Wind: peak grew from ~65 to ~90 over a 16-second render at otherwise-
  fixed settings, purely from observing more independent excursions of the
  same stationary process, not from any instability). Two consequences:
  first, size `outputGain` from worst-case RMS times a measured crest
  factor (peak/RMS was empirically ~4.3-4.5x here and stayed essentially
  constant across the whole parameter grid -- a genuinely useful, stable
  number once measured) with real margin, not from a short render's
  observed peak. Second, accept that `OutputConditioner`'s hard clamp will
  occasionally, rarely trigger during long continuous play at the loudest
  parameter corners -- that is what the clamp is for, not a bug to
  engineer away entirely.
- **A one-time-looking discrepancy in a gain-staging measurement is worth
  chasing down, not rationalizing away.** Mid-implementation here, an
  `outputGain=1` peak measurement came back at exactly `4.0` -- which
  looked like "coincidentally already fine," but was actually the
  `OutputConditioner`'s own hard clamp saturating the measurement itself,
  silently hiding a true unclamped magnitude that turned out to be ~480x
  larger. Re-measuring with a deliberately tiny `outputGain` (so the clamp
  can't engage) and dividing back out is the reliable way to recover a
  filter's true unclamped magnitude for gain-staging purposes.
- `CascadedLowpass` (a simple one-pole cascade, chosen over an exact
  Butterworth port as an informed approximation -- see archetype 2's
  sourced-vs-informed distinction) is kept local to `windProcessor.js`
  rather than extracted to `soundlib/utilities/`, per this codebase's
  "extract once a second real consumer exists" rule -- it, and its
  analytical `lowpassMagnitudeAt()` companion, are the concrete
  candidates to promote the moment a second atmospheric/textural model
  (rain, fire, ocean) needs its own noise pre-filter.

### 5.3. Digital waveguide (delay-line propagation)

A structurally different propagation primitive from every other resonant
archetype above -- 2, 5.1, and 5.2 all use `ResonatorBank`'s 2-pole IIR
topology (coefficients derived from frequency/decay, feedback via
`a1*y[n-1] + a2*y[n-2]`); this archetype instead represents propagation as
literal delay: a fractional-delay circular buffer with feedback, in the
Karplus-Strong tradition. Canonical: `soundlib/models/WG1.js` /
`soundlib/models/WG1/wg1Processor.js`, built from
`scratch/WaveguideResonator-v1-Specification-and-Reasoning-Model.md`
("WG1", Phase A only -- a single delay loop representing one full round
trip, not yet a true bidirectional two-rail waveguide with independently
addressable spatial positions; later phases add position-dependent
excitation/pickup, dispersion, bridge filtering, and polarization, none
of which exist yet).

Key protocol details:

- **The reusable components live in `soundlib/utilities/`
  (`FractionalDelayWaveguide`, `LoopLossFilter`, `RigidTermination`,
  `InitialConditionExciter`), not under `soundlib/models/WG1/`** -- a
  deliberate, up-front exception to this codebase's usual "extract once a
  second real consumer exists" rule (archetype 5.2's `CascadedLowpass`
  note, e.g.). The spec's own stated primary goal is components "whose
  internal parts can later be reused by a model-building agent" -- future
  bow-friction exciters, hammer/mallet contacts, and tube/bore models are
  named as intended reuses of these exact propagation/loss/termination
  pieces. Justified by that stated intent, not a speculative guess at
  future need.
- **The loss filter's coefficient is NOT `decayMath.js`'s
  `perSampleCoefficient()`, despite that looking like an obvious fit --
  found wrong empirically, not caught by inspection.** An initial version
  used it directly and measured a decay roughly `delaySamples` times too
  slow (confirmed by rendering and tracking RMS over time). The reason:
  in this topology, the loss filter is applied once per LOOP TRIP (every
  `delaySamples` samples, when a given packet of stored energy comes back
  around), not once per elapsed sample the way `perSampleCoefficient`
  assumes -- energy just sits untouched in the delay buffer between
  trips. The correct coefficient scales by the loop length itself:
  `exp(-delaySamples / (decaySeconds * sampleRate))`. General lesson worth
  carrying forward: a helper's docstring describing what it computes is
  not the same as confirming it's the right primitive for a *new*
  topology -- that needs a render-and-measure check, same discipline
  already established for Wind's/ChimeVocoder's gain staging, just
  applied here to a timing/decay relationship instead of a gain one.
- **Linear interpolation measurably shortens decay below the naive
  `decayTime`-derived prediction, and the effect is fully explained by the
  interpolator, not a separate bug** -- confirmed, not assumed: at a
  frequency whose `delaySamples` happens to be an exact integer (zero
  interpolation smoothing), measured T60 matched the analytical
  prediction exactly (ratio 1.000); at frequencies with `delaySamples`
  near the interpolator's worst-case 0.5 fractional part, measured T60
  was ~75% of the analytical prediction. This is the concrete, quantified
  version of the spec's own general warning (section 5.2) that linear
  interpolation "introduces frequency-dependent loss." A follow-up
  investigation (prompted by a rigorous critique demanding proper
  isolation rather than accepting a plausible-and-consistent finding as
  confirmed -- see below) found this same mechanism becomes far more
  severe at high fundamental frequencies specifically: with the explicit
  loss filter disabled (a near-lossless control, isolating the
  interpolator from `LoopLossFilter` entirely) and measuring INTERNAL
  stored energy (sum of squares across the delay buffer, not just the
  pickup output -- ruling out pickup-position phase-cancellation as a
  confound), linear interpolation held roughly steady at ~0.72-0.77 of
  nominal across the full 55-3000Hz supported range for `WG1`. The
  fundamental's OWN decay (measured with a band-specific single-bin DFT,
  not broadband RMS) stays close to nominal at moderate frequencies
  throughout -- it's specifically BROADBAND/high-frequency content that
  collapses, which a broadband T60 measurement alone would conflate with
  the fundamental's own (much smaller) shortfall. **Fractional-delay
  interpolation is now a swappable per-tap strategy, not baked into
  `FractionalDelayWaveguide` itself** -- `readAt(offset, interpolator)`/
  `read(interpolator)` delegate to any object implementing `.read()`/
  `.reset()` (`soundlib/utilities/{Linear,Allpass,Lagrange}Interpolator.js`
  + a shared `createInterpolator.js` factory), defaulting to
  `SHARED_LINEAR_INTERPOLATOR` when omitted -- fully backward compatible,
  confirmed by re-running the existing suite unchanged. A measured 3-way
  comparison (linear vs. a first-order allpass vs. a 3rd-order/4-point
  Lagrange, across energy preservation, fundamental T60, tuning error,
  upper-partial inharmonicity, WG1-vs-WG2 behavior, live pitch-transition
  stability, and CPU cost) found allpass1 fixes the energy problem but
  introduces its own serious regressions -- frequency-growing tuning error
  (-18.3% for WG2 at 3000Hz), measurable inharmonicity even at low
  harmonics, and a ~40x transient spike during a live frequency ramp,
  a real risk given `frequency` is continuously live-retunable in every
  model here. This is exactly the outcome the investigation's own
  directive warned to check for, not assume away: "Do not assume that
  [an allpass interpolator] is automatically superior merely because its
  magnitude response is unity." Lagrange3 fixes the energy problem nearly
  as completely (internal energy fully preserved at every tested
  frequency except a small residual at WG2's extreme top of range) while
  matching linear's own small, frequency-stable tuning error almost
  exactly -- no regression there -- and is now the default interpolator
  for both `WG1` and `WG2` (`createInterpolator.js`'s
  `DEFAULT_INTERPOLATION_MODE`). `interpolationMode` stays a
  construction-time/developer choice (passed via `processorOptions`,
  matching `seed`'s existing precedent), not a user-facing `Parameter`;
  `linear` remains selectable as a reference/regression mode and a
  potential deliberately-characterized lo-fi propagation behavior. Full
  measured comparison recorded in
  `soundlib/models/WG1/knowledge/causal-claims.yaml`'s
  `claim.lagrange3-interpolation-resolves-energy-loss-without-tuning-regression`.
- **Read/write split, not a single read-modify-write pointer** (the
  textbook single-pointer Karplus-Strong shape): writes always land at an
  integer write index; reads are linearly interpolated at a fractional
  offset behind it. This is what makes a continuously variable, non-
  integer delay length (needed for accurate tuning at arbitrary
  frequencies) unambiguous -- a single read-modify-write pointer has no
  clean answer for "where does a fractional write go."
- **The exciter fills the loop's initial state via the SAME `write()` the
  steady-state feedback loop uses** (`InitialConditionExciter.excite()`
  just calls `waveguide.write()` `delaySamples` times), rather than a
  separate buffer-indexing scheme -- one code path that knows how loop
  positions map to buffer indices, not two that could drift out of sync.
  This is a one-time state-fill at trigger time, a genuinely different
  operation from archetype 5.1's `NoiseBurstExciter` (an ongoing
  per-sample decaying process) despite the surface-level "noise-based
  exciter" similarity -- don't reach for `NoiseBurstExciter` here.
- **`RigidTermination`'s default reflection is nowhere near actually
  lossy (1.0, non-inverting)**, even though a physical string's ends are
  each near-total, sign-inverting reflectors -- because Phase A's single
  delay loop already represents a FULL round trip (nut -> bridge -> nut),
  and two sign-inverting reflections cancel over one full trip
  ((-1)*(-1) = +1). Loss lives entirely in `LoopLossFilter`, deliberately
  kept separate (per the spec's own section 5.3 warning against the
  classic original-Karplus-Strong pitfall of folding loss into a
  two-point averaging filter, which conflates damping with a slight,
  inseparable pitch shift) -- `RigidTermination` stays a distinct,
  swappable component so Phase C's `BridgeTermination` (frequency-
  dependent, with real state) can replace it without touching
  `LoopLossFilter` at all.
- **`frequency` retunes continuously/live by construction, with no extra
  code for it** -- read every block and fed straight into
  `waveguide.setDelaySamples()`, exactly like every other model's k-rate
  parameters. This satisfies the spec's "stable" retuning mode (section
  8.3) for free; there is no separate discrete "retrigger" mode
  implemented in Phase A.
- **Gain staging needed no compensation term at all, unlike Wind** --
  measured worst-case peak across the full frequency/energy/decayTime/
  excitationType grid was ~1.08 (`outputGain=1`, `OutputConditioner`'s
  clamp is 4.0), because a near-unity-gain lossy loop doesn't amplify a
  bounded excitation the way a high-Q resonator does. Confirms, rather
  than assumes, that not every worklet audio source needs Wind-style
  derived compensation -- measure before assuming a model needs it, in
  either direction.
- **First test case for this codebase's `ComponentType`/`CausalClaim`
  knowledge records** (`soundlib/models/WG1/knowledge/*.yaml`, following
  `scratch/WaveguideResonator-v1-Specification-and-Reasoning-Model.md`'s
  proposed schema) -- a structured, queryable form of exactly the kind of
  causal reasoning this doc already carries in prose (the bullets above
  are themselves causal claims). Kept model-local and pilot-scale
  deliberately: only the two entity types with clear immediate payoff
  (`ComponentType`, `CausalClaim`), each claim backed by an actual
  `wg1PipelineCore.js` measurement, not the full proposed 9-entity
  ontology built speculatively ahead of a second physically-grounded
  model that would actually benefit from it. See "Parameter mapping
  classification," below, for a related piece of that proposal adopted
  more generally.

#### Phase B (`WG2`): true bidirectional propagation, confirming the reuse bet

`WG2` (`soundlib/models/WG2.js` / `soundlib/models/WG2/wg2Processor.js`)
upgrades from `WG1`'s single lumped loop to a true bidirectional two-rail
waveguide (`soundlib/utilities/BidirectionalWaveguide.js`) -- separate
rightward/leftward-traveling delay lines, needed because excitation
position, pickup position, and pickup type have no physical meaning on a
single loop with no notion of "where along the string." A genuinely
different top-level model (its own worklet, its own `registerProcessor`
name), not a `WG1` subclass, even though most of the underlying components
are shared.

- **The reuse bet from Phase A paid off, concretely, not just in
  principle.** Phase B needed no new delay-line class -- only
  `FractionalDelayWaveguide` generalized with `readAt(offset)`/
  `writeAt(offset, value)` (arbitrary-offset tap/inject, not just its own
  fixed `delaySamples`), added in a way that left `read()`/`write()`
  completely unchanged (`WG1`'s existing test suite re-run afterward
  confirmed zero regression, not assumed). `RigidTermination` and
  `LoopLossFilter` needed zero code changes at all, just different
  constructor arguments (see below) -- both already generic enough.
  `InitialConditionExciter` gained a new method
  (`exciteAtPosition()`) alongside its existing `excite()`, which `WG1`
  still uses untouched.
- **A position `p` (0=nut, 1=bridge) maps directly onto each rail's own
  existing "how many samples ago" read semantics** -- the sample currently
  at position `p` on the rightward rail is exactly the one written
  `p*railLength` samples ago; on the leftward rail, `(1-p)*railLength`
  samples ago (it started at the bridge). No new lookup algorithm needed,
  just calling the same primitive with an explicit offset instead of the
  rail's own fixed length.
- **Displacement and particle velocity pickups need no separate DSP at
  all** -- they fall directly out of the sum/difference of the two rails'
  values at a position (`soundlib/utilities/PointPickup.js`), a standard
  digital-waveguide identity, not an approximation. `bridgeForce` is
  inherently bridge-specific (the raw, pre-reflection bridge-incoming
  sample) and does NOT depend on `pickupPosition` at all -- documented
  plainly in `PointPickup.js` rather than silently ignoring the parameter
  for that one pickup type.
- **`WG1`'s termination reflection value (`+1`) does NOT carry over --
  each individual boundary needs the physically correct value again.**
  `WG1`'s single lumped loop used `+1` (non-inverting) specifically
  because it represented *both* string ends' reflections combined over
  one full round trip ((-1)×(-1) = +1). With two rails and the boundary
  reflections now explicit and separate, each one is a proper rigid
  string end on its own -- sign-inverting, `reflectionCoefficient ≈ -1`,
  at both nut and bridge. Reusing a component correctly sometimes means
  reusing the class but NOT its previous configuration -- check what a
  constant actually represented in its old context before assuming it
  transfers.
- **Loss also needed no new component, just one application per boundary
  instead of one per full loop** -- `LoopLossFilter` was already
  parameterized generically by "how many samples this application
  represents" (`WG1`'s own fix, see above); calling it once at each
  boundary with `railLength` (not the full loop length) gives the exact
  same net per-full-loop decay `WG1` has, since the two half-trip
  applications multiply back to the full-trip coefficient -- same
  `decayTime` semantics, directly comparable between `WG1` and `WG2`.
- **The two-rail structure's decay shortfall relative to `WG1`, properly
  isolated: a small fundamental-decay effect plus a much larger, topology-
  dependent broadband/high-frequency effect at high pitches -- not one
  undifferentiated phenomenon.** The original finding (measured T60 at
  220Hz running ~67-78% of the analytical prediction, plausibly the same
  interpolation-smoothing mechanism doubled up) was recorded at
  `confidence: medium`, explicitly not `high`, pending isolation with an
  exact-integer-`railLength` control the way `WG1`'s own finding used --
  and a rigorous follow-up critique demanded exactly that: four matched
  tests (integer/fractional delay × single-loop/two-rail), internal
  stored energy alongside pickup output (to separate genuine propagation
  loss from pickup-position phase-cancellation artifacts), and per-
  frequency-band decay rather than one broadband T60 number. That
  isolation found: at MODERATE frequencies (up to ~440Hz), `WG2`'s own
  fundamental-band decay shortfall is close to `WG1`'s (0.975 vs. 0.96 at
  220Hz) -- the two-rail structure's own contribution is small. The
  dramatic divergence is concentrated at HIGH frequencies and is
  specifically a broadband/internal-energy effect: with explicit loss
  disabled, `WG2` tracked `WG1` closely below ~440Hz but collapsed to
  ~0.06/0.02 of nominal at 1760/3000Hz (vs. `WG1`'s steady ~0.72-0.77
  across the whole range) -- confirming the doubled-interpolation-
  crossing mechanism (each `WG2` round trip crosses the fractional-delay
  tap twice, once per rail, vs. `WG1`'s once), not a `WG2`-specific bug.
  Swapping in `lagrange3` (see the Phase A section above) resolves this
  for `WG2` too, nearly as completely as for `WG1`: internal energy fully
  preserved at every tested frequency except one honest residual at the
  extreme top of the range (3000Hz: internal-energy T60 ~1.4s rather than
  fully preserved -- a ~24x improvement over linear's ~0.058s there, but
  not a complete fix). This raised the original claim's confidence to
  `high` in `causal-claims.yaml`, precisely because the isolation was
  actually carried out rather than assumed -- see
  `soundlib/models/WG2/knowledge/causal-claims.yaml`'s
  `claim.lagrange3-resolves-wg2s-high-frequency-energy-collapse`.
- **The actual point of Phase B, verified quantitatively, not just "it
  sounds different":** exciting or observing at the string's exact
  midpoint suppresses every even harmonic by 20-330x relative to an
  off-center comparison, while odd harmonics are NOT systematically
  suppressed under the same comparison (ratios scattered around 1x, not a
  pattern) -- the classic, textbook plucked-string modal-null behavior,
  confirmed independently for both excitation position and pickup
  position (controlling for the other by holding it fixed), via a simple
  single-frequency-bin DFT magnitude measurement per harmonic
  (`soundlib/utilities/test/wg2Pipeline.test.js`) -- no full FFT needed for
  this kind of targeted check.
- **A second real model now exists to check the `ComponentType`/
  `CausalClaim` knowledge-record convention against** -- `WG2`'s own
  records (`soundlib/models/WG2/knowledge/*.yaml`) stayed pilot-scale too
  (same two entity types, every claim measured), and cross-reference
  `WG1`'s entries by name in prose (e.g. `RigidTermination`'s changed
  configuration, above) rather than through a formal `CompatibilityRule`
  record -- still not yet the moment to add that entity type; two models'
  worth of prose cross-references remains cheaper and clearer than
  formalizing a rule between them for its own sake.

#### Phase C (dispersion): `DispersionFilter` and `stiffness`

The first Phase C step -- a `stiffness` parameter and
`soundlib/utilities/DispersionFilter.js`, added directly onto the
existing `WG2` model (no new top-level model) since dispersion is an
additional filter stage inside the already-correct two-rail propagation
structure, not a change to that structure itself, unlike the `WG1`->`WG2`
jump. `stiffness` defaults to 0, which bypasses the filter entirely --
strict backward compatibility, confirmed by the full pre-existing test
suite passing unchanged.

- **Grounded in the real literature, not an invented mapping** -- the
  closed-form design of Rauhala & Valimaki, "Dispersion Modeling in
  Waveguide Piano Synthesis Using Tunable Allpass Filters" (DAFX-2006,
  pp. 71-76), as implemented in Faust's standard library
  (`misceffects.lib`'s `piano_dispersion_filter`, authored by Julius O.
  Smith III) -- verified against the real source directly (`curl`'d from
  GitHub, not transcribed from a secondary summary or search-result
  paraphrase, which on a first pass introduced a plausible-looking but
  unverifiable variable name). `M` identical first-order allpass sections
  (`(a1+z^-1)/(1+a1*z^-1)`, the SAME transfer-function family already
  implemented in `AllpassInterpolator.js`'s single section -- a different
  purpose here: that one minimizes its own phase error as a side effect
  to approximate a flat fractional delay, this one deliberately
  introduces phase error as the actual goal), coefficient `a1` derived
  from a target inharmonicity coefficient `B` (the textbook stiff-string
  relation `f_n = n*f0*sqrt(1+B*n^2)`) via an empirical fit.
- **The source design already separates dispersion phase from tuning
  compensation** -- confirming, not just satisfying, the spec's own
  requirement (section 5.4: "tuning compensation measured or
  approximated") to keep these "conceptually separate." The whole
  cascade's own group delay at the fundamental
  (`DispersionFilter.groupDelaySamplesAt(f0, sampleRate)`) is a pure
  function, entirely separate from `process()`'s own per-sample
  filtering -- `wg2Processor.js` subtracts it from the geometric rail
  length each block (`pitchLocked`, the only mode implemented so far). A
  future `lengthLocked` mode would simply stop using that value, touching
  neither `DispersionFilter` nor `process()` at all.
- **A real sign-convention bug, caught by measurement, not inspection.**
  The Faust reference's own exposed output is pre-negated
  (`-Df0*M`), tailored to its own pipeline's `+(totalDelay)` usage;
  `groupDelaySamplesAt()` deliberately returns the plain-positive
  convention instead, matching its own name and `wg2Processor.js`'s own
  subtraction. Which sign is actually correct in THIS implementation was
  confirmed empirically (fundamental stayed within ~0.08% of target
  across a full `stiffness` sweep, on the first implementation attempt)
  rather than assumed from matching the paper's own usage pattern by eye.
- **Applied once per round trip, at the bridge boundary only -- not split
  across both boundaries.** Every full nut->bridge->nut cycle crosses the
  bridge boundary exactly once, giving exactly one pass through the
  cascade per round trip, matching the source paper's own single-lumped-
  loop insertion point. This is deliberately NOT the same shape as
  `LoopLossFilter`'s per-boundary split (`railLength`, not the full loop
  length, applied at each boundary) -- that split works because a scalar
  gain multiplies exactly and losslessly across two half-trips; an
  allpass cascade's phase doesn't obviously split the same way, and
  splitting isn't needed to satisfy any requirement here, so the simpler,
  literature-matching single-insertion design was used instead of an
  unverified half-split.
- **`stiffness = 0` bypasses the filter entirely, not merely drives its
  coefficient toward zero** -- `process()` returns its input unchanged
  and `groupDelaySamplesAt()` returns exactly 0, confirmed by the new
  `stiffness=0` render being byte-identical to omitting `stiffness`
  altogether. This is what gives the directive's own required "cleanest
  possible reference behavior" at the zero point, and is also why this
  step needed no new top-level model -- the addition is a true no-op
  until actively used.
- **`decayTime`/`brightnessDecay` independence (spec's own acceptance
  framing) is narrowed to `decayTime` only for this step** --
  `brightnessDecay` (frequency-dependent LOSS, as distinct from this
  component's frequency-dependent PHASE) doesn't exist in this codebase
  yet; `LoopLossFilter` remains broadband-only. Not a silent drop -- an
  explicit scope note carried into both the plan and
  `wg2Pipeline.test.js`'s own test name.

#### Widening `stiffness`'s creative range: `{amount, knee, slope, polarity, pitchLock}`

The first step's maximum was "too subtle" -- `stiffness=1` gave only
~75-80 cents of stretch at partial 8. Rather than just raise `B_MAX`,
the internal target description was restructured into a struct with a
slot for every dimension the follow-up directive wanted kept
conceptually separate: `{ amount, knee, slope, polarity, pitchLock }`.
Only `amount` is actually live this step (driven by `stiffness`); the
rest stay fixed internal defaults, but are now REAL constructor
arguments to `DispersionFilter` (not hardcoded module constants) --
exposing `dispersionKnee` later is "construct with a different value,"
no filter rewrite. `amount` itself is expressed as **cents of stretch at
a reference partial (`knee`)**, not `B` directly -- a closed-form
inversion (`R=2^(amount/600)`, `B=(R-1)/(knee^slope-R)`) of the same
textbook relation the Rauhala-Valimaki fit targets.

- **The real ceiling was found by measurement, not by raising `B_MAX`
  and hoping.** Sweeping `B` directly (bypassing `stiffness`) across
  110-880Hz revealed that fundamental TUNING stays accurate (<1% error)
  up to `B~0.03-0.04` -- but the partial-4 STRETCH MEASUREMENT ITSELF
  goes non-monotonic around `B~0.009-0.0105` and clearly breaks (sign-
  flipped, implausible values) above `B~0.011-0.0115`, consistently
  across every tested frequency. Tuning accuracy is NOT the limiting
  factor here -- the Rauhala-Valimaki empirical fit simply stops reliably
  producing the intended curve once pushed far outside the real-piano-
  string `B` range it was calibrated against, independent of numerical
  stability. The new ceiling, `DISPERSION_AMOUNT_MAX_CENTS=100` at
  `knee=4` (inverts to `B~0.0082`), was chosen with real margin below
  this measured breakdown zone, not at or past it -- directly following
  the directive's own instruction to "report that boundary rather than
  forcing the coefficients further."
- **`knee=4`, not 8 (used for the first step's own headline numbers) --
  a measured choice, not arbitrary.** Partial 8 breaks down earlier than
  partial 4 under the same `B` (approximation error grows with
  `n^slope`), so anchoring the live `amount` at a lower, more robust
  partial leaves more usable headroom before the filter's own
  approximation limits are reached. `slope` (the `n^slope` exponent, the
  Rauhala-Valimaki fit's own calibration exponent) stays fixed at the
  literature value, 2 -- unlike `knee`, it is NOT yet safe to vary
  independently, since the empirical fit itself was derived assuming
  that specific exponent; exposing `dispersionSlope` later needs the fit
  re-validated first, not just a parameter wired up.
- **A genuine, pre-existing limitation surfaced by this widening's own
  research, not caused by it.** At `f0` near/below ~27.5Hz (A0, the
  fit's own calibrated floor), fundamental tuning degrades regardless of
  `B` -- confirmed this already happened at the FIRST step's much
  smaller `B_MAX=0.0015` too (an isolated check measured ~34% error at
  20Hz there). Never caught before because the original tuning-accuracy
  test only used 220Hz. Not fixed in this pass (a separate, nontrivial
  problem -- the fit's own calibrated domain, not the widening) -- now
  tested explicitly with an honest, loose bound rather than silently
  excluded from the sweep, and flagged to the user as a discovered issue.
- **A second real, reported side effect: absolute `decayTime` grows
  somewhat with `stiffness`.** Measured T60 at `decayTime=0.5` went from
  ~3.03s at `stiffness=0` to ~4.21s at `stiffness=1`, ~39% longer -- the
  near-unity-magnitude allpass cascade isn't perfectly magnitude-neutral
  in practice. What stays genuinely independent (and is what's actually
  asserted in `wg2Pipeline.test.js`) is the RATIO between two different
  `decayTime` settings, which held consistent (~3.86-3.98x for a
  nominal-4x change) across the whole `stiffness` range -- the absolute-
  value side effect is reported, not hidden, and not papered over by
  loosening that independence assertion.
- **Measured, not merely "sounds more extreme":** at 220Hz, partial 4
  (the new `knee`) increased monotonically across `stiffness`=[0, 0.25,
  0.5, 0.75, 1.0] from 880.00Hz to 950.58Hz (~136 cents at
  `stiffness`=1 -- a ~6x increase in cents over the first step's own
  knee=8 equivalent). Partial ordering (`p2<p4<p8`) stayed preserved
  across the whole range. Internal energy stayed preserved with explicit
  loss disabled at every tested (frequency, `stiffness`) combination.
  Output stayed finite and bounded even at the Nyquist-approaching
  combination of high `f0` + `stiffness=1` ("clean handling," per the
  directive, meaning finite/bounded -- not frequency-accurate, which
  isn't realistically achievable that close to Nyquist). CPU cost stayed
  ~1.08-1.09x bypassed at BOTH sample rates and at the new wider range --
  confirming cost depends on bypassed-vs-active only, not on `amount`'s
  magnitude. A live `stiffness` ramp re-verified at the new, much larger
  range showed no excess transient beyond the pluck's own natural onset.
- See `soundlib/models/WG2/knowledge/causal-claims.yaml` for the full
  measured validation (`claim.stiffness-increases-inharmonicity`,
  `claim.pitchlocked-compensation-keeps-fundamental-in-tune-across-
  stiffness`, `claim.dispersion-filter-approximation-limits`,
  `claim.dispersion-pre-existing-low-frequency-tuning-limitation`) and
  its explicit dispersion/dispersionAmount/dispersionKnee/dispersionSlope/
  filter-approximation-limits distinction, and
  `soundlib/models/WG2/knowledge/components.yaml` for the new
  `component.dispersion-filter` entry's full `internal_target_description`/
  affordances/limitations/future-affordances/grounding fields.

#### Exposing `dispersionPivot`/`dispersionSlope`: a naming question checked by measurement, not assumed

Before exposing the widening step's internal `knee`/`slope` as public
`Parameter`s, the user asked a semantic question worth recording as its
own worked example of this project's discipline: does `knee` actually
behave like a knee (an onset threshold, flat below/rising above), or is
it better described as a moving reference/pivot? This was checked
directly against the real filter's own measured output, not settled by
discussion of the math alone.

- **`knee` was renamed to `pivot` after direct measurement showed it has
  no onset behavior at all.** Rendering the achieved stretch curve at
  several reference-partial values (2, 4, 8, 12, fixed amount=60,
  slope=2, f0=220Hz) showed smooth, continuous growth from partial 1 at
  EVERY value tested -- at reference=4, partial 2 (immediately next to
  the fundamental) already shows real stretch (12.3 target/16.1 measured
  cents); at reference=12, even partial 2 shows a small but nonzero
  effect. There is no flat "below-knee" region at any tested value --
  moving this parameter rescales where the target `amount` lands on the
  SAME smooth power-law curve, it does not shift a boundary. **The
  response was the smaller, bounded one**: rename, don't build a separate
  true onset-threshold mechanism (which would need a fundamentally
  different, non-power-law curve shape -- a bigger, declined change) --
  matching the explicit instruction not to undertake "a large filter
  rewrite merely to satisfy terminology." A genuine onset-threshold knee
  remains a possible, separate future design.
- **Both `dispersionPivot` and `dispersionSlope` are now live,
  control-rate `Parameter`s** (ranges `[2,16]` default 4, `[0.5,4]`
  default 2 respectively) -- `stiffness` remains the PRIMARY control per
  explicit instruction. Confirmed by direct measurement (not assumed from
  the formula) that both are genuine, independent shape controls rather
  than three correlated ways of adjusting one overall inharmonicity knob
  -- e.g. at a fixed pivot/amount, the ratio of partial-16- to
  partial-4-stretch goes from ~4.4x at `slope=1` to ~25x at `slope=3`, a
  real reshaping, not a uniform rescale. One measured nuance worth
  knowing: because both parameters' entire effect runs through which `B`
  coefficient gets selected, two DIFFERENT `(pivot, slope)` pairs that
  happen to resolve to the same `B` produce IDENTICAL achieved curves --
  `pivot`/`slope` are two different ways of SELECTING a `B`, not two
  independently-expressive axes once a specific `B` is reached by either
  route.
- **The safety clamp (`B_SAFE_MAX=0.05`) is re-examined with a corrected,
  cents-accurate measurement, and kept transparent rather than silent.**
  An initial percent-based sweep used a fixed 4096-sample DFT window,
  which at low f0 (55-110Hz) captures too few cycles for reliable
  frequency resolution and gave misleading, noisy cents figures --
  caught by a B=0 sanity check (should read exactly 0 cents everywhere;
  didn't, with the old window) before trusting the corrected,
  frequency-adaptive method's own results. With that fix: tuning stays
  under ~1.1 cents from 55-880Hz through `B=0.05`, but reaches ~10.6
  cents at 1760Hz at that same `B` -- right at the stated 10-cent
  tolerance, reported honestly (a separate, looser test bound at that one
  frequency) rather than hidden by a uniform threshold. Framed, per
  explicit instruction, as "the current limit of reliable pitch
  compensation, not a stability or final expressive limit" -- large `B`
  stays finite/stable/correctly-ordered far beyond this clamp (tested to
  `B=0.2`). `getTargetDescription()` now reports `requestedAmount`,
  `unclampedB`, `clampedB`, `wasClamped`, and `maxRealizableAmount`
  (computed directly from the forward formula, not searched for) on every
  call -- clamping is never invisible, and a "dead zone" (pushing
  `stiffness` further produces no additional change once clamped) is
  directly detectable and was confirmed by a dedicated regression test,
  not just documented as a goal.
- **A second, distinct limitation, kept separate from the tuning
  clamp**: even well under `B_SAFE_MAX` (e.g. `B=0.0245`, from
  `pivot=2`/`amount=60`), stretch accuracy AT PARTIALS BEYOND THE PIVOT
  can already be unreliable (partial 4 measured -182 cents against a
  +265 target in one such case) -- the already-documented per-partial
  approximation limits from the amount-widening step, re-confirmed here
  as orthogonal to the tuning-focused `B_SAFE_MAX` clamp, not folded into
  it.
- **Live `pivot`/`slope` are smoothed; `stiffness` stays unsmoothed.** An
  abrupt (unsmoothed) `pivot`/`slope` jump was measured during design to
  produce a real, if modest, sample-level discontinuity (~2-2.5x the
  local baseline delta) -- not severe, but real and specifically called
  out by the design directive. A one-pole smoother (`DISPERSION_
  SMOOTHING_SECONDS`, ~30ms starting point) is applied to `pivot`/`slope`
  before use each block; `stiffness` itself needs none, matching its own
  already-validated finding from the amount-widening step. Re-verified
  safe even for a jump landing directly in the clamp boundary (the
  biggest single-block target change the exposed ranges allow).
- A recorded, NOT pursued, future task: **direct phase-based tuning
  compensation** -- a bounded numerical solve choosing the base delay so
  total round-trip phase (delay + interpolation + dispersion +
  termination) at the requested fundamental equals the required multiple
  of `2*pi`, as a possible way to extend the reliable `pitchLocked` range
  beyond the current empirical-formula-derived ceiling. Explicitly out of
  scope for this step.
- See `soundlib/models/WG2/knowledge/causal-claims.yaml`'s
  `claim.pivot-is-a-reference-point-not-an-onset-threshold`,
  `claim.slope-reshapes-not-just-rescales`,
  `claim.b-safe-max-characterized-in-cents`, and
  `claim.clamping-is-transparent-and-detects-dead-zones` for the full
  measured validation, and `components.yaml`'s `pivot_vs_knee` field for
  the naming decision's own write-up.

#### `WG3`: a filtered, transmitting bridge termination -- and the first "extend an existing top-level model" case

The remaining Phase C work (a general `Termination` family beyond
`RigidTermination`, a transmission port, and a way to actually listen to
it) landed as **`WG3`**, a new top-level model, rather than another
change folded into `WG2` -- the user asked for this explicitly ("lets
make a W3 to include the bridge and listen to it"), matching the same
judgment call `WG1`->`WG2` already established: a genuinely new,
listenable capability gets its own model, keeping the already-shipped
one at zero regression risk. Canonical files:
`soundlib/utilities/FilteredTermination.js`/`BridgeTermination.js`
(the new component), `soundlib/models/WG3.js`/`WG3/wg3Processor.js`/
`WG3/wg3Config.js`/`WG3/wg3PipelineCore.js` (the new model).

- **"No duplication between `WG2` and `WG3`" was a second, explicit
  instruction, and shaped the whole implementation.** Unlike `WG1`->`WG2`
  (a genuinely different propagation structure, where restating things
  made sense), `WG3` is additively "`WG2` plus a different bridge
  boundary" -- so every file reuses `WG2`'s own via three small,
  additive, backward-compatible extension points added to `WG2`'s own
  files, each verified zero-risk by re-running `WG2`'s own full test
  suite unchanged afterward:
  - `WG2.js` gained one new `static PROCESSOR_NAME = 'wg2Processor'`
    field, used in `createNodes()` via `this.constructor.PROCESSOR_NAME`
    instead of a hardcoded string -- lets `WG3` redirect which worklet it
    talks to by only declaring its own `static PROCESSOR_NAME`/
    `WORKLET_PATH`, with `createNodes()` itself fully inherited.
  - `wg2Processor.js`'s `WG2Processor` class is now `export`ed (was
    module-private), and its per-sample loop's one output-finalizing line
    was extracted into an overridable `_finalizeSample(observed)` method
    (default behavior identical to the inline code it replaced) plus a
    `_onReset()` hook called from the existing reset-command branch
    (a no-op by default). `wg3Processor.js`'s `WG3Processor extends
    WG2Processor`, overriding only `parameterDescriptors` (super + 4 new
    descriptors), the constructor (super, then swap
    `this.bridgeTermination` to a `BridgeTermination`), `process()`
    (write the 3 new termination fields + stash
    `transmissionGain`, then `super.process(...)`),
    `_finalizeSample()` (mix in the transmission-port monitor signal
    before `output.tick()`), and `_onReset()` (also reset the bridge
    termination's own internal filter state -- a fresh note should carry
    no stale lowpass state from a previous note's reflection, the same
    class of bug this project's pitch-glide regression already
    documents for `DispersionFilter.reset()`).
  - `wg2PipelineCore.js`'s `renderWg2Pluck` gained one new optional
    trailing `overrides` parameter (`{ bridgeTermination, onSample }`),
    omitted by every existing caller/test with zero behavior change.
    `wg3PipelineCore.js`'s `renderWg3Pluck` is then a thin wrapper --
    builds a `BridgeTermination`, sets its 3 fields from `settings`, and
    calls `renderWg2Pluck(..., { bridgeTermination, onSample: (observed,
    pipeline) => observed + transmissionGain * pipeline.waveguide.
    lastTransmittedSignal })` -- zero restated render-loop or DSP-
    construction code.
  - `wg3Config.js` is `{ ...WG2_CONFIG, <new termination constants> }` --
    every shared constant (frequency/decayTime/dispersion ranges, etc.)
    comes from the spread, never retyped. (This deliberately does NOT
    follow `wg1Config.js`/`wg2Config.js`'s own precedent of staying fully
    independent siblings -- that precedent fit two models with a
    genuinely different propagation structure; it doesn't fit two models
    where one is additively built on the other's own config.)
  - `WG3.js` itself `extends WG2` directly -- the first "extend an
    existing top-level model to add real new capability" case in this
    codebase (every other `extends` relationship among `SoundModel`s is
    archetype 9's preset pattern: override existing parameter VALUES
    only, never add new `addParameter()` calls). `WG3.js` adds only its
    4 new `addParameter()` calls, an `updateParameter()` override that
    handles only those 4 names and falls through to
    `super.updateParameter(name)` for everything else, and a
    `startSound()` override that calls `super.startSound()` (which
    already pushes `WG2`'s own 10 parameter names) then pushes its own 4.
    `play()`/`_submitPluck()`/`stopSound()`/`connect()`/`disconnect()`/
    `destroy()`/`createNodes()` are all inherited completely unchanged.
    ~90 lines total, not a ~170-line near-copy of `WG2.js`.
- **`BidirectionalWaveguide.tick()` needed no signature change at all**
  to support a termination that also transmits -- `FilteredTermination.
  reflect()` has the exact same `(incidentSample) -> reflectedSample`
  contract `RigidTermination.reflect()` already has; the new
  `this.lastTransmittedSignal = bridgeTermination.lastTransmitted ?? 0`
  line inside `tick()` mirrors the pre-existing `lastBridgeIncoming`
  pattern exactly, and the `?? 0` keeps `RigidTermination` instances
  (`WG1`/`WG2`, unchanged) working with zero risk.
- **A real design trap, found before it shipped, not after**: the
  amplitude-accounting split (`incident = reflected + transmitted +
  dissipated`) cannot be computed by naively subtracting a *signed*
  reflected wave from the incident sample -- at a fully-reflecting
  boundary (`reflection=1`), a real string end's own sign-inverting
  reflection would make `incident - reflectedWave = 2*incident`, not
  `0`. Fixed by doing all the magnitude/energy bookkeeping in an
  un-inverted reference frame (`baseReflected`), applying the fixed
  `BRIDGE_POLARITY = -1` sign only to what actually re-enters the
  waveguide, as a final, separate step. The resulting identity
  (`incidentSample === BRIDGE_POLARITY*reflectedWave + transmittedSignal
  + dissipated`) holds to floating-point epsilon (measured max error
  1.11e-16 across a 36-combination parameter grid), not merely
  approximately -- see `claim.amplitude-accounting-identity-holds-
  exactly`.
- **Passive by construction, confirmed by measurement, not just
  derivation.** `reflectionTilt` blends the flat reflection toward a
  one-pole lowpass (`reflectionTilt>=0`) or its exact complementary
  highpass (`reflectionTilt<0`, computed for free from the same filter
  state: `hp[n] = x[n] - lp[n]`) -- a convex combination of two
  responses each individually magnitude <= 1, so the blended result's
  magnitude stays <= `reflection` <= 1 at every frequency by the
  triangle inequality. A swept-sinusoid steady-state measurement across
  a 90-combination reflection x tilt x frequency grid found the worst
  observed ratio was exactly 1.0 (at `reflection=1, reflectionTilt=0`,
  where the bound is tight by construction) -- confirming, not just
  trusting, the derivation.
- **`reflectionTilt` genuinely reshapes the reflection spectrum, not
  just rescales it** -- measured at `reflection=0.9`: flat
  (`tilt=0`) gives 0.9000 at both 100Hz and 8000Hz (no shaping, as
  expected); darkening (`tilt=1`) gives 0.8980 at 100Hz vs. 0.1880 at
  8000Hz (high frequencies reflect ~4.8x less); brightening (`tilt=-1`)
  gives 0.0542 at 100Hz vs. 0.8665 at 8000Hz (low frequencies reflect
  ~16x less) -- a real, measured, directional reshaping in both
  directions.
- **`WG3` at its four new parameters' defaults
  (`reflection=1, reflectionTilt=0, terminationDamping=0,
  transmissionGain=0`) renders sample-identical to the
  equivalent `WG2` settings** -- measured directly (max diff exactly 0)
  across 4 representative settings combinations (different excitation/
  pickup types, with and without dispersion active), the strongest
  possible proof the new composition regresses nothing already validated
  for `WG2`'s own shared machinery. Exploring the bridge is fully
  opt-in. **(Later changed, post-C.5.2 -- see that section's own
  addendum below: `reflection`/`bodyRadiationGain`/
  `excitationType` no longer default to this WG2-equivalent no-op
  point; the equivalence itself still holds exactly at explicit
  settings, it's just no longer where WG3 starts out.)**
- **The reuse demonstration the directive asked for** (`Exciter ->
  DispersiveWaveguide -> FilteredTermination -> second resonator`) is
  test-level only, per the directive's own "need not become a polished
  SoundModel" allowance -- `soundlib/utilities/test/
  FilteredTermination.test.js` drives `waveguide.lastTransmittedSignal`
  into an independent `ResonatorBank` via `excite()`+`tick()` each
  sample, with zero changes needed to `ResonatorBank` itself. Measured:
  downstream RMS = 1.4285 at `terminationDamping=0.3` (energy actually
  transmitted) vs. exactly 0 at `terminationDamping=1.0` (nothing
  transmitted, by the amplitude identity above) -- proving the interface
  works end-to-end without building a second audible child model into
  `WG3`.
- **`transmissionGain`'s safe maximum (2) was measured, not
  guessed** -- a worst-case peak/RMS sweep across frequency x reflection
  x reflectionTilt x terminationDamping at `transmissionGain`'s
  max stayed well under `OutputConditioner`'s hard clamp (4.0), with the
  same permanent low-resolution safety-grid-search pattern `WG2`'s own
  dispersion work established (now extended to cross the 4 new
  termination parameters with frequency/stiffness extremes) finding
  nothing to flag.
- **Multiport-compatibility, documented but explicitly not built.**
  `component.filtered-termination` (the id
  `scratch/WaveguideResonator-v1-Specification-and-Reasoning-Model.md`'s
  own worked examples anticipate) is recorded as a `port_model:
  single-port` specialization of a future, NOT YET IMPLEMENTED
  `MultiportScatteringJunction` (multiple strings sharing one bridge,
  sympathetic excitation, a conceptual `b(omega) = S(omega) * a(omega)`
  scattering relationship) -- no scattering matrix, no unused arrays, no
  generalized graph infrastructure exist in this codebase yet.
  `BridgeTermination` itself is documented as ONE specialization of this
  component, not the universal type -- a future `ResonantTermination`
  (mass/compliance/multiple bridge resonances) would be a sibling, not a
  replacement. See `soundlib/models/WG3/knowledge/components.yaml`'s
  `future_generalization`/`current_limitations` fields.
- See `soundlib/models/WG3/knowledge/causal-claims.yaml` for the full
  measured validation behind every claim above, and
  `soundlib/models/WG2/knowledge/components.yaml`'s
  `component.bidirectional-waveguide` entry for the small, additive
  `lastTransmittedSignal` output it now documents (with its own stale
  "`BridgeTermination` unbuilt" limitation corrected and cross-
  referenced here).

#### Phase C.5.1: `BodyModeBank` -- a one-way downstream body, and a real gain-staging trap

The transmission port's *interface* was already proven (the reuse demo
above), but had no real listenable consumer -- exploring
`terminationDamping`/`transmissionGain` in the app was nearly
inaudible except in a narrow regime, and read as "the same string's own
signal, differently mixed," not a new voice. `BodyModeBank`
(`soundlib/utilities/BodyModeBank.js`) adds a small, fixed, one-way body
downstream of `transmittedSignal`, wired directly into `WG3` (extending
it in place, the same precedent as adding dispersion directly onto `WG2`
-- a downstream, additive, opt-in stage on an already-exposed port, not a
new propagation structure).

- **Reuses `ResonatorBank` entirely unchanged** -- `BodyModeBank` is a
  thin wrapper for the one new pattern a physical body needs: every mode
  driven by the SAME shared excitation each sample (a body resonates to
  whatever arrives at one coupling point), distinct from `ResonatorBank`'s
  own more general per-mode-targeted `excite()` that Maraca/BambooChimes
  use for per-collision mode SELECTION -- not applicable here.
- **A real, two-layer gain-staging trap, found by measurement, not
  avoided by inspection.** "Low-Q" modes were first built by picking
  short-*looking* `decaySeconds` (0.08-0.15s) directly -- wrong, because
  Q = pi\*f0\*decaySeconds, so at these frequencies that was actually
  Q~87-178 (sharp, ringing, the OPPOSITE of low-Q). Corrected to a
  genuinely low Q=4 via `decayMath.js`'s `decaySecondsFromQ(f0Hz, q)` --
  but even then, a CONTINUOUSLY-driven near-unity-pole discrete resonator
  (not an impulse response -- `transmittedSignal` is an ongoing, sustained
  signal for as long as the string rings) has an enormous steady-state
  gain at its own resonant frequency: measured 468-6829x (gain=1,
  uncompensated) depending on frequency, and this is **not sample-rate
  invariant** even at identical Q/frequency (confirmed ~15.5% different
  between 44100Hz and 48000Hz) -- so it can't be precomputed once into
  static config. A new closed-form helper,
  `decayMath.js`'s `discreteResonatorGainAtCenter(f0Hz, decaySeconds,
  sampleRate)` (a pure formula, not a runtime simulation -- cheap enough
  to call at construction time), lets `BodyModeBank`'s own constructor
  compute the correct per-mode compensation at the ACTUAL runtime sample
  rate. This is the same class of discovery Wind's own Q-compensation
  work already documents ("RMS ~ sqrt(Q) is an analytical guess, not a
  substitute for measuring") -- confirmed here all over again on a
  structurally different component, for a DIFFERENT reason (sample-rate
  dependence, not just magnitude).
- **Config vs. mechanism stays cleanly split, per the directive's own
  instruction.** `soundlib/models/WG3/bodyConfig.js` holds only physical/
  perceptual intent -- frequency, Q-derived `decaySeconds`, and a
  `relativeGain` balance BETWEEN modes (1.0/0.8/0.65/0.5, tapering at
  higher modes) -- never the actual compensated gain `ResonatorBank.
  setMode()` receives. `BodyModeBank.js` (the mechanism) is solely
  responsible for turning that stable, physical intent into a correct,
  sample-rate-aware filter coefficient.
- **Frequencies are deliberately non-harmonic relative to WG3's own
  220Hz default fundamental** (185/340/505/710Hz) so the body reads as a
  distinct object rather than reinforcing the string's own harmonic
  series -- confirmed, not just intended: pickup and body-radiation
  outputs measured substantially uncorrelated (correlation -0.148 at a
  representative setting), and the body's own RMS contribution (0.0296)
  was actually LOUDER than the plain pickup signal (0.0054) at a strongly
  opened bridge -- a real, audible, independent voice, not a subtle EQ
  tweak.
- **Strictly one-way, confirmed by construction and by test, not just by
  convention.** The body is excited and mixed entirely inside
  `wg3Processor.js`'s `_finalizeSample()`, strictly AFTER `waveguide.
  tick()` has already finished advancing propagation state for that
  sample -- no code path exists from `BodyModeBank` back into
  `BidirectionalWaveguide`/`FilteredTermination`/`DispersionFilter`.
  Verified by isolating the body's own additive output contribution and
  confirming it can be subtracted back out to exactly reconstruct the
  body-disabled render (max error below floating-point epsilon).
- **`bodyRadiationGain` never gates physical coupling, only
  whether you hear it** -- the body is excited by `transmittedSignal`
  UNCONDITIONALLY every sample, regardless of this gain's value (default
  0, purely a listening control), per the directive's explicit "do not
  reinterpret output gain as physical coupling."
- **No new top-level model, no duplication** -- `wg3Processor.js`'s
  already-existing `_finalizeSample()`/`_onReset()` hooks (added for
  `transmissionGain`) needed zero further changes to absorb the
  body; `wg3PipelineCore.js`'s `renderWg3Pluck` reuses the same
  `bridgeTermination`/`onSample` extension points on `wg2PipelineCore.js`'s
  `renderWg2Pluck` already established for the termination work, now also
  carrying the body's own excite/tick/mix logic in that same closure. The
  existing WG3-at-neutral-defaults-equals-WG2 regression test passes
  unchanged with the body's own default (`bodyRadiationGain=0`)
  added on top.
- **First `model_graph.*` record in this codebase's knowledge system**
  (`soundlib/models/WG3/knowledge/components.yaml`), the literal
  `InitialConditionExciter -> DispersiveWaveguide -> FilteredTermination
  (as BridgeTermination) -> BodyModeBank -> BodyRadiationObservation`
  structure the directive asked for, with its required limitation stated
  plainly: body is downstream-only, body state does not yet modify bridge
  impedance or string behavior. C.5.2-C.5.5 (contrasting body types,
  irregular bodies, dynamic/morphing bodies, two-way loading) remain
  explicitly unimplemented roadmap context, not started.
- See `soundlib/models/WG3/knowledge/causal-claims.yaml` for the full
  measured validation (`claim.continuous-drive-steady-state-gain-is-
  enormous-even-at-low-q`, `claim.body-mode-bank-is-silent-without-
  excitation`, `claim.body-modes-respond-near-their-configured-frequency-
  and-decay`, `claim.body-radiation-is-measurably-distinct-from-string-
  pickup`, `claim.body-radiation-monitor-gain-never-feeds-back-into-
  waveguide-state`) and `components.yaml`'s `component.body-mode-bank`
  entry for the full affordances/limitations/grounding writeup.

#### Phase C.5.2: contrasting static bodies -- same graph, different identity

C.5.1 shipped exactly one fixed body. C.5.2 generalizes `bodyConfig.js`
into a registry of 4 NAMED presets (`sparseLowQ`, `sparseHighQ`,
`sparseLowQLarge`, `sparseLowQSmall`), live-switchable via a new
`bodyPreset` string `Parameter` on `WG3` -- proving the
`InitialConditionExciter -> DispersiveWaveguide -> FilteredTermination ->
BodyModeBank -> BodyRadiationObservation` graph can acquire a distinctly
different identity when only the `BodyModeBank` node's own configuration
changes, directly comparable by ear in the app, not just in offline tests.

- **Live preset switching reuses the `excitationType`/`pickupType`
  pattern exactly** (`addStringParameter` -> `postMessage` ->
  `pendingCommands` drain) -- needed two small, additive touches to
  `wg2Processor.js` itself: a `static ACCEPTED_MESSAGE_TYPES` field (the
  `port.onmessage` filter now reads `this.constructor.
  ACCEPTED_MESSAGE_TYPES`, the same polymorphic-static pattern already
  used for `PROCESSOR_NAME`, so `WG3Processor` can extend the accepted
  set with `'set-body-preset'` without restating the filter), and a
  `_handleUnknownCommand(command)` hook (no-op by default) at the end of
  the command-dispatch chain, mirroring `_finalizeSample`/`_onReset`'s
  existing shape. Zero behavior change for `WG2` itself -- its own test
  suite re-run unchanged confirms it.
- **`BodyModeBank.js` stays completely generic -- no "wood"/"metal"
  anywhere in the DSP mechanism.** Character labels (`'thud-like, fast-
  damped'`, `'ringing'`, the untested size hypotheses) live only in
  `bodyConfig.js`'s preset `metadata`, matching the directive's explicit
  instruction. `sparseHighQ` is IDENTICAL to `sparseLowQ` in every
  respect except Q (185/340/505/710Hz, same `relativeGain` taper, same 4
  modes) -- isolating modal persistence from modal distribution, per the
  directive's own Comparison A.
- **A real design trap, caught before it shipped: "Q" and "decaySeconds"
  are not freely interchangeable when scaling frequency.** `scalePreset()`
  stores each mode's `q` explicitly and re-derives `decaySeconds` fresh
  at the new, scaled frequency (`decaySecondsFromQ(scaledFreq, q)`) --
  simply copying the base preset's own `decaySeconds` while changing
  frequency would silently change Q (`Q = pi*f0*decaySeconds`), breaking
  the stated "preserve... Q convention" requirement. Verified directly
  (not just argued): `sparseLowQLarge`/`sparseLowQSmall`'s modal-
  frequency ratios match `sparseLowQ`'s exactly, and their recomputed
  `decaySeconds` matches `decaySecondsFromQ` at the new frequency, not a
  copied value.
- **The gain-compensation formula (`decayMath.js`'s
  `discreteResonatorGainAtCenter`, introduced in C.5.1) is confirmed
  exact, not empirical, by direct re-validation across the full C.5.2
  range** -- every modal frequency used by every preset, both supported
  sample rates (44100/48000): worst relative error against direct
  time-domain simulation was 1.6e-5 (0.0016%), consistent with simulation
  measurement noise rather than formula error. This matters because the
  directive specifically asked whether the helper generalizes beyond the
  narrower range C.5.1 happened to check, or was just coincidentally
  close there -- it's a closed-form algebraic evaluation of
  `ResonatorBank`'s own literal transfer function, so it generalizes by
  construction, now independently confirmed rather than assumed.
- **Matched-system vs. loudness-matched comparisons, kept strictly
  measurement-side.** `renderMatched()`/`loudnessMatch()` (test-file-only
  helpers, never touching `WG3_CONFIG`/`bodyConfig.js`/any DSP class) let
  a comparison either show the real, unhidden loudness consequence of
  swapping Q (matched-system: `sparseLowQ`'s body contribution RMS
  0.0061, `sparseHighQ`'s 0.0016 at identical settings -- `sparseHighQ`
  is genuinely QUIETER overall under this broadband/continuous drive,
  not automatically equalized by the per-mode-at-resonance gain
  compensation once summed across a real excitation signal) or factor
  loudness out entirely (loudness-matched: `sparseHighQ`'s contribution
  rescaled, measurement-only, to `sparseLowQ`'s own RMS) so persistence
  can be compared on its own terms.
- **Low-Q vs. high-Q produces a measurable, loudness-independent
  persistence difference**, the directive's own headline comparison:
  `sparseLowQ`'s isolated body contribution drops below 10% of its own
  peak within the first 50ms block; `sparseHighQ`'s persists through the
  third 50ms block (~150ms) -- 3x longer -- and this gap survives
  loudness-matching unchanged, confirming it's a genuine character
  difference (Q), not an artifact of one preset simply being louder.
- **Causal-claims records now distinguish three kinds of claim
  explicitly** (`status:` field, first use in this codebase, alongside
  the existing `confidence:` field): `confirmed-dsp-property` (general
  mechanism facts, e.g. Q lengthening decay), `measured-in-this-model`
  (specific to this exact config, e.g. the persistence numbers above),
  and `perceptual-hypothesis` (explicitly untested by any DSP
  measurement -- "sounds more metallic," "lower scale suggests a larger
  body" -- recorded as hypotheses for a human listener to judge, per the
  directive's own example format, not claims this project's test suite
  can or does confirm).
- **`BODY_RADIATION_GAIN_MAX` (100, set in C.5.1) re-validated,
  not just re-used, across all 4 presets** -- worst-case measured peak
  across the full frequency/reflection/terminationDamping grid stayed
  under 1.35 for every preset (the hard clamp is 4.0), confirming the
  existing limit remains safe even for `sparseHighQ`'s much higher Q.
- **`1/sqrt(activeModes)` documented explicitly as a headroom heuristic,
  not a physical energy-conservation guarantee** (per the directive's own
  instruction) -- correlation between modes driven by the same shared
  signal genuinely varies with their frequencies/Q/the drive's own
  spectrum; mode count stays fixed at 4 across every C.5.2 preset, so
  this wasn't re-derived, only its documented status was corrected.
- C.5.3 (irregular modal spacing/mixed Q within one preset), C.5.4
  (live-tunable per-mode parameters, morphing between presets), and
  C.5.5 (two-way body/string loading) remain explicitly unimplemented
  roadmap context.
- See `soundlib/models/WG3/knowledge/causal-claims.yaml` for the full
  measured validation and the `status:`-tagged claims above, and
  `components.yaml`'s updated `component.body-mode-bank` entry (now
  documenting the live preset-switch mechanism) and its
  `model_graph.wg3-with-body-c5-1` entry's C.5.2 update note.

#### Post-C.5.2: defaults changed so the body is audible out of the box

Directly after C.5.2, user listening sessions found the "new feature is
a no-op at default" philosophy (applied consistently everywhere else in
this codebase) had an unwanted side effect here specifically:
`reflection=1` (the old default) makes `bodyPreset`/
`bodyRadiationGain` a *guaranteed* no-op regardless of their own
values, since nothing is ever transmitted at `reflection=1` -- so the
entire body-coupling feature was silent out of the box unless a user
already knew to move `reflection` away from 1 *and*
`bodyRadiationGain` away from 0 together, which isn't discoverable
from the UI alone.

- `TERMINATION_REFLECTION_DEFAULT`: 1 -> **0.6** (still selectable up to
  1, which still reproduces `RigidTermination(-1)` exactly).
- `BODY_RADIATION_GAIN_DEFAULT`: 0 -> **75** (within the
  already-measured-safe range -- worst-case peak ~0.71-1.35 at the max of
  100 across every preset, re-validated in C.5.2).
- `excitationType`'s default (WG3-only -- `WG2`'s own default stays
  `'noise'`, untouched): `'noise'` -> **`'impulse'`**, so a clear pitch is
  audible before reflection loss dominates. Since `excitationType` is a
  parameter WG3 *inherits* from `WG2`'s own constructor (which reads
  `WG2_CONFIG.excitationTypeDefault` directly, not `WG3_CONFIG`), WG3's
  constructor re-applies the override directly on the already-existing
  `Parameter` object after `super()` returns -- the same pattern
  preset-derived models use (`DronePreset.js` etc.: set
  `defaultValue`/`value` directly, no new `addParameter()` call) -- rather
  than touching `WG2_CONFIG`/`WG2.js` at all.
- The underlying WG2-equivalence identity itself is unchanged and still
  tested exactly (`reflection=1, bodyRadiationGain=0,
  excitationType='noise'` still renders byte-identical to `WG2`) -- only
  WG3's own *default* starting point moved away from that neutral point,
  the identity itself still holds whenever explicitly configured to it.

#### Pre-C.5.3: `reflection`/`terminationDamping` replaced by physically
intelligible, pitch-compensated controls

The C.5.2 default (`reflection=0.6`) was itself diagnosed as symptomatic,
not a fix: a raw per-round-trip amplitude coefficient decays as
`r^(f0*t)`, so its musically useful region is compressed into a tiny
sliver near `r=1` at any playable frequency -- `0.6` was already
destroying the string in a couple of cycles at most fundamentals. This
step replaces the raw coefficient as WG3's primary bridge control with
two separated, physically-grounded concepts, and simultaneously corrects
a real accounting gap in how the bridge's three-way energy split was
computed.

- **Verified, not assumed: one bridge encounter per round trip equals
  exactly one fundamental period.** Read directly from
  `wg2Processor.js`/`BidirectionalWaveguide.js`:
  `railLength = (sampleRate/frequency - compensationSamples)/2`, and
  `tick()` calls `bridgeTermination.reflect()` exactly once per sample,
  with a full round trip (`2*railLength` samples) equal to
  `sampleRate/frequency` samples at zero dispersion compensation --
  exactly one fundamental period. `pitchLocked` dispersion compensation
  is specifically designed to preserve this same total round-trip
  period, so the relationship holds with dispersion active too. This
  justifies treating the bridge as encountered exactly `f0` times per
  second, which is what the new mapping below relies on (see
  `claim.one-bridge-encounter-per-round-trip-equals-one-fundamental-
  period`).
- **`bridgeDecayVal`**: a new WG3 `Parameter`, replacing `reflection`.
  Dimensionless, `[0,1]`, a plain ordinary `FloatParameter` -- **zero
  changes to `Parameter.js`**, a deliberate design choice reached in
  discussion rather than adding a new log-scale `Parameter` subclass. The
  geometric (log-like) mapping onto an actual bridge-only T60 in seconds
  lives entirely in a new small WG3-local file,
  `soundlib/models/WG3/bridgeDecayMath.js`:
  `seconds = min*(max/min)**bridgeDecayVal` (so `bridgeDecayVal=0.5`
  lands on the geometric mean of `min`/`max`, not the arithmetic mean --
  verified numerically), then
  `r = exp(-1/(decaySecondsFromT60(seconds)*f0))`, reusing
  `decayMath.js`'s own `perSampleCoefficient()` with `f0` (round
  trips/second) standing in for "sample rate." A non-finite
  (`Infinity`) seconds value returns `r=1` exactly -- reachable via a
  direct API/diagnostic path, not necessarily the live knob's own
  finite range. The live `Parameter`'s own `.get()`/display stays the
  plain `[0,1]` value; the mapped seconds, computed `r`, and the
  transmitted/dissipated split are reported separately via
  `wg3Processor.js`'s `getBridgeDiagnostics()` (mirroring
  `DispersionFilter.getTargetDescription()`'s established precedent),
  not through the primary knob's own readout.
- **An alternative considered and rejected**: a `LogarithmicParameter`
  subclass of `FloatParameter`, giving `bridgeDecayTime` real seconds
  units with log-scale `get()`/`set()`/`getNormalized()`/
  `setNormalized()`. Technically workable, but the simpler
  `[0,1]`-dimensionless-knob-with-hidden-mapping alternative was judged
  "very close in spirit" and preferred, since it needs no changes
  anywhere in the shared `Parameter` class hierarchy at all.
- **`bodyCouplingEfficiency`**: a new WG3 `Parameter`, `[0,1]`, replacing
  `terminationDamping` with the INVERTED sense (η=1 fully transmitted,
  η=0 fully dissipated, vs. the old damping's fraction-dissipated sense)
  -- chosen to match the new energy formula directly
  (`transmittedEnergyFraction = η*(1-r²)`) with no sign flip needed at
  the call site.
- **The energy-accounting redesign, and why `1-r` was rejected as a
  transmitted-amplitude proxy.** The directive explicitly required
  verifying compatibility with the existing
  `nonReflectedWave = incident - baseReflected` (amplitude-subtraction)
  topology before coding, and that check found the proposed
  `t = sqrt(η*(1-r²))` is NOT substitutable into it -- it doesn't satisfy
  `r²+t²+d²=1` under that topology. The nearest coherent passive
  formulation, verified algebraically and empirically (energy-identity
  error 3.3e-16): at `reflectionTilt=0`, treat `reflected`, `transmitted`,
  and `dissipated` as three independent SCALAR multiples of the *same*
  incident sample `x` --
  `r=reflection`, `nonReflectedEnergyFraction=max(0,1-r²)`,
  `t=sqrt(η*nonReflectedEnergyFraction)`,
  `d=sqrt((1-η)*nonReflectedEnergyFraction)` -- giving
  `r²+t²+d²=1` identically, hence an exact per-SAMPLE energy identity,
  not a statistical/averaged one. This **necessarily supersedes** (not
  merely refines) the prior exact AMPLITUDE identity from C.2/C.3 -- an
  exact linear sum and an exact quadratic sum cannot both hold
  simultaneously except in degenerate cases, recorded explicitly as a
  `status: superseded` annotation on the old claim rather than silently
  dropped (see `claim.amplitude-accounting-identity-holds-exactly`'s own
  `superseded_by`/`superseded_note` fields -- the first use of this
  convention in this codebase's knowledge records).
- **The energy identity is exact only at `reflectionTilt=0`, confirmed
  (not assumed) to be merely approximate under nonzero tilt.** `t`/`d`
  are computed from the scalar `r` regardless of tilt, so they stay
  bounded and well-defined at any tilt setting, but a dedicated test
  measured a real (>1e-6, not floating-point noise) gap in the identity
  at `reflectionTilt=1` -- documented as an explicit, open limitation
  rather than claimed to generalize. Reflection tilt's own structure
  (the one-pole LP/HP blend, its passivity proof) is otherwise completely
  unchanged.
- **Legacy/raw-coefficient path preserved for diagnostics and tests**,
  per the directive's own explicit allowance: `FilteredTermination`'s
  `.reflection`/`.couplingEfficiency` fields remain plain, directly
  settable fields (no longer driven by a live WG3 `Parameter` of their
  own), and `wg3PipelineCore.js`'s `renderWg3Pluck` accepts an advanced
  `reflectionOverride` settings key that bypasses the `bridgeDecayVal`
  mapping entirely when present -- used throughout the migrated test
  suite for tests specifically about raw-coefficient-level mechanisms
  (passivity, tilt-reshaping, the energy-identity grid), while
  safety/gain-staging tests deliberately sweep `bridgeDecayVal`/
  `bodyCouplingEfficiency` themselves, since those should reflect what an
  actual user of the live parameter can reach.
- **Every gain-staging constant tied to the old formula was re-measured
  fresh, not carried over** -- `transmittedSignal`'s magnitude formula
  changed completely (`sqrt(η(1-r²))·x` vs. the old
  `(1-damping)(1-r)·x`). `TRANSMISSION_GAIN_MAX` (2) and
  `BODY_RADIATION_GAIN_MAX` (100) both remain safe under the new
  formula with comfortable margin (worst-case peak 0.573/0.885
  respectively against the 4.0 hard clamp), confirmed by measurement
  across the full parameter grid, not assumed to transfer.
- **Measured results**: bridge-only T60 at a requested 0.4s matched
  within 1.1-1.7% across 110-880Hz; the combined decay-rate relationship
  `1/T_total ≈ 1/T_s + 1/T_b` (string `decayTime` + `bridgeDecayVal`
  together) matched within 0.6-1.0% across several tested
  `(T_s, T_b)` combinations; string decay is confirmed independent of
  `bodyCouplingEfficiency` (only `reflection` feeds the waveguide's own
  returned sample); transmitted energy increases monotonically with
  `bodyCouplingEfficiency` at fixed `bridgeDecayVal`. Full measurement
  table (requested bridge T60 | computed `r` | measured bridge T60 |
  transmitted energy fraction, across 4 frequencies × 3 requested T60
  values) recorded in `wg3Pipeline.test.js`'s own `MEASUREMENT TABLE`
  test output.
- `BRIDGE_DECAY_VAL_DEFAULT=0.55` (bridge-only T60 ≈1.69s at 220Hz) and
  `BODY_COUPLING_EFFICIENCY_DEFAULT=0.5` replace the old
  `reflection=0.6`/`terminationDamping` defaults -- chosen by measurement
  (pitch clearly audible for several cycles, body contribution also
  measurable), not carried over as guesses.
- See `soundlib/models/WG3/knowledge/causal-claims.yaml` for the full
  measured validation (6 new claims, plus the superseded-claim
  annotation) and `knowledge/components.yaml`'s updated
  `component.filtered-termination` entry for the renamed parameter
  surface and grounding prose.
- **Explicitly stopped here, per the directive's own closing
  instruction**: no work was done on C.5.3, and no continuous/bowed
  string exciter was implemented or investigated -- both remain separate
  decisions for after further listening.

#### Post-Pre-C.5.3: `pickupGain`, and dropping "Monitor" from all three output-mix gain names

Listening with `transmissionMonitorGain`/`bodyRadiationMonitorGain` at 0
surfaced a real asymmetry: `_finalizeSample()`'s output mix
(`observed + transmissionMonitorGain*transmitted +
bodyRadiationMonitorGain*bodyRadiation`) had a gain on two of its three
taps but not the first -- the plain string pickup (`observed`) was always
mixed in at an implicit, unadjustable gain of 1. `pickupGain` closes that
gap, added as the genuinely symmetric third tap; at the same time, all
three names dropped their "Monitor" suffix (`transmissionGain`/
`bodyRadiationGain`), a pure rename with no semantic change, done once
rather than leaving the new, un-prefixed `pickupGain` inconsistent with
two still-`Monitor`-suffixed siblings.

- **`pickupGain` defaults to 1, not 0** -- the one asymmetry deliberately
  kept, since unlike the other two (new, opt-in contributions that
  default to silent), `pickupGain` is not a new contribution; it's
  finally naming a gain on a signal that was already unconditionally
  present. A default of 1 is what keeps every existing render/preset
  byte-identical to before this change.
- **The real use case, confirmed by its own test**: setting
  `pickupGain=0` mutes the plain string pickup out of the mix entirely,
  letting `transmissionGain`/`bodyRadiationGain` be heard in isolation --
  useful for A/B-ing the bridge's transmitted signal or the body's own
  radiated output against each other without the (often-dominant) direct
  pickup signal in the way.
- **Range `[0,2]`, matching `transmissionGain`'s own range** -- same kind
  of raw, unfiltered signal magnitude as the pickup's own `observed`
  value, so the same ceiling applies. Verified, not assumed: a dedicated
  test renders the full parameter grid with all THREE gains
  (`pickupGain`, `transmissionGain`, `bodyRadiationGain`) simultaneously
  at their own max -- measured worst-case peak=1.01, RMS=0.12, comfortably
  under `OutputConditioner`'s 4.0 clamp with real margin, confirming the
  combination newly made possible by adding a third max-2 gain alongside
  the existing max-2 and max-100 gains doesn't interact in some
  unexpected way.
- Added to the parameter list directly before `transmissionGain` (in
  `wg3Processor.js`'s `parameterDescriptors`, `WG3.js`'s `addParameter()`
  calls, and `startSound()`'s forwarding list) -- matching the order the
  user asked for, and the natural reading order of the output mix itself
  (pickup, then transmission, then body radiation).

#### Widening `transmissionGain`'s range: 2 -> 10, and an accepted clipping tradeoff

Confirmed by listening, not just measurement: at `transmissionGainMax=2`,
the tap's own contribution was real (per the earlier
`transmissionMonitorGain` investigation's own render-and-measure
evidence) but consistently small next to the much louder, always-present
`pickupGain=1` signal -- raising it in the UI never read as a clearly
distinct, audible effect. Widened to 10.

- **Solo widening is safe with real margin**: at `transmissionGain=10`
  alone (`pickupGain`/`bodyRadiationGain` left at their own DEFAULTS, not
  maxed), worst-case measured peak is **3.29** -- comfortable headroom
  below the 4.0 clamp remains for the common case of pushing just this
  one gain up.
- **The genuinely new risk only appears when all three independent gains
  are pushed to their own max SIMULTANEOUSLY.** At one specific corner
  (low frequency, `bridgeDecayVal=0`, `reflectionTilt=-1`,
  `bodyCouplingEfficiency=1`, `pickupGain=2`, `transmissionGain=10`,
  `bodyRadiationGain=100`), the measured (clamped) peak hit exactly
  4.0 -- the same "coincidentally already at a round number" trap Wind's
  own gain-staging investigation warned about (`OutputConditioner`'s
  clamp saturating the measurement, hiding the true unclamped
  magnitude). Re-measuring with `energy` scaled down so the clamp can't
  engage, then scaling back up, recovered the TRUE unclamped peak:
  **4.675** -- genuinely over the clamp, not just near it.
- **This was presented to the user as a real tradeoff with options
  (accept the clipping corner, or lower `pickupGainMax`/
  `bodyRadiationGainMax` to restore margin) rather than resolved
  unilaterally.** The user chose to accept it: `transmissionGainMax`
  stays at 10 as asked, and the clamp is allowed to audibly engage at
  this one deliberately-extreme, all-three-gains-maxed corner. RMS at
  that same corner stays low (~0.12) -- confirming this is a single
  clipped transient at one specific combination, not a sustained
  loud/distorted signal or a sign of instability, matching Wind's own
  "that is what the clamp is for" precedent -- except here the corner is
  a deterministic combination of UI-reachable settings, not a rare
  stochastic excursion, so it's recorded explicitly as an accepted,
  documented tradeoff rather than an incidental rare case.
- The permanent SAFETY grid search's own flagging threshold (previously
  `maxAbs > 2.0`) had to move too -- that threshold predates
  `transmissionGainMax=10` and would now flag every near-max-gain
  combination as "surprising," when reaching toward the clamp at extreme
  gain settings is the now-accepted, expected behavior. Raised to flag
  only non-finite output or the hard clamp itself somehow being exceeded
  (`maxAbs > 4.0`) -- a check that the clamp is doing its job, not that
  nothing ever approaches it.
- See `wg3Pipeline.test.js`'s combined gain-staging test for the full
  measured numbers and the true-unclamped-peak recovery technique.

### 6. Worker-offloaded generation

DSP computation happens off the audio-render thread entirely, in a Web
Worker, streamed into an `AudioWorkletNode`'s ring buffer for playback.
Two variants, same plumbing shape:
- `soundlib/models/WorkerFM.js` — the worker (`WorkerFM/workers/generative-audio-worker.js`,
  using `AudioGenerator.js`) runs hand-written phase-continuous FM
  synthesis; the worklet (`WorkerFM/worklets/generativeAudioProcessor.js`)
  holds the circular buffer and requests more.
- `soundlib/models/WaterFillRNN.js` — the same shape, but the worker chain
  (`WaterFillRNN/workers/manager-worker.js` → `RNNWorker.js`) runs a
  trained RNN via ONNX Runtime Web (`WaterFillRNN/onnx/rnn_step.onnx`)
  instead of hand-written math.

Reach for this shape when the generator is too expensive or too
inherently non-real-time (a trained model's inference cost, a lookahead
algorithm) to run inside the audio-render callback itself.

### 7. External file/sample playback

Two distinct levels, same starting point (`BaseSound.loadAudioFile()`):
- **Plain playback** — `soundlib/models/WaveTrigger.js`: fetch, decode,
  play or loop an `AudioBufferSourceNode` directly. No manipulation.
- **Granular** — `soundlib/models/AnotherGranny.js`: schedules many
  short, windowed, overlapping `AudioBufferSourceNode` grains via a
  JS-thread look-ahead scheduler (`setTimeout`-driven, not a worklet) —
  the only model in the library doing sample-accurate scheduling outside
  an `AudioWorklet`.

### 8. Faust/WASM-wrapped physical model

Wraps a DSP engine compiled elsewhere (via the Faust language/toolchain)
rather than writing the synthesis in this codebase. Canonical:
`soundlib/models/FaustClarinet.js`, which loads a Faust-generated
`AudioWorkletNode` factory (`soundlib/models/faust.clarinet/exfaust87.js`
+ `exfaust87-processor.js`, embedding base64 WASM) and discovers its
parameters **at runtime** by parsing the Faust-generated JSON UI
descriptor (`soundlib/fausthelper.js`'s `parse_faust_ui`), calling
`addParameter()` dynamically per discovered control rather than declaring
a fixed parameter list in the constructor. Because parameter discovery is
async, a preset built on this kind of model can't apply its overrides
synchronously in the constructor — see `FaustClarinetPreset.js`'s
`initPromise.then(...)` chaining, and the exception note below.

### 9. Preset-derived models

Subclass a canonical model, call `super()`, then overwrite each live
parameter's `min`/`max`/`value`/`defaultValue`/`preference` with values
transcribed from a saved `soundlib/presets/*.json` file. Fully covered
already in `docs/WORKLETS_AND_PRESETS.md`'s "From a saved preset to a new
Sound Model" section — read that before building one, not this doc.

Three documented exceptions to the otherwise-uniform pattern:
- `HamburgerLadyChua13.js` doesn't subclass `ChuaOscillator` — it
  duplicates that model's worklet-construction code standalone. This
  predates the subclassing pattern being established elsewhere; it's not
  something to copy for a new preset, just a known inconsistency.
- `FaustClarinetPreset.js` chains its overrides onto `initPromise` instead
  of applying them synchronously (see archetype 8, above).
- `WindChimesPreset.js`'s `pitch_1..pitch_5` must be set via
  `setParameter()`, not a direct `.value` mutation — `WindChimes` forwards
  each bell's pitch to its child `ChimeTube` only through
  `updateParameter()`, so a raw `.value` write would change the displayed
  value without ever reaching the tube actually producing sound. Whenever
  a preset's base model forwards a parameter to a child at construction
  time (rather than treating it as a pure stored destination read fresh
  later), the preset needs this same `setParameter()` treatment instead of
  the usual direct-`.value` shortcut.

### 10. Cross-synthesis / vocoder: a hidden control-source engine shaping an external-audio carrier

**The general shape, independent of which specific sounds fill it**: two
roles, composed inside one worklet. **Role A, the control source**: some
process that internally evolves N independently-varying numeric signals
over time, whose own raw audio is never itself meant to be heard — only
tapped, per-signal, as control-rate data. **Role B, the carrier**: a real
audio-rate signal — in practice, another `SoundModel`'s actual output —
that gets shaped by Role A's N control signals, band by band or however
the coupling is defined. Canonical instance so far:
`soundlib/models/ChimeVocoder.js` — Role A is a hidden, `BambooChimes`-
identical stochastic-collision engine (archetype 5.1) whose 7 per-tube
`ResonatorBank` outputs are the N control signals; Role B is an internally-
owned `GrannyInteractive` instance's granular output, split into the same
7 tuned bands by a second `ResonatorBank`, each band multiplied by its
matching envelope-followed control signal and summed.

**Recognizing this pattern in a new request**: watch for phrasing like
"let sound A's energy/activity/character shape sound B," "sound A played
through sound B's resonance" (or the reverse), "one instrument's dynamics
modulating another's timbre or filter," or anything explicitly asking for
a cross-synthesis/vocoder-style effect *between two of the library's
existing sounds*. When you see it, the concrete design questions are:
which existing model (or hidden, non-instantiated engine) supplies the N
control signals, and which supplies the carrier audio — Role A and Role B
don't have to be `BambooChimes`/`GrannyInteractive` specifically, and
don't even have to be different classes (two independently-seeded
instances of the *same* class could fill both roles). Once those two
roles are identified, the rest of this section's structure transfers
directly; only the tap mechanism (see below) is tied to `ResonatorBank`
specifically.

#### Audio graph and node ownership

```
Role B: carrier                          Role A: hidden control source
────────────────                         ─────────────────────────────
GrannyInteractive child                  chime engine (inline DSP in the
  grain sources -> grain windows         same worklet, not a 2nd child)
  -> granny.gainNode (= outputNode)        stochastic collision -> exciter
        |                                  -> resonators.excite(tube)
        | .connect()                       -> resonators.tick()
        v                                  -> .y1[i]  (7 signals)
  inputs[0][0]                                   |
        |                                        v
        v                                  EnvelopeFollowerBank
  carrierResonators (7 modes, all                |
  excited by the same sample)                    |
        |                                        |
        v                                        |
  .y1[j]  (7 bands)  ------- multiply ------------+
                                |
                                v
                        sum all 7 bands
                                |
                                v
                     * 1/sqrt(7) normalize
                                |
                                v
                        OutputConditioner
                                |
                                v
                  outputs[0][0]  (worklet's own output)
                                |
                                v
             ChimeVocoder.gainNode (outer envelope, = outputNode)
                                |
                                v
                     AudioSystem's master gain
```

**Node ownership**: `ChimeVocoder` owns `this.workletNode` and
`this.gainNode` (also `this.outputNode`) — that's it. `this.granny` (the
child instance) owns its *entire* internal graph itself — grain sources,
grain-window gains, its own `this.gainNode`/`outputNode` — `ChimeVocoder`
never reaches into any of it directly, only through the child's public
API (`Parameter`s, `setParameter()`, `play()`, `stop()`, `connect()`,
`destroy()`). The **only** edge between the two models' graphs is one
call: `this.granny.connect(this.workletNode)`.

#### Lifecycle ordering

Constructor sequence, and why the order matters:
1. `super(context, name, gain)` — `BaseSound`'s own setup, no nodes yet.
2. All `addParameter()`/`addStringParameter()` calls — declares the full
   parameter union (see below); still no nodes, no child.
3. `addEvent(...)` — registers the discrete-trigger event, if any.
4. **The child is constructed** (`this.granny = new GrannyInteractive(...)`)
   — this is when the child's *own* nodes get created (inside its own
   constructor) and, for a file-loading carrier like `GrannyInteractive`,
   when its async load kicks off in the background (see the flagged
   `waitForLoad()` gap below).
5. **`this.createNodes()` runs last** — it calls
   `this.granny.connect(this.workletNode)`, so the child must already
   exist by this point. This is the one hard ordering constraint the
   pattern imposes: *construct the child before wiring it in.*

#### How `play()`/`stop()` propagate

Neither is automatic or inherited from the child relationship — both are
explicit calls the parent makes:
- `startSound()` calls `this.granny.play()` itself (after setting the
  worklet's `active` param, before `scheduleAttack()`).
- `stopSound()` calls `this.granny.stop()` itself, **without** waiting for
  it to finish and **without** a callback, before starting its own
  `scheduleDecay()`. This is a deliberate deviation from archetype 3's
  usual "wait for every child's release" rule (see below for why), and
  also sidesteps a pre-existing quirk in `AnotherGranny.stopSound()`: it
  invokes its own `onReleased` callback *twice* (once immediately, once
  again inside its own `scheduleDecay()` completion) — passing a callback
  into the child's `stop()` here would double-fire it, so don't.
- Role A (the hidden engine) has no `play()`/`stop()` of its own at all —
  it isn't a `SoundModel`, just inline worklet DSP. Its on/off state is
  entirely the same `active` `AudioParam` and `{type:'reset'}`/
  `{type:'strike'}` port messages the whole worklet already uses.

#### Parameter aggregation and conflict resolution

A model exposing a full union of two composed instruments' parameters
needs a naming convention to avoid collisions, not just distinct
purposes. Every `SoundModel` has an inherited `gain` `Parameter` from
`BaseSound` — forwarding a child's own `gain` alongside the parent's own
outer `gain` needs a prefix (`ChimeVocoder` uses `carrier*` for
everything forwarded from its `GrannyInteractive` child) so the two
genuinely different controls (raw carrier level vs. final output level)
don't collide under one name. Forwarding itself uses the child's public
`setParameter()` API (matching archetype 9's `WindChimesPreset` exception,
for the identical reason: a raw `.value` mutation would change what's
displayed without the child ever actually receiving it), via a small
lookup table (forwarded name -> child's own name) rather than one switch
case per forwarded parameter.

#### Gain staging (the full chain — easy to lose track of where to adjust level)

For `ChimeVocoder` specifically, level passes through **five** distinct
stages before reaching the master gain:
1. `carrierGain` (Granny's own `gain`, default 0.8) — scales the carrier's
   raw grain-summed output *before it ever leaves the child*.
2. That unscaled signal excites all 7 carrier resonator modes (their own
   per-mode `gain` field, from `ResonatorBank.setMode()`, is a fixed `1.0`
   here — no per-mode scaling of its own).
3. Each band's resonant output is multiplied by its envelope, then all 7
   products are summed and scaled by `1/sqrt(7)` (the correlated-sources
   normalization, confirmed empirically necessary — see below).
4. `OutputConditioner`'s own `outputGain` (0.2, informed starting point,
   not sourced) plus its hard clamp (±4).
5. `ChimeVocoder`'s own outer `gain` envelope (default 0.6, `BaseSound`'s
   default attack/decay — see the character note below), then whatever
   `AudioSystem`'s own master gain applies on top.

#### Channel-count assumptions

The worklet needs to actually read its `inputs` argument — every other
worklet in this codebase declares `process(inputs, outputs, parameters)`
but never indexes into `inputs`; this archetype is the first to. The
model's own `AudioWorkletNode` needs explicit `channelCount: 1,
channelCountMode: 'explicit'` in its constructor options, since nothing
else forces the connected carrier down to mono before `process()` sees it
otherwise.

#### Connection, disconnection, and disposal

`connect()`/`disconnect()` are **not** overridden on `ChimeVocoder` —
`BaseSound`'s defaults already fully cover it, since `outputNode`/
`gainNode` are the same node. Critically, these calls only ever touch
*that* node — the internal `granny -> workletNode` edge, set up once in
`createNodes()`, is never renegotiated by a `connect()`/`disconnect()`
call on the parent. `destroy()` **is** overridden: `super.destroy()`
(stops + disconnects the parent's own output) runs first, then
`this.granny?.destroy?.()` (which internally calls the child's *own*
`stop()`+`disconnect()` — this is what actually tears down the
`granny -> workletNode` edge, via the child's own `this.destination`
bookkeeping, not anything the parent does to that edge by name), then the
parent's own `workletNode`/`gainNode` get explicitly disconnected too.

#### Whether either half can run independently

`GrannyInteractive` *the class* is fully general and already runs
independently elsewhere (it's its own standalone top-level sound in the
app). The *specific instance* `ChimeVocoder` owns, though, is private and
dedicated — freshly constructed, never registered with `AudioSystem`,
never in the sound selector, sharing no state with the standalone Granny
sound. Role A (the hidden engine) has no independent existence at all
here — it's inline DSP inside the same worklet as the carrier processing,
a design choice (see "general vs. specific" below), not something you
could extract and play on its own without restructuring it into a real
second child or a standalone worklet.

#### Whether the composite adds latency

Reasoned from the Web Audio spec, not empirically measured in a browser:
no. `AudioWorkletProcessor.process()` is called once per render quantum
with that *same* quantum's audio already present on `inputs[0]` from
whatever is `.connect()`-ed to it — a same-render-pass, quantum-
synchronous read, identical in kind to a plain `GainNode`-to-`GainNode`
connection. Routing the carrier through this worklet doesn't add a
buffering hop beyond the baseline per-quantum latency every node in *any*
Web Audio graph already has. If this ever matters for a latency-sensitive
use, verify empirically rather than trust this claim blindly — it hasn't
been measured, only reasoned from documented spec behavior.

#### Which pieces are general vs. specific to this instance

**General, reusable regardless of which two models fill the roles**: the
overall shape (Role A's per-signal taps -> `EnvelopeFollowerBank` ->
multiply against Role B's own per-band taps -> sum -> normalize ->
`OutputConditioner`); the `channelCount:1`/`channelCountMode:'explicit'`
requirement; the `carrier*`-forwarding-with-collision-avoidance pattern;
the "child constructed directly, connected as an inaudible upstream
input, no release-gating" composition shape; `EnvelopeFollowerBank` itself
(lives in `soundlib/utilities/`, fully model-agnostic already).

**Specific to `ChimeVocoder` today**: the 7 fixed tube frequencies and
`BambooChimes`-identical stochastic-collision engine as Role A, and
`GrannyInteractive` specifically as Role B. A future variant swapping in
a different control source (say, `Maraca`'s single-mode engine, or a
non-resonator control source like an LFO bank) and/or a different carrier
(any other `SoundModel`, or even a second instance of the same class used
for Role A) would reuse everything general above unchanged, *except*: the
tap mechanism (`.y1[i]`) is specific to `ResonatorBank` — a non-resonator
control source would need a different way to expose its own N per-channel
values, since `.y1[i]`'s free availability here is a `ResonatorBank`-
specific accident (see below), not a general contract every possible
Role-A engine provides automatically.

#### Why this needed no `ResonatorBank` changes, unlike Phase G

`ResonatorBank.y1[i]`'s pre-existing plain-field exposure is what makes
tapping Role A's per-mode state possible with zero class changes — it
already stores `a1`/`a2`/`gain`/`y1`/`y2`/`excitation` as plain public
fields, no encapsulation, and `.y1[i]` already holds mode `i`'s own latest
output right after `tick()`. Contrast with Phase G's `excite()`/`tick()`
split (archetype 5.1's own note above), which *was* a genuine new
capability the class didn't have; this archetype needed none — it's
simply the first caller to read per-mode state instead of only using
`tick()`'s summed return value.

#### The correlated-resonator-summing gotcha (empirically confirmed, not assumed)

Summing several high-Q resonators driven by the same shared input needs
the same `1/sqrt(filterCount)` normalization archetype 2 already documents
for `BellStrike`'s noise-bank summing — they're strongly correlated (not
independent sources), so an un-normalized sum grows roughly with tube
count and clips hard in practice. Confirmed empirically on `ChimeVocoder`,
not just assumed: a plain white-noise stand-in carrier hit the output's
hard clamp even at a low `outputGain` before this normalization was added
to the per-sample band sum.

#### Tests: what's covered automatically, what needs manual verification

`soundlib/utilities/test/chimeVocoderPipeline.test.js` (via
`soundlib/models/ChimeVocoder/chimeVocoderPipelineCore.js`, the same
node-side-mirror pattern every PhISEM worklet already uses) covers, at the
pure-DSP level: silence with nothing connected/struck; silence with *only*
a carrier connected (the hidden engine must actually be struck for
anything to happen — confirms Role A is required); silence with *only* a
strike and no carrier (confirms Role B is required — there's nothing to
shape); audible, finite, non-clipping output with both present; seeded
determinism and seed divergence; no NaN/Infinity at extreme parameter
settings; and that changing a parameter (`envelopeSmoothing`) measurably
changes the render, not just that nothing crashes — the same class of bug
this whole test-infrastructure pattern exists to catch (see the
`collisionDecaySeconds` routing-bug note above).

What this **cannot** cover, because none of it touches
`AudioWorkletProcessor.process()`: the real child's actual lifecycle
through a live `AudioContext` (`play()`/`stop()`/`destroy()` propagation),
the `.connect()` edge itself, or `channelCountMode` actually downmixing a
real (e.g. stereo) source. Verify these by hand in the running app, per
`docs/ADDING_A_SOUND.md`'s acceptance checklist: select the sound, run a
Play → Strike → Stop → replay cycle, and confirm no console errors or
audible artifacts after Stop.

#### Pre-existing gap this pattern inherits, not fixed here

`AnotherGranny`'s constructor calls `loadAudioFile(...).then(...)`
directly, bypassing `BaseSound.initializeAudio()`, so `waitForLoad()` is a
silent no-op for `AnotherGranny`/`GrannyInteractive` today — already true
for the existing standalone `GrannyInteractive` app instance. Any future
model using a file-loading carrier inherits this same gap (its audio may
still be loading when the parent's `play()` is first called) unless fixed
upstream in `AnotherGranny.js` itself, which is out of scope for any one
model built on top of it.

## Housekeeping (flagged, not touched)

These were surfaced while building this catalog and are noted here rather
than acted on, per the project's "report separately and ask before
changing" rule for unrelated cleanup:

- `soundlib/worklets/clickTrainProcessor_onebuffer.js` — zero references
  anywhere in the repo; appears to be dead.
- `soundlib/models/FaustClarinetAllParams.js` — an earlier draft of
  `FaustClarinet.js` (hardcoded internal IP address), not exported from
  either index.
- `soundlib/models/TransitionClickerWorkletSoundModel.js` and
  `soundlib/worklets/transitionClickTrainProcessor.js` — an unexported
  prototype of the transition-event mechanism now inside
  `_PhaseEventPinger.js`.
- `soundlib/models/CluadesFirst.js` — near-duplicate of `Ping.js`'s
  pattern, not exported.
- **File-placement policy, applied going forward only.** A top-level,
  independently-loadable model lives directly in `soundlib/models/`; a
  child-only helper not meant to be used on its own lives in a subfolder
  named after its top-level sound (see `docs/ADDING_A_SOUND.md`).
  `RendezvousPingerII/III` (subfoldered under `RendezvousPinger/` even
  though both are top-level) and `ChimeTube` (subfoldered under
  `WindChimes/` even though it's independently loadable) predate this
  policy and are intentionally left unmigrated — not something to copy
  for a new model, just a known, deliberately-deferred inconsistency.

## Keeping this doc current

When a new model introduces a genuinely new architectural pattern (not
just another instance of one already cataloged above), add it here as part
of that work — see `docs/ADDING_A_SOUND.md`'s process for exactly when.
