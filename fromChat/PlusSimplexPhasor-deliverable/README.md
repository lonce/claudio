# Plus Simplex Phasor deliverable

Files:

- `PlusSimplexPhasor.js` — reusable PS event generator.
- `plusSimplexPhaseEventProcessor.js` — minimal timing-only AudioWorklet wrapper.
- `SimplexNoise.js` — supplied utility copied here so the package runs independently.
- `PlusSimplexPhasor-Specification.md` — design and integration guide.
- `test/PlusSimplexPhasor.test.js` — Node tests.

Run `npm test` from this directory.

When integrating into Claudio, place the main class with the existing utilities
and adjust its `SimplexNoise.js` import if necessary. The worklet wrapper should
be placed alongside the existing phase-event processor.
