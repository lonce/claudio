# Claudio PhISEM Architecture and Maraca First Pass

## Status

Planning and implementation specification for an experimental first pass.

This document describes:

1. a worklet-native synthesis layer for Claudio;
2. a reusable architecture inspired by Perry R. Cook's Physically Informed Stochastic Event Modeling (PhISEM);
3. the first concrete model, a playable maraca;
4. the experiments and later instruments that should guide refinement of the architecture.

The first implementation is deliberately not intended to freeze a universal percussion framework. It should produce a convincing, efficient, controllable maraca while exposing the likely reusable boundaries. Those boundaries should be reconsidered after implementing at least one closely related model, such as a cabasa, and one structurally different model, such as bamboo chimes.

---

## 1. Motivation

Claudio already uses AudioWorklets for timing-critical control generation and event detection. Examples include phasors and noise-driven threshold crossings. In those models, a processor can notify the main thread that a musically meaningful event occurred, and a parent SoundModel can respond by triggering a child SoundModel.

PhISEM introduces a different use of the worklet layer. The worklet is itself the audio synthesizer.

A maraca sound may contain hundreds of small collision events. These collisions are not separate musical actions; collectively, they constitute one sound. Posting each collision to the main thread and asking child SoundModels to render them would:

- lose sample accuracy;
- inherit main-thread notification jitter;
- create unnecessary messages and object-management overhead;
- make high collision densities impractical;
- obscure the fact that the collisions are internal DSP details.

For this family of models, gesture input crosses into the worklet, but sound-forming micro-events remain entirely on the audio rendering thread.

The architectural principle is:

> Musically meaningful events may cross the SoundModel/worklet boundary. Sound-forming micro-events should remain inside an audio-generating worklet.

For example, `shake()` is a meaningful public action. The individual bean collisions produced by that shake are internal synthesis events.

---

## 2. Relationship to Cook's Work

Perry Cook's PhISEM approach replaces an exhaustive simulation of every particle trajectory with a compact stochastic model retaining the perceptually and causally important behavior:

- a performer supplies mechanical energy;
- stored system energy decays;
- objects collide probabilistically;
- collisions generate short excitations;
- excitations drive resonances representing the containing or sounding body.

The approach is "physically informed," rather than a complete numerical simulation. Parameters retain meaningful relationships to the imagined object, but the algorithm does not solve the full particle mechanics or acoustic wave equation.

For the initial Claudio implementation, Cook's published descriptions and STK implementation should be treated as:

- the historical and conceptual reference;
- a source of useful initial constants;
- a baseline against which behavior can be compared;
- not a requirement for line-by-line reproduction.

The goal is to preserve the causal structure and interactive qualities while producing code that fits Claudio's architecture and can evolve into a broader family of models.

Primary references are listed at the end of this document.

---

## 3. Architectural Layers

The Claudio system should distinguish three worklet roles.

| Worklet role | Worklet output | Main-thread responsibility |
| --- | --- | --- |
| Control generator | Continuous control signal | Parameter exposure, routing and lifecycle |
| Event detector | Timestamped event notifications | Triggering and managing child SoundModels |
| Audio synthesizer | Audio samples | Public API, parameters, graph ownership and lifecycle |

The PhISEM family belongs primarily to the third category.

### 3.1 Main-thread SoundModel wrapper

The public model, initially `Maraca`, should extend Claudio's normal `BaseSound` class and follow the established SoundModel conventions.

It should:

- expose a small, comprehensible set of performance parameters;
- construct and connect its `AudioWorkletNode`;
- establish `outputNode` in the expected BaseSound graph;
- implement the normal `play()`, `stop()` and replay lifecycle;
- use BaseSound's gain/attack/decay behavior where appropriate;
- translate continuous controls into `AudioParam` automation;
- translate discrete commands into processor messages;
- manage worklet loading and readiness using Claudio's established pattern;
- declare a portable `WORKLET_PATH` using `new URL(..., import.meta.url)`;
- contain no per-collision DSP.

