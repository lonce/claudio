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
- `soundModels/Ping.js` is the ordinary three-oscillator child SoundModel.
- `soundModels/TransitionPinger.js` owns a preallocated Ping pool and translates
  main-thread phase notifications into child `play()` and `stop()` calls.
- `worklets/transitionNotifierProcessor.js` advances a phasor on the audio
  clock, generates silence, and reports exact crossing metadata to the parent.
- `pinger_test/index.html` exercises the notification-based architecture and
  displays observed delivery delay and pool statistics.
- `slop_test_2/index.html` runs two independent TransitionPingers toward a
  slider-selected shared frequency and opposite target phases.
- `soundModels/RendezvousPinger.js` packages that two-child behavior as a
  reusable meta SoundModel with one public `rendezvous` event.
- `rendezvous_test/index.html` exposes every musical parameter and the two
  children's notification analytics for an audible integration test.
- `BaseSound.js` and `Parameter.js` are the supplied original framework
  implementations used by the known-good Ping application.

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

## Main-thread notification and Ping test

Open:

<http://localhost:8080/pinger_test/>

`TransitionPinger` keeps its phasor and transition solver in a timing-only
AudioWorklet. Every phase crossing is posted to the main thread with its exact
audio frame and fractional render-quantum offset. The parent then plays an
available ordinary `Ping` model immediately; the notification cannot make that
child begin retroactively at the reported frame.

The parent preallocates its Ping pool and never steals an active or releasing
voice. It requests `stop()` after a short gate and returns the child to the pool
only when Ping's decay-completion callback reports that its oscillator nodes
have been stopped and disconnected. `getTimingStats()` reports received and
dropped occurrences plus the most recent timing metadata.

The public `chord` parameter selects one of four three-note interval sets for
future Pings: major, minor, suspended fourth, or diminished. The pool slot has
no musical identity; whichever free child is selected receives the current
chord immediately before `play()`.

Each new Ping chord receives one random tuning factor within ±0.5%. Applying
the same factor to all three partials preserves its interval ratios while
slightly detuning overlapping Ping instances.

The package now uses the supplied, known-good `BaseSound.js`, `Parameter.js`,
and original `Ping.js` rather than the earlier standalone approximations.
`TransitionPinger.stop()` freezes the phasor but does not fade its master
output; it enters a meta-release state and waits for already-started Pings to
complete their original gates and decays before reporting that the parent has
released.

The test's notification-delay display is captured once when each worklet message reaches
`TransitionPinger`; it no longer grows between events by accidentally measuring
the age of the last notification.

For the onset-versus-offset diagnostic, the Pinger test begins at 0.75 Hz and
transitions to 1.25 Hz. At the initial rate, each onset is separated from the
following Ping's release and from the next onset by enough time to identify the
artifact by ear.

## Two-TransitionPinger slop test

Open:

<http://localhost:8080/slop_test_2/>

The left/major model begins at 1.30 Hz and phase `0.10`; the right/minor model
begins at 2.10 Hz and phase `0.65`. The slider chooses a shared final frequency
from 0.50 to 6.00 Hz. Pressing the rendezvous button snapshots that value and
dispatches separate five-second transitions, targeting phases `0` and `0.5`.

The context is already running when the two `play()` calls occur, and neither
the starts nor transitions share an execution timestamp. The page therefore
tests the same independent-model dispatch path expected from a future score.
Stopping freezes both phasors immediately but keeps the context alive until
both models finish their child-Ping meta-releases.

## RendezvousPinger meta-model

Open:

<http://localhost:8080/rendezvous_test/>

`RendezvousPinger` owns two ordinary `TransitionPinger` children. It exposes:

- `phasor_freq_1` and `phasor_freq_2`: immediate manual frequencies. Changing
  either one also overrides that child's active transition.
- `final_freq`, `target_phase`, and `transition_dur`: staged values sampled
  only when `event('rendezvous')` is called. Child 1 targets phase 0; child 2
  targets the public `target_phase` value.
- `fundamental_1` and `fundamental_2`: lowest chord-note frequencies used by
  future Pings.
- `chord_1` and `chord_2`: integer chord choices 1-4 (major, minor, suspended
  fourth, and diminished).

Calling `play()` always resets both phasors to phase 0 and applies their two
individual frequency parameters before starting them. Calling `stop()` freezes
both phasors, waits for both child TransitionPingers to drain, and therefore
also waits for every active Ping's gate and decay before releasing the outer
model.

Typical use:

```js
await audioContext.audioWorklet.addModule(RendezvousPinger.WORKLET_PATH);
const model = new RendezvousPinger(audioContext, 'rhythmic-rendezvous');
model.connect(audioContext.destination);
model.play();

model.setParameter('final_freq', 2.5);
model.setParameter('target_phase', 0.5);
model.setParameter('transition_dur', 5);
model.event('rendezvous');
```

`getTimingStats()` returns separate statistics for `child1` and `child2`, so
the cross-model notification jitter remains observable rather than concealed.
