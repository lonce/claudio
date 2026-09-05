# NoiseControlProcessor for Claudio

## Implementation specification and handoff notes

### Purpose

Implement a reusable Web Audio control process that generates smooth, seeded Simplex noise on the audio rendering thread and supports two complementary uses:

1. **Signal output**: provide a continuous control signal that can modulate an `AudioParam` without sending every control sample through the main thread.
2. **Event output**: detect threshold crossings in the worklet and send occasional notifications to the main thread, where a Claudio meta-model can trigger child SoundModels.

These should preferably be simultaneous capabilities, not mutually exclusive processor modes. A consumer may use either output or both.

The motivating first application is a meta-model that triggers an already-implemented child SoundModel whenever the Simplex process crosses a threshold. The processor should nevertheless remain general-purpose and contain no knowledge of that child model, Claudio chords, or the meta-model's musical behavior.

---

## Proposed organization

```text
worklets/
    noiseControlProcessor.js

utilities/
    SimplexNoise.js              # only if the implementation is reusable outside the worklet

soundModels/
    <NewMetaModel>/
        <NewMetaModel>.js
```

The processor is general-purpose and belongs under `worklets/`. The meta-model owns the Claudio-facing parameter and event semantics.

If a Simplex implementation is embedded directly in the worklet file to avoid worklet import or bundling complications, keep it as a separate class within that file rather than mixing it into the processor logic.

---

## Architectural boundary

```text
Audio rendering thread                          Main/UI thread
----------------------                          --------------
seeded Simplex process
        |
        +--> continuous output signal ----------> AudioParam (no postMessage)
        |
        +--> threshold detector
                    |
                    +--- occasional postMessage -> meta-model triggers child
```

The worklet is responsible for:

- Deterministic noise generation
- Audio-clock-based advancement
- Continuous signal output
- Threshold-crossing detection
- Crossing direction filtering
- Event-rate limiting
- Capturing the crossing's audio time and values

The main-thread wrapper or meta-model is responsible for:

- Claudio parameters and validation
- Loading the worklet module
- Creating and configuring the `AudioWorkletNode`
- Receiving event messages
- Triggering the child SoundModel
- Rejecting stale notifications during or after `stop()`
- Child voice allocation, release, and lifecycle
- Optional timing analytics

The processor must not instantiate, import, or directly control Claudio SoundModels.

---

## Timing model

Do not use `setInterval`, `setTimeout`, `requestAnimationFrame`, or main-thread callbacks to advance the Simplex process.

Advance it from the Web Audio rendering clock inside `process()`. Do not hard-code `128` as the block length: use the actual output array length. Current browsers normally use 128-frame render quanta, but the code should not depend on that remaining universally true.

For an initial **k-rate control process**, calculate one new noise value per render quantum and fill the entire output block with that value. Conceptually:

```js
const channel = outputs[0][0];
const value = this._nextControlValue(channel.length);
channel.fill(value);
```

Advance the noise's time coordinate by the actual block duration:

```js
const blockDuration = channel.length / sampleRate;
this.noiseTime += this.rate * blockDuration;
```

Here, `rate` is the speed with which the path moves through Simplex-noise space. Its units must be documented clearly. A useful convention is **noise-coordinate units per second**. It should not be described as an oscillation frequency because Simplex noise is aperiodic.

If the Python source model defines `rate` differently, preserve its audible semantics and document the mapping.

### Initial value

Initialize `previousValue` from the seeded noise process before crossing detection begins. Do not treat startup as an artificial crossing. Crossing detection should be disabled until both a valid previous value and current value exist.

### Pausing and resetting

Define these operations separately:

- `enabled = false`: stop advancing the process and stop emitting events; output a documented resting value, preferably zero.
- `enabled = true`: resume according to the chosen lifecycle semantics.
- `reset`: reinitialize the seeded generator, noise coordinate, previous value, rate limiter, and event sequence number.
- `seed` change: normally equivalent to reset with the new seed.