### 3.2 AudioWorkletProcessor

The processor owns all timing-critical synthesis state and directly generates output samples.

It should perform:

- mechanical-energy accumulation and decay;
- stochastic collision generation;
- collision excitation;
- resonant filtering;
- audio-rate parameter response where required;
- final output conditioning;
- deterministic reset and seeded-random behavior.

The processor must not instantiate, trigger or manage Claudio SoundModels.

### 3.3 DSP components inside the processor

Reusable DSP components are ordinary JavaScript modules/classes imported by a processor. They are neither AudioWorklet processors nor SoundModels.

Likely components include:

- `SeededRandom`
- `EnergyAccumulator`
- `StochasticCollisionGenerator`
- `NoiseBurstExciter`
- `ResonatorBank`
- `OutputConditioner`

Later additions may include:

- `ScrapeEventGenerator`
- `EventCloudGenerator`
- `FrictionExciter`
- `ModalVoicePool`
- `DropletVoice`

These components should be modular in source organization without creating a chain of AudioWorkletNodes. One integrated processor avoids graph overhead, keeps configuration changes coherent and permits efficient per-sample loops.

---

## 4. Proposed First-Pass Signal Architecture

The first maraca should use the following causal path:

```text
shake gesture / continuous drive
              |
              v
      mechanical energy state
              |
              v
 stochastic collision decision
              |
              v
  accumulated decaying noise burst
              |
              v
       gourd resonator bank
              |
              v
    DC blocking / output scaling
              |
              v
           audio output
```

Conceptually, the sample loop is:

```js
energy = updateEnergy(energy, drive, systemDecay);

if (collisionGenerator.tick(energy, objectCount)) {
  soundLevel += collisionStrength(energy, objectCount);
}

soundLevel *= soundDecay;
excitation = soundLevel * random.bipolar();

sample = resonatorBank.tick(excitation);
sample = outputConditioner.tick(sample);
```

This is illustrative, not final code. In particular, the precise dependence of collision probability and amplitude on energy should be verified against Cook's model and evaluated perceptually.

---

## 5. DSP Components

### 5.1 Seeded random generator

The stochastic process must be reproducible when given the same seed and control sequence.

Requirements:

- inexpensive generation in the sample loop;
- uniform unipolar and bipolar values;
- deterministic reset;
- no use of `Math.random()` in the synthesis loop;
- no allocations;
- seed supplied through a discrete processor message;
- a documented default seed or documented random-seed policy.

Seeded determinism is important for tests, offline comparisons, debugging and repeatable demonstrations. It does not imply that normal performances must always sound identical.

### 5.2 Energy accumulator

The energy accumulator represents stored mechanical energy rather than output amplitude.

A starting model is:

\[
E[n+1] = \min(E_{max}, d_s E[n] + u[n])
\]

where:

- `E` is internal energy;
- `d_s` is the per-sample system decay coefficient;
- `u[n]` is energy supplied by continuous drive or a discrete impulse.

The component should support:

- continuous drive from an `AudioParam`;
- discrete energy injection from `shake()`;
- clamping or other protection against unbounded accumulation;
- reset to silence;
- sample-rate-independent interpretation of decay controls.

The conversion from a user-facing decay parameter to a per-sample coefficient should be centralized and documented. Prefer perceptually useful units such as a decay time in seconds over an unexplained coefficient, even if a normalized compatibility parameter is temporarily used during Cook/STK comparison.

### 5.3 Stochastic collision generator

For a maraca, collisions form an approximately Poisson process whose rate depends primarily on the number of objects and potentially on system energy.

The implementation should make these roles explicit:

- `numberOfObjects` affects expected event density;
- energy may affect collision rate, collision strength, or both;
- randomness chooses event times;
- the generator does not itself produce audio.

The first implementation may closely follow Cook's collision test to establish a baseline. The underlying code should nevertheless isolate the probability calculation so it can later be replaced or generalized.

