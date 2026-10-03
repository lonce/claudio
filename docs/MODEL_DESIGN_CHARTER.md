# Project Charter: Models as Executable Causal Lessons

> Recorded verbatim as given, 2026-10-03. This is the project's
> highest-level statement of intent for *why* sound models and their
> knowledge records (`soundlib/models/*/knowledge/*.yaml`) are built the
> way they are, and what they are building toward. `docs/MODEL_PATTERNS.md`
> is the architecture catalog this intent has produced so far; read this
> charter first to understand why that catalog exists and what it's
> incomplete relative to. Status: living document — its vocabulary and
> schemas are explicitly provisional (see "Do Not Prematurely Freeze a
> Universal Ontology" below), not a finished taxonomy to enforce rigidly.

## Purpose

The Claudio sound models we are building have two simultaneous purposes:

1. They should be musically and sonically useful artifacts.
2. They should become executable examples from which an agent can learn how to reason about constructing new sound models.

The longer-term goal is not merely to retrieve an existing model or preset. Given a high-level description, an analyzed sound, a gesture, or some combination of these, an agent should eventually be able to:

* infer plausible sound-producing mechanisms;
* propose one or more candidate model structures;
* assemble those structures from reusable components;
* identify important parameters and mappings;
* instrument the model so its internal behavior can be observed;
* compare the result with the intended behavior;
* revise its causal hypotheses when measurements or listening contradict them.

The current models therefore form an early curriculum of **executable causal examples**.

## Do Not Prematurely Freeze a Universal Ontology

We do not yet have enough examples to determine the final representation of all sound-model knowledge. Continue using the existing knowledge structures, but treat their vocabulary and schemas as provisional and extensible.

When a new model exposes a distinction that the current representation cannot express cleanly, record that fact. Do not force a genuinely new concept into an inaccurate existing category merely to preserve the schema.

At the same time, avoid accumulating isolated prose lessons with no common structure. Each development phase should leave behind a compact, consistently organized reasoning record.

## Separate the Principal Layers

Where applicable, describe a model using distinct causal layers:

1. **Gesture or event process**
   Determines when interactions occur and how intentions evolve over time.

2. **Physical driver or energy source**
   Represents the entity or reservoir capable of supplying energy: a striker, bow, airflow, shaking container, motor, external signal, and so forth.

3. **Contact or coupling mechanism**
   Determines how energy is actually exchanged according to the states of the interacting components.

4. **Resonating or propagating structure**
   Stores and transforms energy: string, mode bank, membrane, tube, body, delay network, etc.

5. **Radiation and observation system**
   Determines which internal signals are exposed, mixed, or heard.

These layers should remain separable even when a simple model collapses several of them into one implementation.

In particular:

> An event process determines when an interaction is attempted. A driver supplies the possible energy. A coupling law determines the actual energy exchange. A resonator determines how the transferred energy evolves.

For example, "statistical impact" should not be treated as a single indivisible mechanism. A statistical process may schedule striker events, while each collision remains a state-dependent physical interaction.

## Preserve Important Distinctions

Maintain explicit distinctions between:

* physical controls and monitor/mix controls;
* energy transfer and signal observation;
* initial conditions and continuing excitation;
* open-loop driving and state-dependent interaction;
* one-way coupling and bilateral coupling;
* component-local behavior and whole-system consequences;
* intended physical behavior and numerical implementation artifacts;
* general DSP properties and behavior measured only in this implementation;
* measured behavior and perceptual interpretation;
* stable architectural knowledge and provisional design hypotheses.

Monitor gains must never silently alter physical state or coupling. Numerical artifacts must not be described as physical properties unless that interpretation has been explicitly chosen and documented.

## What Each Model or Development Phase Should Teach

For every significant model or phase, preserve the following where relevant:

### 1. Intended phenomenon

What behavior, sound, interaction, or reasoning distinction is this model intended to demonstrate?

### 2. Causal structure

What are the important components, ports, state variables, and connections? Where does energy enter, propagate, transfer, and disappear?

### 3. Component roles

Describe components by reusable roles rather than only by class names. Examples include:

* event generator;
* driver;
* contact law;
* propagation medium;
* termination;
* resonator;
* radiation path;
* observation point;
* control mapper.

### 4. Parameter semantics

For each important parameter, record:

* what changes computationally;
* what it is intended to represent physically;
* its expected perceptual tendency;
* important interactions with other parameters;
* validity or safety limits;
* whether it affects physical state or observation only.

### 5. Claims and evidence

Continue distinguishing at least:

* `confirmed-dsp-property`
* `measured-in-this-model`
* `perceptual-hypothesis`
* `provisional-design-hypothesis`
* `known-numerical-artifact`

Do not silently promote a perceptual impression or model-specific measurement into a general physical claim.

### 6. Design decisions

Record consequential reasoning episodes in a compact form:

```text
observation
→ competing explanations
→ isolating experiment
→ measurement or listening evidence
→ revised causal claim
→ architectural consequence
```

Preserve important rejected alternatives and failures when they teach a reusable lesson. The finished code records what succeeded; the decision history records how to reason toward it.

### 7. Counterfactuals

Where practical, provide tests or experiments that alter one causal element while holding others constant. Examples include:

* bypassing a component;
* substituting one coupling law for another;
* comparing open-loop and state-dependent excitation;
* changing body Q while preserving modal frequencies;
* soloing signals before and after a transformation;
* disabling interpolation while preserving nominal delay.

Counterfactual comparisons are especially valuable because they teach what a component contributes rather than merely demonstrating that the complete model makes sound.

### 8. Reusable lesson

State what architectural or reasoning pattern another model could reuse. Also state what is specific to this model and should not be generalized.

## Development Method

Before implementing a significant new mechanism:

1. State the intended causal interpretation.
2. Identify the necessary inputs, outputs, state observations, and energy source.
3. Identify plausible alternative mechanisms.
4. State what measurements or listening comparisons would distinguish those alternatives.
5. Reuse existing components when their causal role and contract genuinely match—not merely because their code appears convenient.

After implementation:

1. Verify basic numerical safety.
2. Verify the intended state and energy relationships where feasible.
3. Expose useful internal observation points.
4. Perform controlled comparisons and counterfactuals.
5. Record unexpected behavior and revise claims honestly.
6. Identify the reusable construction pattern demonstrated by the result.

Musical usefulness is important, but a musically satisfying result alone does not establish that the proposed causal explanation is correct.

## Excitation as an Early Example of the Method

Do not represent excitation solely as a flat `excitationType` enumeration. Excitation mechanisms occupy a multidimensional design space including:

* instantaneous versus sustained;
* scripted versus statistical timing;
* open-loop versus state-dependent;
* intermittent versus persistent contact;
* force, velocity, displacement, or pressure driving;
* fixed, moving, or distributed contact;
* finite versus continuously replenished energy;
* linear versus nonlinear interaction.

The existing pluck, a future compliant striker, and a future stick–slip bow should be treated as contrasting executable lessons:

* pluck: finite initial condition;
* striker: transient state-dependent contact;
* bow: sustained nonlinear bilateral interaction.

Their commonalities should motivate reusable interfaces, while their differences must remain explicit in the knowledge records.

## Implications for the Current Waveguide Project

The WaveguideResonator family should be understood as more than a sequence of instrument features. It is teaching, among other things:

* propagation versus loss;
* physical loss versus interpolation artifacts;
* parameter semantics versus implementation coefficients;
* termination, transmission, and dissipation;
* one-way versus eventual bilateral body coupling;
* physical signal paths versus monitor paths;
* static versus dynamically controlled physical structure;
* initial excitation versus continuing energy input.

The pickup, bridge-transmission, and body-radiation monitors are therefore also diagnostic observation points. Record them as part of the model's reasoning affordances, not merely as output mixer controls.
