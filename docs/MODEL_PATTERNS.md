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
| `ChimeTube` | Meta-model composition (+ worklet event generator) | `soundlib/models/WindChimes/ChimeTube.js` |
| `WindChimes` | Meta-model composition (ensemble) | `soundlib/models/WindChimes/WindChimes.js` |
| `ClickerWorkletSoundModel` | Worklet audio source (simple) | `soundlib/models/ClickerWorkletSoundModel.js` |
| `ChuaOscillator` | Worklet audio source (numerical integration) | `soundlib/models/ChuaOscillator.js` |
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

## Keeping this doc current

When a new model introduces a genuinely new architectural pattern (not
just another instance of one already cataloged above), add it here as part
of that work — see `docs/ADDING_A_SOUND.md`'s process for exactly when.