Questions to preserve for experimentation:

- Should the expected collision rate be proportional to `N`, `sqrt(N)`, or a saturating function?
- Does low energy reduce event probability, event strength, or both?
- How should increasing object count affect the strength of each individual event?
- Should dense configurations approach continuous friction-like excitation?

The collision generator should return data through preallocated fields or primitive values. It must not allocate an event object per collision.

### 5.4 Noise-burst exciter

For the maraca, each collision contributes to a rapidly decaying stochastic excitation.

When collision bursts share the same decay law, separate collision voices are unnecessary. Their contributions can be accumulated into a single state:

```js
if (collision) soundLevel += eventAmplitude;
soundLevel *= soundDecay;
excitation = soundLevel * random.bipolar();
```

This is one of the main efficiency advantages of the model.

The exciter should eventually permit variations such as:

- white versus colored noise;
- an impulse/noise mixture representing hardness;
- different decay rates;
- persistent friction excitation;
- energy-dependent spectral brightness.

Only what the maraca needs should be implemented in the first pass.

### 5.5 Resonator bank

The body should be represented by a fixed-capacity bank of two-pole resonators or equivalent efficient modal filters.

Required capabilities:

- one or more modes;
- independent frequency, radius/decay and gain per mode;
- stable coefficient calculation at all supported sample rates;
- resettable filter state;
- smooth or bounded response to parameter changes;
- no allocation or resizing during processing.

Use a structure-of-arrays layout if it proves clearer or faster:

```js
frequencies[MAX_MODES]
radii[MAX_MODES]
gains[MAX_MODES]
y1[MAX_MODES]
y2[MAX_MODES]
```

The maraca may begin with Cook's dominant body resonance. A second experimental configuration can introduce two or three gourd modes if this produces a materially more convincing object.

The general bank should later support:

- selecting different modes on different collisions;
- per-collision frequency perturbation;
- tuned and inharmonic mode sets;
- mode groups belonging to different materials or objects;
- energy-dependent gain, damping or frequency.

Do not implement all of these in the first pass unless they fall naturally out of a simple bank design.

### 5.6 Output conditioner

The processor should provide minimal protection and conditioning:

- DC blocking if necessary;
- carefully chosen output scaling;
- optional very gentle saturation or limiting only if required for safety;
- denormal avoidance if relevant in the browser implementation.

Do not use aggressive dynamics processing to hide unstable or poorly scaled synthesis. Internal levels and parameter ranges should first be made well behaved.

---

## 6. Maraca Public API

The initial public API should be small. Internal physical parameters and public performance controls are not the same thing.

Suggested first-pass parameters:

| Parameter | Meaning | Initial form |
| --- | --- | --- |
| `shakeEnergy` | Continuous energy supplied by the performer | `AudioParam`, normalized 0–1 |
| `systemDecay` | Persistence of mechanical motion | k-rate parameter; preferably mapped to meaningful decay behavior |
| `numberOfObjects` | Effective number of beans/particles | k-rate parameter, quantized or treated continuously internally |
| `resonanceFrequency` | Primary gourd/body resonance | k-rate `AudioParam` in Hz |
| `brightness` | Optional collision hardness/noise coloration | Defer unless clearly useful in first audition |
| `seed` | Deterministic random seed | Discrete message/configuration value |

Public event:

```js
maraca.shake(amount = 1);
```

or, if Claudio's event API is used:

```js
maraca.event("shake", { amount: 1 });
```

The exact public syntax should follow the closest current Claudio reference model. Semantically, a shake adds an energy impulse at the earliest deterministic audio-render boundary.

Do not expose all STK control numbers or every internal coefficient as top-level parameters. Advanced object configuration can remain in an internal preset/configuration structure until experience shows which controls are musically useful.

### 6.1 Continuous versus discrete shake input

Both are valuable:

- `shakeEnergy` supports continuous gestures, automation and audio/control-rate connections;
- `shake()` supports button presses, score events and discrete gesture detection.

