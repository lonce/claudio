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
- `TransitionPhasor.js` implements the transition trajectory and crossing
  detection.
- `test/TransitionPhasor.test.js` checks endpoint accuracy and multiple
  crossings per block.

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