The Claudio meta-model should decide whether `play()` resumes or resets. For a predictable SoundModel, a new `play()` will often reset the noise process; do not make that irreversible inside the processor API.

---

## Simplex noise requirements

### Deterministic seeding

The same combination of:

- seed
- initial coordinate
- rate trajectory
- processor messages
- sample rate/render progression

should reproduce the same control sequence.

Do not use `Math.random()` after initialization unless it is driven by an explicitly seeded pseudo-random-number generator. A numeric 32-bit seed is the simplest public representation. If the external API permits a string seed, hash it deterministically to 32 bits on the main thread or in the processor.

Suggested seed normalization:

```js
seed = Number(seed) >>> 0;
```

Seed `0` must be valid and must not silently mean “choose a random seed.” If nondeterministic seeding is desired, expose it as a separate explicit operation.

### Dimensionality

One-dimensional traversal is sufficient even if the chosen Simplex implementation is 2D:

```js
raw = simplex.noise2D(noiseTime, fixedY);
```

Derive `fixedY` deterministically from the seed, or use a documented constant. A seed-specific fixed second coordinate helps seeds select genuinely different paths.

### Output range

Normalize or clamp the raw noise to a documented nominal range, preferably `[-1, 1]`. Avoid assuming that every third-party Simplex implementation has perfectly bounded output.

Apply output mapping after obtaining the normalized value:

```js
signal = offset + amplitude * raw;
```

Suggested meanings:

- `amplitude >= 0`
- `offset`: center value
- `raw`: normalized Simplex value in approximately `[-1, 1]`
- `signal`: the actual worklet output and the value used for threshold comparison

Using the mapped signal for threshold detection makes thresholds intelligible in the same units as the output. If compatibility with the Python model requires thresholds in normalized-noise units, make that explicit and report both raw and mapped values in event messages.

---

## Public processor controls

The main-thread wrapper should expose Claudio-friendly parameters, while the worklet receives a compact command protocol. The minimum useful controls are:

| Control | Suggested default | Meaning |
|---|---:|---|
| `seed` | `1` | Deterministic 32-bit seed |
| `rate` | model-specific | Noise-coordinate units traversed per second |
| `amplitude` | `1` | Output deviation around `offset` |
| `offset` | `0` | Output center |
| `threshold` | `0` | Crossing level in mapped output units |
| `crossing_direction` | `both` | `rising`, `falling`, or `both` |
| `minimum_event_interval` | `0` or musical default | Minimum seconds between accepted notifications |
| `enabled` | `false` until play | Whether the process advances and generates crossings |

Possible later controls, not required for the first implementation:

- `hysteresis`
- Multiple thresholds
- Independent output and detector mappings
- Audio-rate rather than k-rate noise
- Smoothing after noise generation
- Position/bias in multidimensional noise space

Do not add these prematurely unless the Python model already requires them.

### AudioParams versus port messages

Use `AudioParamDescriptor`s for controls that may need automation or audio-thread-safe continuous change, especially:

- `rate`
- `amplitude`
- `offset`
- possibly `threshold`

Declare them with `automationRate: 'k-rate'` unless audio-rate automation is specifically useful.

Use `port.postMessage()` commands for discrete state changes:

- seed/reset
- enabled state
- crossing direction
- minimum event interval
- analytics reset

If simplicity or consistency with Claudio's existing worklets favors messages for everything, that is acceptable for v1, but parameter changes then take effect when the message reaches the audio thread rather than at an exact scheduled audio time.

---

## Signal capability

The processor should always provide one mono output channel when instantiated with signal output enabled.

For k-rate operation, fill every sample in a render quantum with the same mapped value. Do not post this value to the main thread every quantum.

The output can then be routed to an `AudioParam`:

```js
noiseNode.connect(targetAudioParam);
```

Remember that an AudioNode connected to an `AudioParam` contributes **additively** to the AudioParam's intrinsic value. The wrapper must establish the correct base value, modulation depth, and offset. Depending on the target, this may require a `GainNode`, a `ConstantSourceNode`, or doing the scale/offset mapping inside `NoiseControlProcessor`.