They should feed the same internal energy state rather than behave as two unrelated synthesis mechanisms.

### 6.2 Play and stop semantics

Proposed behavior:

- `play()` activates processing and allows energy input;
- the model initially contains zero stored energy unless configured otherwise;
- `shake()` while playing injects energy;
- `stop()` prevents new public actions and follows normal BaseSound release behavior;
- replay resets stale state unless an explicit continuation mode is later justified;
- processor reset/reseed behavior must be deterministic and tested.

Whether `play()` itself should inject a default shake is a product/API decision. For a playable demo it may be convenient, but it should not be inseparably built into the processor.

---

## 7. Parameter and Message Transport

Follow the existing Claudio worklet boundary:

### Use `AudioParam`s for

- continuously varying `shakeEnergy`;
- parameters that may be automated or driven by another worklet;
- resonance frequency if continuous sweeps are desired;
- any later continuous gesture coordinate.

`shakeEnergy` should be a-rate if sample-level modulation or direct control-signal connections are expected. Parameters that do not need sample-level variation should be k-rate.

### Use `port.postMessage()` for

- reset;
- reseed;
- discrete shake impulse;
- debug enable/disable;
- configuration selection or replacement, if supported;
- state changes that occur infrequently.

A later scheduled form may include `audioTime`:

```js
{
  type: "shake",
  amount: 0.8,
  audioTime: 123.456
}
```

The processor can then apply the impulse at the correct sample offset within a render quantum. For the first pass, Claudio's established "now means earliest deterministic internal execution point" semantics are acceptable, but message handling should not make scheduled actions difficult to add.

No collision messages should be sent during normal synthesis.

An optional debug mode may report block-level summaries such as collision count, peak internal energy and peak output. It should not post every collision.

---

## 8. Configuration and Presets

Separate model configuration from performance parameters.

A provisional internal configuration might resemble:

```js
const MARACA_CONFIG = {
  interactionType: "stochasticCollision",
  excitationType: "noiseBurst",

  defaultObjectCount: 64,
  energyDecaySeconds: 0.35,
  collisionDecaySeconds: 0.004,
  collisionRateScale: 1.0,
  collisionGain: 1.0,

  modes: [
    {
      frequencyHz: 3200,
      decaySeconds: 0.02,
      gain: 1.0
    }
  ],

  outputGain: 0.2
};
```

The names and numbers above are placeholders, not approved constants.

Configuration should be validated outside the per-sample loop. The processor should convert friendly units into efficient coefficients during initialization or parameter change.

Avoid string-based strategy dispatch inside the sample loop. Select the DSP path during construction/configuration so that the inner loop uses direct predictable operations.

For the first pass, it is acceptable for the processor to support only the maraca path while arranging source modules along plausible reusable boundaries. General configuration loading should not delay an audible prototype.

---

## 9. Proposed Source Organization

The final placement should follow the current Claudio repository's conventions after inspecting `BaseSound` and the closest worklet-based models. A likely organization is:

```text
soundModels/
  Shakers/
    Maraca.js
    configs/
      maracaConfig.js
    processors/
      phisemProcessor.js
      dsp/
        SeededRandom.js
        EnergyAccumulator.js
        StochasticCollisionGenerator.js
        NoiseBurstExciter.js
        ResonatorBank.js
        OutputConditioner.js
```

If the repository convention favors colocating processor utilities differently, follow the convention rather than this illustrative tree.

The public export should expose `Maraca`, not the internal DSP utilities. Internal modules can be exported separately for tests if needed.

---

## 10. Real-Time and Efficiency Requirements

The implementation must:

- generate audio entirely from `process()` and the audio clock;
- use the actual output buffer length rather than assuming 128 samples;
- avoid timers for synthesis state;
- avoid allocations in the sample loop;
- avoid per-collision objects, arrays, closures or messages;
- avoid resizing modal arrays during processing;
- precompute filter coefficients until relevant parameters change;
- avoid recomputing expensive mappings per sample when k-rate updates suffice;
- bound all loops by known capacities;
- remain stable at supported browser sample rates;
- return a well-defined lifecycle value from `process()` consistent with Claudio's worklet practice.

