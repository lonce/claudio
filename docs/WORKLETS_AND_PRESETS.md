# AudioWorklet Patterns and the Preset System

This document covers ground beyond `ADDING_A_SOUND.md`: patterns learned
building `ChuaOscillator` (an AudioWorklet-based numerical-integration
model) and the preset save/curate/derive workflow built on top of it. Read
`ADDING_A_SOUND.md` first for the base `BaseSound` lifecycle; this file
assumes that.

## AudioWorklet patterns beyond the basics

`ClickerWorkletSoundModel.js` is the canonical *simple* worklet reference.
The patterns below matter once a worklet holds internal state across
samples (an oscillator phase, an integrator, anything that isn't just a
stateless function of its current `AudioParam`s).

### Resetting internal state: `port.postMessage`, not just `AudioParam`s

`AudioParam`s (`active`, coefficients, etc.) are the right tool for
continuous/scheduled values, but they can't tell a worklet "start over from
scratch." For that, use the message port both `clickTrainProcessor.js` and
`chuaProcessor.js` already use:

```js
// model side, in startSound()
this.workletNode.port.postMessage({ action: 'start' });

// worklet side, in the constructor
this.port.onmessage = (event) => {
    if (event.data.action === 'start') {
        this.x = 0.1; this.y = 0; this.z = 0; // back to initial conditions
    }
};
```

Any UI action that should "start fresh" needs to send this — it's not
automatic. `ChuaOscillator.updateParameter()`'s `'baseAttractor'` case posts
the same `{action:'start'}` message after cascading new coefficients in, so
switching attractors resets the integrator too, not just `startSound()`.

### Numerical safety for iterative/chaotic worklets

If a worklet integrates something per-sample (Euler, or anything similar),
divergence is a real failure mode, and it has a nasty property in Web
Audio: **an uncaught exception in `process()` can permanently kill that
AudioWorkletNode** — the browser stops calling `process()` again, and no
message or parameter change can revive it. The only fix at that point is
reloading the page. Two defensive patterns from `chuaProcessor.js`:

1. **`Math.min`/`Math.max` clamps do not filter `NaN`.** `Math.min(LIMIT,
   NaN)` returns `NaN`, so a naive clamp lets `NaN` through once arithmetic
   produces it, and `NaN` poisons every step after (silently, forever).
   Check `Number.isFinite()` explicitly on the *would-be* next state before
   committing it:

   ```js
   const nx = this.x + dt * dx;
   if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) {
       this.silenced = true;      // stop integrating, go silent
       channel.fill(0, i);
       return true;
   }
   ```

2. **Fail toward silence, not toward throwing.** A `this.silenced` flag
   (cleared by the same `{action:'start'}` message above) lets the node
   recover cleanly next time state is reset, instead of crashing the node
   outright. Combined with a coarse `LIMIT`-based clamp for merely-huge (but
   finite) values, this makes a chaotic model self-healing rather than a
   permanent dead end.

### One worklet, many models

A worklet processor is DSP; the model class decides what's exposed. If two
models need the *same* equations with different parameters frozen vs. live,
they can share one `WORKLET_PATH` — no need to fork the processor file.
`HamburgerLadyChua13.js` reuses `chuaProcessor.js` verbatim: it just sets
`gamma`/`m0`/`m1`/`mk` once via `setValueAtTime()` at construction and never
exposes them as `Parameter`s, while `alpha`/`beta`/`tscale`/`gain` stay
live. `AudioSystem.loadWorklet()` already dedupes `addModule()` calls by
path (`this.loadedWorklets` Set), so sharing a `WORKLET_PATH` string across
models is cheap and safe.

## The preset system

Preset support turns the app into a sound-*design* tool, not just a sound
*player*, and gives a repeatable path from "found something good by
tweaking sliders" to "a new, curated Sound Model file."

### Designer mode vs. normal mode

`app/main.js` reads `?mode=designer` from the URL
(`isDesignerMode`/`USE_NUDGE_SLIDER`). Designer mode swaps the plain
`<input type="range">` for float parameters with `NudgeSlider`
(`app/NudgeSlider.js`) and shows the "Save Preset" button; normal mode
(default, no query param) is the plain-slider, no-save experience. Both run
off the same `app/main.js` — no separate app/build.

### NudgeSlider

