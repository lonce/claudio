# Model Architecture Patterns

This is a catalog of the *architectural* patterns used across Claudio's
sound models — not a description of every model's sound design, and not a
substitute for reading the code. Its job is narrow: help you find the
closest existing model to use as a reference before writing something new,
and carry forward protocol details that aren't obvious from a cold read of
one file.

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
`soundlib/utilities/SimplexNoise.js`), and
`soundlib/worklets/plusSimplexPhaseEventProcessor.js` (drives
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

### 10. Cross-synthesis / vocoder: hidden PhISEM engine driving an external-audio carrier filterbank

A model that owns two identically-tuned `ResonatorBank`s: one excited by a
hidden stochastic PhISEM engine (archetype 5.1) whose own audio is never
summed into output — only its per-mode `.y1[i]` values are read, through
an envelope follower, as control-rate signals — and one excited by a real
external audio signal (all modes together every sample, a true parallel
filterbank, not the one-at-a-time routing the hidden engine itself uses).
Each carrier band is multiplied by its matching envelope and summed.
Canonical: `soundlib/models/ChimeVocoder.js` (hidden engine = a
`BambooChimes`-identical composition; carrier = an internally-owned
`GrannyInteractive` instance).

Key protocol details:
- **`ResonatorBank.y1[i]`'s pre-existing plain-field exposure is what
  makes this possible with zero `ResonatorBank` changes.** The class
  already stores `a1`/`a2`/`gain`/`y1`/`y2`/`excitation` as plain public
  fields, no encapsulation — `.y1[i]` already holds mode `i`'s own latest
  output right after `tick()`. Contrast with Phase G's `excite()`/`tick()`
  split (this same doc's archetype 5.1 notes), which *was* a genuine new
  capability the class didn't have; this archetype needed none.
- **Summing several high-Q resonators driven by the same shared input
  needs the same `1/sqrt(filterCount)` normalization archetype 2 already
  documents for `BellStrike`'s noise-bank summing** — they're strongly
  correlated (not independent sources), so an un-normalized sum grows
  roughly with tube count and clips hard in practice. Confirmed
  empirically on `ChimeVocoder`, not just assumed: a plain white-noise
  stand-in carrier hit the output's hard clamp even at a low `outputGain`
  before this normalization was added to the per-sample band sum.
- **Owning a child `SoundModel` purely as an inaudible upstream `AudioNode`
  source is a distinct shape from archetype 3's usual audible children.**
  The child is still constructed directly (never through
  `audioSystem.createSound()`, so it's never auto-wired to master gain or
  exposed in the app's own sound selector), but its output is
  `.connect()`-ed straight into the parent's own worklet as an audio-rate
  carrier input rather than summed into a shared gain node. This is why
  the parent's `stopSound()` does **not** need to gate on the child's own
  release the way archetype 3's rule normally requires — nothing about the
  child is ever itself audible, so there's nothing to click by cutting the
  parent's envelope first. `AnotherGranny.stopSound()` also has a
  pre-existing quirk worth knowing about here: it invokes its own
  `onReleased` callback twice (once immediately, once again inside its own
  `scheduleDecay()` completion) — passing a callback into the child's
  `stop()` would double-fire it, so call it with none.
- **The worklet needs to actually read its `inputs` argument** — every
  other worklet in this codebase declares `process(inputs, outputs,
  parameters)` but never indexes into `inputs`; this archetype is the
  first to. The model's own `AudioWorkletNode` needs explicit
  `channelCount: 1, channelCountMode: 'explicit'` in its constructor
  options, since nothing else forces the connected carrier down to mono
  before `process()` sees it otherwise.
- **A model exposing a full union of two composed instruments' parameters
  needs a naming convention to avoid collisions**, not just distinct
  purposes. Every `SoundModel` has an inherited `gain` `Parameter` from
  `BaseSound` — forwarding a child's own `gain` alongside the parent's own
  outer `gain` needs a prefix (`ChimeVocoder` uses `carrier*` for
  everything forwarded from its `GrannyInteractive` child) so the two
  genuinely different controls (raw carrier level vs. final output level)
  don't collide under one name. Forwarding itself uses the child's public
  `setParameter()` API (matching archetype 9's `WindChimesPreset`
  exception, for the identical reason: a raw `.value` mutation would
  change what's displayed without the child ever actually receiving it),
  via a small lookup table rather than one switch case per forwarded name.

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