The first version should favor readable, measurable DSP over speculative micro-optimization. Performance measurements should guide later inlining or data-layout changes.

---

## 11. First-Pass Implementation Sequence

### Phase A: repository integration study

Before writing synthesis code, the implementing agent should inspect:

- `BaseSound`;
- the nearest audio-generating AudioWorklet SoundModel, if one exists;
- the nearest event-generating worklet wrapper;
- established parameter registration methods;
- `play()`, `stop()`, release and replay conventions;
- worklet loading/readiness conventions;
- model export and demo registration conventions.

The agent should identify which parts of this document are architectural intent and which exact APIs must be adapted to the repository.

### Phase B: minimal DSP prototype

Implement, in the worklet:

1. seeded random generation;
2. energy accumulation and decay;
3. stochastic collision decisions;
4. accumulated noise-burst excitation;
5. one stable body resonator;
6. conservative output scaling;
7. reset and shake messages.

Create the smallest Claudio wrapper that can play, stop, replay and invoke `shake()`.

### Phase C: baseline validation

Validate:

- silence before energy is supplied;
- visible/audible decay after one shake;
- greater object count increases collision density;
- system decay changes gesture persistence;
- resonance frequency changes the perceived body;
- identical seed and identical actions produce identical output;
- stop/replay does not retain unintended stale energy;
- no NaN, infinity or unstable resonator state occurs;
- CPU remains low with several simultaneous instances.

### Phase D: Cook/STK comparison

Compare the implementation with Cook's published model and STK `Shakers` implementation.

The purpose is to:

- find mistaken interpretations;
- obtain sensible baseline constants;
- compare event-density and decay behavior;
- identify perceptually important details omitted from the minimal version.

Do not automatically copy every historical implementation detail. Record each consequential difference and whether it is intentional.

### Phase E: perceptual refinement

Audition and experiment with:

- collision probability versus energy;
- event amplitude versus energy;
- object-count scaling;
- resonance count and frequencies;
- excitation brightness;
- collision decay;
- output normalization across parameter ranges.

Prefer meaningful, controllable behavior over matching a single recorded sample.

### Phase F: first generalization test

Implement cabasa or sekere mainly through configuration changes. This tests whether the decomposition supports a close relative without redesign.

### Phase G: structural generalization test

Implement bamboo chimes. This should test:

- multiple modes;
- selection of resonances per collision;
- collision-dependent frequency variation;
- whether the event generator and resonator bank interfaces are genuinely separable.

Only after these tests should the architecture be declared stable.

---

## 12. Testing Strategy

### 12.1 Unit tests for DSP components

- Seeded RNG produces a repeatable sequence.
- Energy decay is sample-rate independent within tolerance.
- Energy injection occurs on the intended sample.
- Collision counts converge statistically toward the configured expectation.
- Resonator impulse responses have the expected frequency and decay.
- Reset clears every internal state variable.

### 12.2 Deterministic rendered tests

Use an offline or otherwise deterministic render path where practical:

- render a fixed shake sequence with a fixed seed;
- save numeric reference metrics or a short reference buffer;
- compare future renders within explicit tolerances;
- avoid relying only on exact binary output if browser arithmetic differences make that brittle.

Useful metrics include:

- total collision count;
- RMS envelope over time;
- decay time;
- spectral peak positions;
- peak amplitude;
- absence of non-finite samples.

### 12.3 Claudio lifecycle tests

- construct and become ready;
- play without an automatic sound unless specified;
- shake while playing;
- stop during active decay;
- replay;
- change parameters during performance;
- create several independent instances;
- dispose/release without leaks;
- load through the normal model index and demo/server path.

### 12.4 Performance tests