Do not assume every Claudio parameter is backed by an `AudioParam`. A JavaScript-only `setParameter()` cannot receive a true k-rate stream without main-thread messages. For such parameters, use threshold events, a slower telemetry/update rate, or refactor the target SoundModel to accept a control-signal input.

### Output when unused

The event-only use case should not require connecting the signal output. An unconnected output is fine. The processor should still run as long as the `AudioWorkletNode` remains active according to browser/Web Audio lifecycle rules. If the browser suspends an entirely disconnected graph, connect through a zero-gain keepalive path only if testing proves it necessary; do not add that workaround speculatively.

---

## Crossing detection

Crossings are detected between consecutive k-rate values, not by equality with the threshold.

Recommended definitions:

```js
const rising  = previousValue <  threshold && currentValue >= threshold;
const falling = previousValue >  threshold && currentValue <= threshold;
```

These asymmetric comparisons avoid repeatedly firing when a value lands exactly on the threshold for adjacent blocks.

If tests reveal duplicate events caused by threshold plateaus, maintain a side state (`below`, `above`, or `at`) and require a genuine side change. Do not test with `currentValue === threshold` alone.

### Direction filter

- `rising`: notify only on a below-to-above transition
- `falling`: notify only on an above-to-below transition
- `both`: notify on either transition

The message should identify the actual direction even when configured for `both`.

### Rate limiting

`minimum_event_interval` is measured in audio-clock seconds. Track the last **accepted** event time, not the last candidate crossing time.

```js
if (crossing && crossingTime - lastEventTime >= minimumEventInterval) {
    emitEvent();
    lastEventTime = crossingTime;
}
```

A suppressed crossing must not shift the rate-limit window.

Rate limiting is a safety and musical-density control; it does not alter the noise process or continuous output.

### Crossing-time estimate

At minimum, report the block time at which the crossing was detected. Preferably estimate the crossing within the interval between the two k-rate samples by linear interpolation:

```js
const fraction = (threshold - previousValue) /
                 (currentValue - previousValue);
const crossingTime = previousSampleTime +
                     fraction * (currentSampleTime - previousSampleTime);
```

Clamp `fraction` to `[0, 1]` and guard against a zero denominator.

This timestamp improves analytics and enables a future look-ahead scheduler, but it does **not** make a main-thread-triggered child onset sample-accurate. By the time the message is received, the crossing time will usually be in the past.

### Optional hysteresis

Do not implement hysteresis unless needed, but design the detector so it can be added cleanly. With hysteresis `h`, a rising detector rearms below `threshold - h`, and a falling detector rearms above `threshold + h`. This prevents chattering when rough or faster noise hovers close to the threshold.

---

## Event message protocol

Suggested worklet-to-main-thread notification:

```js
{
    type: 'threshold-crossing',
    sequence: 42,
    direction: 'rising',
    threshold: 0,
    previousValue: -0.013,
    currentValue: 0.006,
    rawValue: 0.006,          // optional if mapped and raw values differ
    audioTime: 12.4387,
    detectedAtAudioTime: 12.4427
}
```

Meanings:

- `audioTime`: estimated time of the crossing
- `detectedAtAudioTime`: audio-render time when detection occurred
- `sequence`: monotonically increasing event number since reset

Do not use `performance.now()` inside the processor as the musical reference. The audio timeline should be authoritative.

Suggested main-thread-to-worklet commands:

```js
{ type: 'set-enabled', enabled: true }
{ type: 'set-seed', seed: 1234, reset: true }
{ type: 'set-direction', direction: 'both' }
{ type: 'set-minimum-event-interval', seconds: 0.08 }
{ type: 'reset', initialCoordinate: 0 }
{ type: 'reset-analytics' }
```

Validate every incoming command. Ignore or explicitly report malformed commands; do not allow `NaN`, infinities, negative rate limits, or unknown direction values into processor state.

