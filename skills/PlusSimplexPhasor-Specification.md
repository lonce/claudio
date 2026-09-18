# Plus Simplex Phasor (PS)

## Purpose

`PlusSimplexPhasor` is a reusable, timing-only event generator for Claudio
SoundModels. It extends the behavior of `TransitionPhasor` with smooth,
deterministic irregularity while retaining:

- strictly forward phase motion;
- ordered phase-positioned events;
- independent base and output phases;
- nonlinear transitions of nominal rate and irregularity weight;
- exact output-phase rendezvous, including when the endpoint weight is nonzero.

SoundModels should use PS as they currently use `TransitionPhasor`: install
events at normalized phases, call `processBlock()`, and translate returned event
occurrences into sound-producing actions.

PS modulates the speed of a forward-moving output phasor.

## Mathematical model

The clean reference clock is `base_phase`:

\[
\frac{d\phi_b}{dt}=r(t),
\]

where `rate`, \(r(t)\), is measured in cycles per second.

The Simplex value is sampled from a deterministic three-octave contour whose
coordinate advances with base-phase progress:

\[
\frac{dx}{dt}=c\,r(t),
\qquad n(t)=N(x(t)).
\]

The default calibration constant is:

\[
c=0.9958919457.
\]

It was measured over 32 seeded paths and 32,000 coordinate units. With the
default octave weights, it produces approximately one positive-going Simplex
zero crossing per base-phase cycle. This is a long-run statistical property,
not a per-cycle guarantee.

The event-driving output phase advances according to:

\[
\boxed{
\frac{d\phi_o}{dt}=r(t)2^{w(t)n(t)}
}
\]

where `weight`, \(w(t)\), is non-negative.

For clamped \(n\in[-1,1]\):

\[
r2^{-w}\leq \frac{d\phi_o}{dt}\leq r2^w.
\]

The exponential is always positive, so output phase cannot reverse even if a
future Simplex implementation permits values outside `[-1,1]`.

`rate` is the logarithmic center of the instantaneous output-rate variation.
PS does not normalize the arithmetic mean of the output rate to `rate`.

## Why traversal follows base phase

The Simplex contour is effectively painted onto the rotating base phasor.
Doubling `rate` doubles both:

- the nominal event-cycle rate;
- the speed at which the irregularity contour is traversed.

Thus the rhythmic character remains comparable when heard in cycles. It does
not remain fixed in wall-clock seconds.

## Noise contour

The default contour matches `noiseControlProcessor.js`:

- seeded 2-D Simplex noise;
- one-dimensional traversal at a seed-derived fixed `y` coordinate;
- three octave frequencies: `1`, `2`, and `4`;
- normalized octave weights: `0.6`, `0.25`, and `0.15`;
- final value clamped to `[-1,1]`.

The seed makes both rendering and future rendezvous planning reproducible.

## State

The unit maintains:

- `baseUnwrappedPhase`: clean phase accumulated from nominal `rate`;
- `outputUnwrappedPhase`: phase accumulated from the PS rate formula;
- `noiseCoordinate`: Simplex traversal position;
- `rate`: current nominal/base rate;
- `weight`: current Simplex influence;
- an ordered phase-event list;
- an optional transition plan.

`getPhase()` is a compatibility alias for `getOutputPhase()`, because output
phase is the phase that crosses events.

## Public constructor

```js
new PlusSimplexPhasor(rate, eventList, phase, options)
```

### Positional arguments

| Argument | Meaning |
|---|---|
| `rate` | Initial base rate in cycles per second; finite and non-negative |
| `eventList` | Objects containing at least a finite normalized `phase` |
| `phase` | Initial phase for both base and output clocks |

### Options

| Option | Default | Meaning |
|---|---:|---|
| `weight` | `0` | Initial PS weight |
| `seed` | `1` | Unsigned seed for deterministic Simplex noise |
| `fixedY` | seed-derived | Fixed second coordinate of the 2-D field |
| `octaveWeights` | `[0.6, 0.25, 0.15]` | Non-negative octave weights; internally normalized |
| `initialNoiseCoordinate` | `0` | Initial traversal coordinate |
| `noiseCoordinateScale` | `0.9958919457` | Coordinate advance per base cycle |
| `planningSteps` | `1024` | Maximum numerical steps in a rendezvous plan |

The default calibration applies specifically to the default octave recipe.
Changing octave weights changes the expected zero-crossing density; callers
that change the recipe should supply a separately calibrated coordinate scale.

## Accessors and immediate setters

```js
phasor.getPhase();          // output phase, wrapped to [0, 1)
phasor.getOutputPhase();
phasor.getBasePhase();
phasor.getRate();           // nominal/base rate
phasor.getWeight();
phasor.getNoiseValue();
phasor.getOutputRate();     // current r * 2 ** (w * n)

phasor.setRate(rate);
phasor.setWeight(weight);
phasor.setPhase(phase);     // aligns base and output phase immediately
phasor.setOutputPhase(phase);
phasor.setBasePhase(phase);
```

As in `TransitionPhasor`, an immediate setter cancels an active transition.
`setPhase()` exists for compatibility and aligns both clocks. The separate
phase setters should be used only when that distinction is intentional.

## Events

```js
phasor.addEvent({ id: 'bell', phase: 0.25, event: 'strike' });
phasor.removeEvent('bell');

const occurrences = phasor.processBlock(frameCount, sampleRate);
```

Each occurrence copies the installed event and adds a fractional
`sampleOffset`. Occurrences are returned in chronological order.

Events are crossed by `output_phase`, never by `base_phase` or by Simplex zero
crossings. Since output phase is strictly monotonic, installed phases retain
their cyclic ordering and cannot spontaneously appear or disappear.

