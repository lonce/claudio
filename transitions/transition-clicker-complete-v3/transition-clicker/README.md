# Transition Clicker prototype

This is a non-destructive companion to the original `BaseSound`, clicker model,
processor, and phasor files. No supplied file is overwritten.

## Files

- `BaseSoundWithEvents.js` extends the existing `BaseSound` with a registered,
  immediate Event API.
- `soundModels/TransitionClickerWorkletSoundModel.js` exposes the staged
  parameters `freq`, `phase`, and `transition_dur`, plus the public event
  `transition`.
- `worklets/transitionClickTrainProcessor.js` starts pending transitions on a
  deterministic render-quantum boundary and places clicks at phase-crossing
  sample offsets.
- `utilities/TransitionPhasor.js` implements the transition trajectory and
  crossing detection, retaining the utility-folder organization of the
  original phasor implementation.
- `test/TransitionPhasor.test.js` checks endpoint accuracy and multiple
  crossings per block.
- `demo/index.html` is an audible two-model browser integration test.
- `slop_test/index.html` deliberately exercises unsynchronized UI dispatch to
  two independent worklets.
- `BaseSound.js` is a minimal standalone implementation for the demo. When
  integrating into the full SoundModels project, retain the project's existing
  `BaseSound.js` instead.

The directory layout mirrors the original imports. Place `BaseSoundWithEvents.js`
beside the existing `BaseSound.js`; place the model and processor in the existing
`soundModels/` and `worklets/` directories, or adjust their relative imports.

Before constructing the model, load its worklet module in the same way as the
other worklet-based models:

```js
await audioContext.audioWorklet.addModule(
    TransitionClickerWorkletSoundModel.WORKLET_PATH
);

const clicker = new TransitionClickerWorkletSoundModel(audioContext, 'clicker');
clicker.connect(audioContext.destination);
clicker.play();

clicker.setParameter('freq', 4.7);
clicker.setParameter('phase', 0.63);
clicker.setParameter('transition_dur', 3);
clicker.event('transition');
```

`event('transition')` has immediate public semantics. The processor snapshots
the staged targets carried by that command and starts the trajectory at the
next render boundary on which it processes the command. No score time or public
future timestamp appears in the SoundModel API.

When `transition_dur` is zero, setting `freq` or `phase` applies that one value
at the processor's next render boundary. With any nonzero transition duration,
those parameters remain staged until `event('transition')` is called.

## Transition curve

The nominal frequency path is linear. A smooth correction proportional to
`6u(1-u)` is added so that:

- the starting frequency is unchanged;
- the target frequency is exact;
- the integrated phase reaches the requested target phase exactly; and
- frequency remains non-negative.

Among forward-rotating phase branches, the implementation selects the one that
requires the smallest correction to the nominal linear ramp.

Run the standalone phasor checks with:

```sh
npm test
```

## Audible browser test

Browsers do not allow AudioWorklets to run from a `file://` URL. From this
directory, start a small local HTTP server:

```sh
npm run demo
```

Then open <http://localhost:8080/demo/> and press **Start test**. Both models
begin at 2 Hz on the same audio frame. After four seconds, the bright model
makes a five-second transition from phase `0` to phase `0.5`, producing a
stable offbeat relationship at the end.

Each processor receives its own phase-event list through `processorOptions`.
The lists use different short synthesized click timbres so the two models are
easy to distinguish by ear.

## Independent-model slop test

With the same local server running, open:

<http://localhost:8080/slop_test/>

The test has separate controls to:

1. Start the `AudioContext` and leave it running while both models are silent.
2. Call `play()` sequentially on the two independent models without a shared
   timestamp.
3. Stage a common target frequency of `2.5` Hz, target phases `0` and `0.5`,
   and a five-second duration, then dispatch the two `transition` events
   sequentially.

This test intentionally includes UI dispatch, main-thread method-call, message
port, independent-worklet, and render-quantum timing variation. Unlike the
first demo, it does not suspend the context to establish a common start frame.