Measure rather than assume:

- CPU for 1, 8 and 32 active maracas;
- cost at low and high object count;
- cost with one and several resonant modes;
- message rate during normal use;
- garbage generation during sustained rendering.

Object count must not accidentally become the number of particles explicitly simulated. The statistical model should keep computational cost nearly independent of the imagined particle count.

---

## 13. Debugging and Observability

Because the important processes live inside a worklet, limited observability will help development.

An optional debug message, disabled by default, may periodically report:

```js
{
  type: "debug-summary",
  audioTime,
  collisionCount,
  energy,
  excitationPeak,
  outputPeak
}
```

Requirements:

- summaries should be rate-limited;
- no per-collision main-thread logging;
- no console output in the sample loop;
- debug behavior must not change the random sequence or synthesis result;
- diagnostic code should be easy to disable for production.

It may also be useful to support a deterministic test mode that substitutes a known event schedule for the collision generator. That would allow the exciter and resonator bank to be tested independently.

---

## 14. Anticipated Instrument Families

The long-term architecture should accommodate several related but not identical interaction types.

| Family | Reused components | Main variation |
| --- | --- | --- |
| Maraca, cabasa, sekere | Energy, stochastic collisions, noise burst, body modes | Density, damping, particle and body properties |
| Tambourine, sleigh bells | Energy and stochastic collisions | Multiple inharmonic metal resonances and harder excitation |
| Bamboo chimes | Energy and stochastic collisions | Per-event resonator selection and frequency variation |
| Coins or ice in a mug | Collision engine and modal bank | Several interacting material/body mode groups |
| Water drops | Stochastic event timing and modal filtering | Independent voices, pitch distribution and frequency glide |
| Gravel, snow, crunching | Energy and event clouds | Nonstationary distributions and multiple micro-event classes |
| Guiro, rubbing, scraping | Gesture state and resonators | Spatial/phase-driven contacts or continuous friction excitation |

The broad reusable concept is therefore not merely "a shaker." It is:

> Gesture-driven interaction processes that generate micro-events or friction signals which excite configurable resonant objects.

This description is a direction, not yet a class hierarchy.

---

## 15. Likely Future Generator Strategies

The following are hypotheses to guide design, not first-pass implementation requirements.

### `StochasticCollisionGenerator`

For independently colliding objects. Generates probabilistic impulses or bursts based on energy and effective object count.

### `ScrapeEventGenerator`

For a gesture traversing teeth or surface irregularities. Likely driven by a worklet-local phase/spatial coordinate, conceptually related to Claudio's phasor work.

### `EventCloudGenerator`

For a finite action such as crunching or breaking. Generates a nonstationary cloud whose rate, amplitude and spectral distributions evolve over time.

### `FrictionExciter`

For rubbing and continuous contact. Produces persistent stochastic excitation whose statistics depend on velocity, force and surface properties.

### `ModalVoicePool`

For water drops or other events requiring independent resonant trajectories. Uses a fixed preallocated voice pool with deterministic voice allocation; never constructs voices in the sample loop.

---

## 16. Decisions Intentionally Deferred

The first-pass agent should not silently settle these questions:

- whether one processor class will ultimately serve every interaction family;
- whether configurations can be changed after construction;
- whether presets are public Claudio concepts or internal implementation data;
- the final parameter names, ranges and default values;
- whether `play()` automatically injects energy;
- whether the maraca uses one or several body modes by default;
- how continuous external control worklets will connect to the synthesis processor;
- whether an audio input should be accepted as mechanical drive;
- whether a-rate parameter arrays are worth their cost for every parameter;
- whether output normalization should compensate for object count and mode count;
- licensing implications of directly adapting specific STK source code rather than independently implementing the published method.

These should be recorded in implementation notes and decided from experiments and Claudio conventions.

---

## 17. Guidance for the Implementing Agent

The agent should:

