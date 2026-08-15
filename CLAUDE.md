# Sound Model Library — Claude Code Instructions

@README.md

## Purpose

This repository is a library of browser-based sound models built on the Web Audio API.

Applications normally create sounds through `AudioSystem`, not by constructing models directly.

Typical use:

    const audioSystem = new AudioSystem();
    
    const drone =
        await audioSystem.createSound(DroneModel, 'Drone', 0);
    
    const granny =
        await audioSystem.createSound(AnotherGranny, 'Granny', 0, 200995);

The third argument to `createSound()` is `maxPoolSize`.

- `0` means return the sound model directly.
- `> 0` means wrap the model in `SoundModelWrapper` and maintain a voice pool.
- Additional arguments are passed to the sound-model constructor.

## Core Architecture

Important core files include:

- `AudioSystem.js`
- `BaseSound.js`
- `Parameter.js`
- `SoundModelWrapper.js`

Sound models live under `models/`.

Before modifying a sound model, inspect `BaseSound.js` and at least one current working model that uses the same kind of synthesis.

`DroneModel.js` is the canonical reference for a simple oscillator-based sound model.

Do not reimplement behavior already supplied by `BaseSound`.

## Sound Model API

Sound models normally extend `BaseSound`:

    export class MySound extends BaseSound {
        constructor(context, name, ...args) {
            super(context, name);
            ...
        }
    }

A model should normally provide:

- `createNodes()` or the equivalent model-specific node setup
- `startSound()`
- `stopSound()`
- `updateParameter(name)`
- Model-specific parameters using `addParameter()`, `addIntegerParameter()`, or `addStringParameter()`

Every model must set:

    this.outputNode = ...

to the `AudioNode` which `AudioSystem` should connect to its master gain.

## Gain / Attack / Decay Protocol

Gain is already defined as a parameter by `BaseSound`.

**Do not add another `gain` parameter in derived models unless explicitly requested.**

Follow the current `DroneModel.js` implementation closely.

Starting a sound should use the `BaseSound` attack machinery rather than implementing an independent envelope.

Stopping a sound should use the `BaseSound` decay/release machinery.

In particular:

- Use the attack/decay scheduling methods provided by `BaseSound`.
- Use `updateGainDuringAttack(...)` when appropriate.
- Respect `inAttackSegment`.
- Respect `inDecaySegment`.
- Do not abruptly stop oscillator/source nodes before the decay completes.
- Gain changes received during decay should be ignored.
- Gain changes during attack should modify the attack target without creating an audio discontinuity.
- Source nodes that cannot be restarted, such as oscillators, must be recreated when playback starts again.

When adapting an old model, preserve its synthesis algorithm but replace its old play/release/envelope machinery with the current `BaseSound` protocol.

## Parameter Updates

Parameters call the model's:

    updateParameter(name)

when changed.

For ordinary continuously adjustable `AudioParam`s, prefer Web Audio scheduling methods rather than directly changing `.value` when doing so could create an audible discontinuity.

Do not change parameter semantics, ranges, defaults, or names unless explicitly requested.

## AudioWorklet Models

Models using an `AudioWorklet` can declare the worklet resource on the model class:

    static WORKLET_PATH =
        new URL('../worklets/exampleProcessor.js', import.meta.url).href;

`AudioSystem.createSound()` detects `SoundClass.WORKLET_PATH` and loads the worklet before constructing the sound.

Use `import.meta.url` so worklet resources resolve relative to the model library whether the library is served locally or from a CDN.

Do not hard-code application-specific paths such as:

    /soundlib/...

The sound model owns knowledge of the resources it requires. `AudioSystem` should remain model-independent.

## File-Based Models

`BaseSound` provides facilities for loading audio resources.

Some models may accept either normal URLs or Freesound sound IDs.

Preserve the existing loading API when modifying those models.

Do not move application-specific resource handling into `AudioSystem` unless it represents functionality genuinely shared by sound models. When making a new sound, most of the code can go in to the new Sound model's class file. Ask  before making any changes to the AudioSystem. 



## Browser / Distribution Assumptions

This is browser-native ES module code using the Web Audio API.

The library is intended to work both:

1. Downloaded and served locally.
2. Imported from URLs/CDNs.

Avoid assumptions about the directory structure of the application using the library.

Internal helper files may use relative module imports within this package.

Resources associated with a model should resolve relative to that model/package when possible, normally using `import.meta.url`.

A sound model may consist internally of several JavaScript files, worklets, or other resources. The application developer should not need to understand this internal structure simply to use the model.

## Public API and Internal Structure

Keep a clear distinction between the public API and implementation files.

Users of the library should normally need to understand only:

- `AudioSystem`
- The sound model classes they want to use
- The public methods and parameters exposed by those models

Helper modules, worklets, parameter implementations, and other internal files should remain implementation details whenever possible.

Index modules may be used to provide convenient public entry points without exposing the internal directory structure.

## Working Style

**VERY IMPORTANT:**

- Make only the changes requested.
- Do not perform unrelated cleanup or architectural changes.
- Do not rename parameters, change defaults, reorder API arguments, or alter behavior merely because another design seems cleaner.
- If you notice an unrelated improvement, report it separately and ask before changing it.
- When converting an older sound model, use a current working model as the reference implementation.
- Preserve working behavior unless the requested change specifically requires modifying it.
- Do not guess about the behavior of `BaseSound`, `AudioSystem`, or another core class when the implementation can be inspected directly.
- When uncertain about an existing protocol, inspect the current working code before making changes.

Before making a substantial change, briefly identify which existing model or core implementation you are using as the reference.

## Building New Sounds

When asked to build a new sound model:

1. Identify the closest existing model.
2. Read that model and `BaseSound.js`.
3. Read `AudioSystem.js` if creation, loading, worklets, pooling, or connections are involved.
4. Preserve the `BaseSound` lifecycle and parameter protocols.
5. Implement the synthesis-specific DSP/node graph in the new model.
6. Add worklets or helper modules only when needed.
7. Ensure associated resources are portable for both local and CDN use.
8. Expose parameters through the existing parameter API.
9. Set `outputNode` appropriately.
10. Do not modify `AudioSystem` merely to accommodate one model unless the model exposes a genuinely new system-level requirement. If it is necessary, ask first. 
11. Do not add any new methods that need to be called from outside the sound other than what is already defined in BaseSound.

## Canonical Reference Models

When implementing or converting sound models, prefer copying established
patterns rather than inventing new ones.

- `models/DroneModel.js`
  - canonical simple oscillator model
  - reference for BaseSound lifecycle
  - reference for gain attack/decay handling
  - reference for real-time parameter updates

- `models/ClickerWorkletSoundModel.js`
  - canonical AudioWorklet-based model
  - reference for WORKLET_PATH and worklet loading

- `models/AnotherGranny.js`
  - reference for models which load external audio resources

## Updating Legacy Sound Models

Some models may originate from older versions of the sound-model system.

When converting one:

1. First understand the synthesis algorithm in the legacy model.
2. Identify its oscillators, buffers, filters, gains, worklets, and other Web Audio nodes.
3. Identify its externally exposed parameters and preserve their intended behavior.
4. Separate synthesis-specific behavior from lifecycle behavior.
5. Replace the old lifecycle with the current `BaseSound` protocol.
6. Use a current working model as the structural reference.
7. Preserve the original sonic behavior as closely as possible.
8. Do not introduce unrelated modernization or cleanup during the conversion.

The objective is generally **translation into the current sound-model protocol**, not redesign.


@docs/ADDING_A_SOUND.md

@docs/WORKLETS_AND_PRESETS.md

@docs/GIT_WORKFLOW.md