Why it exists: a `ChuaOscillator` coefficient's full range (e.g. `alpha`
spans `[-1100, 100]`) has to be that wide to cover all 150 tabulated
coefficient sets, but the *interesting* sliver for any one selection is
tiny and different every time — a linear 0–1 drag slider can't give usable
precision there. `NudgeSlider` adds, alongside the normal drag slider: a
scroll/drag-adjustable "nudge scale" (log range `[0.0001, 1]` of the
parameter's span) and ▲/▼ buttons (hold to repeat) that step by
`scale * (max - min)`. `createNudgeSliderControl()` returns
`{ element, getScale }` — `getScale()` exposes the current nudge scale for
any consumer that wants it; the Save dialog does not use it for `min`/`max`
(those come from the parameter's own base-model range, see "Saving a
preset" below).

### Digit formatting

`app/formatNumber.js`'s `formatFixedDigits(value, totalDigits=5)` caps
*total displayed digit characters*, not significant figures.
`toPrecision(5)` alone doesn't do this — for small magnitudes like
`gamma`'s `0.0160739649`, the leading zeros aren't "significant" but still
take up screen space, giving `"0.016074"` (7 characters). Every value
display in the app (NudgeSlider, plain slider fallback, `updateSliderValues()`,
the Save dialog) goes through this one helper so widths stay predictable.

### Saving a preset

`app/SavePresetDialog.js`'s `openSavePresetDialog()` builds a small panel:
name field, two docstring fields (`docstring_pub`, `docstring_private` —
snake_case is deliberate, matching the JSON schema below, distinct from the
camelCase used in JS code), and one row per parameter. A parameter counts
as *live* whenever its current control mapping isn't `'none'` (everything
starts as `'slider'` by default, so most parameters are "live" unless
explicitly set to `'none'`). Live parameters get editable `min`/`max`/
`default` fields: `min`/`max` are prefilled from the parameter's own
base-model range (`param.min`/`param.max`, as declared by the sound
model's `addParameter()` call), and `default` is prefilled from the
parameter's current (tuned) value; `'none'` (frozen) and string parameters
just get their current value.

Preset JSON shape (generic — same shape regardless of which model it came
from):

```json
{
  "soundName": "Hamburger Lady (Chua13)",
  "soundClass": "ChuaOscillator",
  "savedAt": "2026-08-15T14:49:52.270Z",
  "docstring_pub": "...",
  "docstring_private": "...",
  "parameters": {
    "alpha": { "mapping": "roll", "min": 10.96, "max": 12.76, "default": 10.96 },
    "gamma": { "mapping": "none", "value": 0.0776 }
  }
}
```

It downloads as a browser `Blob` — there's no server endpoint, and
`claudioserver.js` is untouched by any of this. Turning the download into
an actual model is a separate, manual (Claude-assisted) step, not something
the app does automatically.

### From a saved preset to a new Sound Model

This is the workflow actually used for `HamburgerLadyChua13`:

1. **Archive the JSON** at `soundlib/presets/<Name>.json` — data only, never
   code. Keeps `soundlib/models/` as the one place all model *code* lives,
   regardless of provenance.
2. **Name the class/file**: take `soundName`, strip spaces/punctuation,
   PascalCase each word — `"Hamburger Lady (Chua13)"` →
   `HamburgerLadyChua13.js` / `class HamburgerLadyChua13`. This matches
   every other model in the codebase (`DroneModel`, `ChuaOscillator`, ...);
   don't use the literal name with underscores for the class/file — the
   *original* `soundName` (spaces and all) is what still gets passed as the
   display name to `createSound()`.
3. **Write the model**, following the closest existing model as reference
   (for a Chua-family preset, that's `ChuaOscillator.js` — reuse its
   worklet per "One worklet, many models" above). Parameters with
   `mapping !== 'none'` become real `addParameter()` calls using the
   preset's `min`/`max`/`default`; `mapping === 'none'` entries become
   values set once on the worklet's `AudioParam`s at construction and never
   exposed as `Parameter`s at all.
4. **Sanity-check min/max before trusting them.** Preset JSON can have
   `min > max` if the designer hand-edited the Save dialog's number inputs
   after they were prefilled — `Parameter`'s clamping and normalization
   assume `min <= max` unconditionally and silently misbehave otherwise
   (e.g. `getNormalized()`'s division flips sign). Swap if needed, and say
   so in a comment — don't fix it silently in a way nobody can see later.
5. **Wire it up**: export from `soundlib/models/index_presets.js` (same
   shape as `index.js`, kept as a separate file specifically so
   preset-derived models are easy to tell apart from hand-authored
   canonical ones), then import + `createSound()` + push into `sounds` in
   `app/main.js`, exactly like any other model per `ADDING_A_SOUND.md`.

### Parameter preference hints

`Parameter` (in `soundlib/Parameter.js`) carries an inert `preference`
field (`'x' | 'y' | 'pitch' | 'roll' | null`), settable as a trailing
optional argument to `addParameter()`/`addIntegerParameter()`, or by direct
field assignment for `BaseSound`'s own `gain` parameter (which isn't
declared via a subclass's `addParameter()` call):

```js
this.addParameter('alpha', default, min, max, attackTime, decayTime, 'roll');
this.getParameter('gain').preference = 'pitch';
```

`soundlib` never reads this field — it's pure metadata a model can set
about itself, and any consumer (this app, or e.g. a game calling
`setParameter()` directly with no GUI at all) can honor it or ignore it.
`app/main.js`'s `initializeParameterControls()` is the one place that
*resolves* it into an actual starting control mapping, once per sound
selection: `pitch`/`roll` are used directly if `window.hasOrientationSupport
&& window.hasOrientationPermission`, else they fall back to `y`/`x`
respectively; any collision with an already-claimed slot (processed in
`getParameters()` order, `gain` always first) falls back to `'slider'`.
This is why a curated preset-derived model can "just work" on a phone
without the listener touching the mapping dropdowns — see
`HamburgerLadyChua13.js` for the worked example. When hand-authoring a
model from a preset, translate its `mapping` field into `preference` hints
this way (skip it for parameters whose preset `mapping` was `'slider'` —
that just means no hint).

### `docstringPub`

`BaseSound` has a plain `this.docstringPub = null` field. A model sets it
directly (`this.docstringPub = '...';`, matching a preset's
`docstring_pub`) and `app/main.js` displays it, bottom-justified, inside
`#xyPad` (`updateXyPadDoc()`, called at the top of `updateSliderBox()` so it
stays in sync with the current sound). The overlay element needs
`pointer-events: none` in CSS — without it, touching/clicking the text
during x/y-pad drag makes the overlay `e.target` instead of `#xyPad`
itself, which breaks `updateSound()`'s `getBoundingClientRect()` math.
`docstring_private` is archived in the preset JSON but has no model-side
home yet — same pattern would apply if that's ever wanted.
