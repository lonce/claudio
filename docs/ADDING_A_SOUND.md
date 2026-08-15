# Adding a Sound Model

When asked to create a new sound:

1. Read the user's sonic description carefully.
2. Identify the closest existing model.
3. Inspect that model and BaseSound.js before coding.
4. Implement the synthesis while preserving the existing SoundModel API.
5. Define useful exposed parameters.
6. Use BaseSound attack/decay/release protocols exactly as established.
7. If AudioWorklets or helper resources are required, keep them internal
   to the model and resolve their URLs portably.
8. Export the new model from the appropriate models/index.js.
9. Add the model to the sound-server/demo application in the same manner
   as existing models.
10. Do not modify unrelated models or core APIs.
11. Run whatever tests or server commands are available.
12. Report what was added, what files changed, and anything that requires
    listening evaluation by the user.


## New Model Acceptance Checklist

Verify each item below when the available tools allow it. Do not claim that an
item has been tested if it has only been inferred from code inspection; report
such items as requiring user verification.

A new sound model is not complete until:

- it loads without console errors
- it can play
- it can stop
- release/decay completes correctly
- it can be played again after stopping
- changing gain during attack does not click
- changing gain during decay does not disrupt release
- exposed parameters update while playing
- outputNode is connected correctly
- repeated play/stop cycles do not leak source nodes
- any worklet/helper/resource paths work when served
- the model is exported through the library's existing export mechanism
- the model is imported and instantiated by `app/main.js`
- the model appears in the demo application's sound selector
- existing sounds and application behavior remain unchanged
- anything requiring subjective listening evaluation is reported to the user


## Adding Sound Models to the Web App

The `app/` folder contains the web application used for deploying and
experimenting with the sound models. It is served by `claudioserver.js`.

When creating a new sound model, making the model available through this
application is part of the task unless explicitly stated otherwise.

After implementing the model:

1. Export the new sound model through the existing sound-model export/index
   mechanism, following the pattern of the existing models.

2. Import the new model into `app/main.js` using the same import mechanism
   used by the existing models.

3. In `initApp()`, instantiate the model through:

       audioSystem.createSound(...)

   Follow the existing `createSound()` calls exactly with respect to argument
   order and semantics.

   Do not instantiate a SoundModel directly with `new`.

4. Supply any model-specific initialization arguments required by the model
   through the additional arguments to `createSound()`.

5. Add the resulting sound instance to the existing `sounds` array so that
   it automatically becomes available through the application's sound
   selector.

6. If the application contains model-specific default parameter settings or
   other model registration/configuration, add the minimum necessary entry
   for the new model by following the existing pattern.

IMPORTANT:

- Do not refactor `app/main.js` while adding a sound.
- Do not change existing sounds, their initialization arguments, parameter
  defaults, or their ordering unless explicitly requested.
- Do not change the application's UI or sound-selection mechanism merely to
  accommodate a new model.
- Make only the additions necessary to expose the new model through the
  existing application.

Before modifying `app/main.js`, inspect its current implementation. Treat the
current file as authoritative rather than relying on examples in CLAUDE.md.

## Web Server

`claudioserver.js` serves the application and sound library.

The server is stable infrastructure and should not normally require changes
when adding a sound model.

DO NOT modify `claudioserver.js` without explicit approval.

If implementing a sound appears to require a server change, explain why the
existing server is insufficient and ask before modifying it.

The server normally runs persistently under PM2. Changes to sound models,
worklets, helper modules, model exports, and `app/main.js` are statically
served and therefore do not require restarting the Node server. The browser
only needs to reload the application.