Avoid posting a message every render quantum. If UI visualization is later desired, add separately throttled telemetry—perhaps 20–30 messages per second—and keep it independent of crossing events.

---

## Processor lifecycle and stale-event protection

The main-thread meta-model should use an `acceptingNoiseEvents` flag analogous to the existing `TransitionPinger`/Rendezvous lifecycle protection.

On `play()`:

1. Establish parameter values.
2. Reset or resume the noise process according to the model's documented semantics.
3. Set `acceptingNoiseEvents = true`.
4. Enable the processor.

On `stop()`:

1. Set `acceptingNoiseEvents = false` immediately.
2. Tell the processor to disable itself.
3. Ignore notifications already in flight.
4. Allow already-triggered child models to decay naturally.
5. Invoke the parent release callback only after all children have drained, if this meta-model follows Claudio's existing nested-release pattern.

The message handler must check both the flag and the parent's appropriate playing/release state before triggering a child.

---

## Suggested AudioWorkletProcessor skeleton

This is structural pseudocode, not drop-in code; adapt it to Claudio and the selected Simplex implementation.

```js
class NoiseControlProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'rate', defaultValue: 0.2, minValue: 0, automationRate: 'k-rate' },
            { name: 'amplitude', defaultValue: 1, minValue: 0, automationRate: 'k-rate' },
            { name: 'offset', defaultValue: 0, automationRate: 'k-rate' },
            { name: 'threshold', defaultValue: 0, automationRate: 'k-rate' }
        ];
    }

    constructor(options) {
        super();
        // Normalize processorOptions.
        // Create seeded generator.
        // Initialize coordinate and detector state without emitting a crossing.
        // Install validated message-command handler.
    }

    process(inputs, outputs, parameters) {
        const channel = outputs[0]?.[0];
        const frames = channel?.length ?? 128; // fallback only; do not rely on 128
        const blockDuration = frames / sampleRate;

        if (!this.enabled) {
            if (channel) channel.fill(0);
            return true;
        }

        const rate = parameters.rate[0];
        const amplitude = parameters.amplitude[0];
        const offset = parameters.offset[0];
        const threshold = parameters.threshold[0];

        const previousTime = this.controlSampleTime;
        const previousValue = this.currentValue;

        this.noiseCoordinate += rate * blockDuration;
        const rawValue = this.simplexValue(this.noiseCoordinate);
        const currentValue = offset + amplitude * rawValue;
        const currentSampleTime = currentTime;

        if (channel) channel.fill(currentValue);

        this.detectAndPossiblyEmit({
            previousValue,
            currentValue,
            previousTime,
            currentSampleTime,
            threshold,
            rawValue
        });

        this.currentValue = currentValue;
        this.controlSampleTime = currentSampleTime;
        return true;
    }
}

registerProcessor('noise-control-processor', NoiseControlProcessor);
```

The agent should verify the exact relationship between `currentTime` and the block being rendered. If `currentTime` represents the beginning of the current render quantum, record sample times consistently so interpolation does not label the current value as occurring one block too early or late.

---

## Main-thread wrapper responsibilities

Although the requested component is the processor, it will be easier to use correctly if paired with a thin node/controller wrapper. Suggested responsibilities:

- A static `WORKLET_PATH` resolved with `new URL(..., import.meta.url).href`
- Idempotent worklet loading per `AudioContext`
- Creation of the `AudioWorkletNode`
- Claudio parameter-to-`AudioParam` or message routing
- Validated crossing callback registration
- Start/reset/stop commands
- Timing and suppression analytics
- Disposal of message handlers and node connections

Do not place child-triggering behavior in the general wrapper. The meta-model subscribes to crossing notifications and triggers the child.

Suggested callback payload on the main thread:

```js
onCrossing({
    direction,
    threshold,
    audioTime,
    receivedAtAudioTime: audioContext.currentTime,
    notificationDelay:
        audioContext.currentTime - audioTime,
    sequence
});
```