## Rendezvous transition

```js
phasor.beginTransition({
    durationFrames,
    targetRate,
    targetWeight,
    targetPhase,
    sharpness
});
```

During a rendezvous:

1. `rate` moves from its current value to `targetRate`.
2. `weight` moves from its current value to `targetWeight` along the same
   shaped progress curve.
3. Seeded future Simplex values are forecast.
4. A smooth correction is added to the nominal rate trajectory.
5. The correction is zero at both endpoints, preserving the requested initial
   and final rates.
6. The rotation branch nearest the natural PS trajectory that permits strictly
   forward motion is selected.
7. `output_phase` reaches `targetPhase` at the final frame.

The shaped transition progress is:

\[
P(u)=\frac12\left(1+
\frac{\tanh(s(u-1/2))}{\tanh(s/2)}\right),
\]

with the linear limit \(P(u)=u\) when `sharpness` is approximately zero.
`sharpness` is restricted to `[0,6]`, matching `TransitionPhasor`.

The rate-correction basis is:

\[
B(u)=6u(1-u),
\]

which is zero at the endpoints. The planner numerically chooses correction
coefficient \(a\) so that:

\[
\int_{t_0}^{T}
\left(r_{natural}(t)+aB(t)\right)
2^{w(t)n(t)}dt
=D,
\]

where \(D\) is the chosen unwrapped phase advance.

The renderer follows the resulting deterministic numerical plan, and the final
plan node is represented exactly as the selected unwrapped target phase.

### Nonzero weight at rendezvous

`targetWeight` need not be zero. Several PS generators can meet at precise
output phases while still irregular. Afterward:

- different seeds normally make them diverge again;
- identical noise state, seed, rate, and weight allow them to remain together;
- `targetWeight = 0` restores regular output motion at the rendezvous.

## Natural transition without a phase target

```js
phasor.beginNaturalTransition({
    durationFrames,
    targetRate,
    targetWeight,
    sharpness
});
```

This changes rate and weight without phase correction. The endpoint output
phase is whatever naturally results from the PS trajectory.

`targetRate` and `targetWeight` are both required, with no default -- a
transition always states where both are going explicitly, even when one of
them isn't actually changing (pass the current value to hold it steady).
There is no separate `beginRateTransition()` method: unlike `TransitionPhasor`,
where a rate-only transition is a distinct operation, PS has only one "no
phase target" transition, distinguished from `beginTransition()` purely by
the absence of a phase target, not by which of rate/weight it carries.

## Worklet messages

`plusSimplexPhaseEventProcessor.js` follows the supplied
`phaseEventProcessor.js` pattern.

Immediate parameters:

```js
{ type: 'parameter', name: 'freq', value: 2 }
{ type: 'parameter', name: 'weight', value: 1 }
{ type: 'parameter', name: 'phase', value: 0 }
```

Rendezvous:

```js
{
    type: 'event',
    name: 'transition',
    durationSeconds: 5,
    targetRate: 2,
    targetWeight: 1.25,
    targetPhase: 0.5,
    transitionSharpness: 3
}
```

Natural rate/weight transition (no phase target):

```js
{
    type: 'event',
    name: 'transition-natural',
    durationSeconds: 5,
    targetRate: 1.5,
    targetWeight: 0.75,
    transitionSharpness: 3
}
```

Notifications match the existing processor:

```js
{
    type: 'phase-event',
    eventId,
    event,
    phase,
    sampleOffset,
    audioFrame,
    sequence
}
```

## Integration example

```js
const ps = new PlusSimplexPhasor(
    1,
    [
        { id: 'one', phase: 0.00, event: 'bell-1' },
        { id: 'two', phase: 0.20, event: 'bell-2' },
        { id: 'three', phase: 0.40, event: 'bell-3' },
        { id: 'four', phase: 0.60, event: 'bell-4' },
        { id: 'five', phase: 0.80, event: 'bell-5' }
    ],
    0,
    { seed: 31415, weight: 0 }
);

ps.beginTransition({
    durationFrames: 5 * sampleRate,
    targetRate: 1.7,
    targetWeight: 1.25,
    targetPhase: 0,
    sharpness: 3
});
```

The five event phases always retain their order, while the entire pattern
accelerates and decelerates under the Simplex multiplier.

## Planning cost and resolution

Unlike the analytic `TransitionPhasor`, nonzero-weight PS rendezvous requires
numerical forecasting. `planningSteps` bounds that work independently of the
transition duration. The default `1024` is intended as a quality/performance
compromise.

Planning currently occurs on the first `processBlock()` after a transition is
requested. On very strict or high-rate Web Audio configurations, benchmark
this one-time cost. Practical options are:

- reduce `planningSteps` to `512` or `256`;
- prewarm the JavaScript module before performance;
- later split planning from rendering and compute plans outside the audio
  rendering callback.

The transition renderer interpolates the prepared plan at every sample, so
crossing offsets remain sample-resolution even when the planning grid is
coarser.

## Behavioral guarantees

With valid finite parameters:

- `base_phase` never decreases;
- `output_phase` never decreases;
- event phases remain in cyclic order;
- the same seed and commands reproduce the same trajectory;
- `weight = 0` reduces PS to an ordinary phasor;
- endpoint `rate` and `weight` equal their requested targets;
- a rendezvous ends on its requested output phase;
- immediate setters cancel active transitions.

## Tests

Run:

```bash
npm test
```

The supplied tests cover:

- equivalence to an ordinary phasor at zero weight;
- deterministic replay;
- positive, octave-bounded output rate;
- exact nonzero-weight rendezvous;
- endpoint rate and weight;
- multiple-event ordering;
- default Simplex crossing-rate calibration.