1. Read this document completely before editing the repository.
2. Inspect current Claudio source files rather than inventing APIs from this pseudocode.
3. Identify the nearest canonical SoundModel and worklet examples.
4. Preserve established BaseSound lifecycle, naming and export conventions.
5. Keep all collision-level activity inside the audio-generating worklet.
6. Begin with the smallest audible maraca architecture.
7. Avoid premature generic factories or unrestricted configuration systems.
8. Keep DSP components separable enough to test and reuse.
9. Avoid allocations and messaging in audio-rate/collision-rate paths.
10. Make randomness seeded and resets deterministic.
11. Add focused tests before perceptual refinements obscure basic behavior.
12. Record deviations from Cook/STK and the reason for each.
13. Expose only a small, coherent public parameter set.
14. Report architectural pressure encountered during implementation rather than hiding it with special cases.

The agent should produce, at minimum:

- the `Maraca` SoundModel wrapper;
- its AudioWorkletProcessor;
- the necessary first-pass DSP utilities;
- model export/registration changes;
- a minimal playable test/demo;
- deterministic DSP tests where the repository supports them;
- an implementation note listing constants, open questions and deliberate departures from this plan.

---

## 18. First-Pass Acceptance Criteria

The first pass is successful when:

- `Maraca` behaves as a normal Claudio SoundModel;
- it directly generates audio in its worklet;
- a discrete shake produces a convincing decaying maraca-like sound;
- continuous energy input can sustain or repeatedly excite the model;
- object count, system decay and resonance controls have clear audible effects;
- collision timing and synthesis remain entirely on the audio thread;
- seeded renders are repeatable;
- stop/replay/reset behavior is correct;
- processing performs no per-collision messaging or allocation;
- several simultaneous instances run comfortably;
- the source organization exposes plausible reusable DSP boundaries;
- the implementation remains simple enough to revise after cabasa and bamboo-chime experiments.

Success does not require the first maraca to establish the final architecture for water, friction, scraping and crunching sounds.

---

## 19. References

- Perry R. Cook, "Physically Informed Sonic Modeling (PhISM): Percussive Synthesis," Proceedings of the International Computer Music Conference, 1996.  
  https://quod.lib.umich.edu/i/icmc/bbp2372.1996.071

- Perry R. Cook, "Physically Informed Sonic Modeling (PhISM): Synthesis of Percussive Sounds," *Computer Music Journal*, 21(3), 38–49, 1997.  
  https://www.jstor.org/stable/3681012

- Perry R. Cook, "Physically Informed Stochastic Modal Sound Synthesis," *Journal of the Acoustical Society of America*, 109(5), 2001. DOI: 10.1121/1.4744586.  
  https://doi.org/10.1121/1.4744586

- Perry R. Cook, *Real Sound Synthesis for Interactive Applications*, A K Peters, 2002.  
  https://www.routledge.com/Real-Sound-Synthesis-for-Interactive-Applications/Cook/p/book/9781568811680

- The Synthesis ToolKit in C++ (STK), `Shakers` class.  
  https://github.com/thestk/stk/blob/master/src/Shakers.cpp  
  https://github.com/thestk/stk/blob/master/include/Shakers.h  
  https://ccrma.stanford.edu/software/stk/classstk_1_1Shakers.html

- Perry Cook's Shaker Controllers / PhISEM project page.  
  https://soundlab.cs.princeton.edu/research/controllers/shakers/

- Csound `STKShakers` documentation and example.  
  https://csound.com/docs/manual/STKShakers.html

---

## 20. Recommended Immediate Next Step

Give this document to the implementing agent together with access to the current Claudio repository. Ask it first to perform Phase A and return a short repository-specific implementation plan identifying:

- exact files to add or change;
- the BaseSound/worklet model it will use as the integration reference;
- proposed first-pass public parameter names and ranges;
- any conflict between this document and current repository conventions;
- the smallest milestone that produces an audible seeded maraca.

Review that plan before asking it to implement Phase B. This creates a useful checkpoint between general architecture and repository-specific code.