Use the receipt time captured at the very beginning of the message handler so analytics do not include the handler's own subsequent work.

---

## Tests and acceptance criteria

### Determinism

- Same seed and controls produce the same first `N` values.
- Different seeds produce measurably different sequences.
- Seed `0` is deterministic and valid.
- Reset reproduces the sequence from its documented initial state.

### Clock advancement

- Noise coordinate advances according to actual block length and sample rate.
- No code assumes a fixed 128-frame block except an explicitly documented defensive fallback.
- Disabling freezes or resets state exactly as documented.

### Signal output

- Every sample in a block has the same value in k-rate mode.
- Values remain within the documented mapped range, subject to amplitude/offset.
- An unconnected signal output does not cause event-mode failure.
- No per-block telemetry messages are emitted by default.

### Crossing correctness

- A known synthetic sequence produces exactly the expected rising crossings.
- The same sequence produces exactly the expected falling crossings.
- `both` produces both, with the correct direction labels.
- Starting above, below, or exactly at the threshold does not generate a false startup event.
- A value that remains exactly on the threshold does not generate repeated events.
- Changing the threshold has documented rearming behavior and no accidental phantom crossing.

For detector unit tests, inject a known sequence rather than depending on unpredictable-looking Simplex output.

### Rate limiting

- Accepted events are separated by at least `minimum_event_interval` on the audio timeline.
- Suppressed candidates do not move `lastEventTime`.
- Setting the interval to zero disables limiting without breaking direction filtering.

### Timing metadata

- Estimated crossing time lies between the two bracketing control-sample times.
- Sequence numbers are monotonic and reset only when documented.
- Main-thread delay is calculated from captured receipt time minus event audio time.

### Lifecycle

- No child is triggered before `play()`.
- No child is triggered after `stop()`, including from a notification already in flight.
- Already-triggered children complete their normal decay.
- Replaying after stop produces the documented reset or resume behavior.

### Stress test

- Run with high noise rate, `both` directions, and no rate limit.
- Confirm that the audio rendering thread remains stable.
- Then set a musically reasonable minimum interval and confirm bounded main-thread event traffic.
- Exercise UI activity and garbage collection pressure; the noise timeline should remain stable even if notification delay varies.

---

## Recommended first implementation scope

Implement now:

- Seeded Simplex process on the audio thread
- K-rate mono signal output
- `rate`, `amplitude`, and `offset`
- One threshold
- `rising`, `falling`, and `both`
- Minimum event interval
- Crossing messages with audio timestamp, direction, and sequence
- Enable, reset, and seed commands
- Stale-notification protection in the meta-model
- Deterministic and detector unit tests
- Browser listening test using the already-created child SoundModel

Defer unless immediately required:

- Multiple thresholds
- Hysteresis
- Audio-rate noise generation
- SharedArrayBuffer transport
- Per-render-quantum UI telemetry
- Sample-accurate child triggering across the main-thread boundary
- Generic modulation of JavaScript-only Claudio parameters

---

## Design principles to preserve

1. **The noise process belongs to the audio clock.** Main-thread delays must not alter its evolution.
2. **Continuous controls stay in the audio graph.** Do not transport k-rate values through hundreds of `postMessage()` calls per second.
3. **Messages represent musically meaningful events.** Threshold crossings are appropriate; raw control samples are not.
4. **Notification timing is intentionally approximate.** The worklet detects accurately, but a child triggered on the main thread inherits message latency and jitter.
5. **The processor remains general-purpose.** Child-model and meta-model behavior stay outside it.
6. **Reproducibility is explicit.** Seed, reset, and lifecycle semantics must be testable and documented.
7. **Signal and event capabilities can coexist.** A continuous output and occasional crossing notifications are two views of the same underlying process.

This design matches Claudio's current division of labor: precise evolving control processes live in AudioWorklets, while event-aware SoundModels on the main thread respond through the existing Claudio lifecycle and accept the small timing slop appropriate to rhythmic triggering.
