const EPSILON = 1e-12;
const LINEAR_SHARPNESS_EPSILON = 1e-6;

function mod1(value) {
    return ((value % 1) + 1) % 1;
}

// Symmetric normalized tanh progress. Its integral over [0, 1] is 1/2 for
// every sharpness, so changing the curve does not change nominal phase advance.
function shapedProgress(u, sharpness) {
    if (sharpness < LINEAR_SHARPNESS_EPSILON) return u;
    return 0.5 * (
        1 + Math.tanh(sharpness * (u - 0.5)) / Math.tanh(sharpness / 2)
    );
}

function integratedShapedProgress(u, sharpness) {
    if (sharpness < LINEAR_SHARPNESS_EPSILON) return 0.5 * u * u;
    const halfSharpness = sharpness / 2;
    return 0.5 * u + (
        Math.log(Math.cosh(sharpness * (u - 0.5)))
        - Math.log(Math.cosh(halfSharpness))
    ) / (2 * sharpness * Math.tanh(halfSharpness));
}

/**
 * A forward-rotating phasor with phase-positioned events and exact transition
 * landmarks. Phase is tracked internally without wrapping so that multiple
 * rotations per render quantum are handled correctly.
 */
export class TransitionPhasor {
    constructor(rate = 1, eventList = [], phase = 0) {
        if (!Number.isFinite(rate) || rate < 0) {
            throw new RangeError('Phasor rate must be a finite, non-negative number.');
        }

        this.unwrappedPhase = mod1(phase);
        this.rate = rate;
        this.eventList = [];
        this.transition = null;

        for (const event of eventList) this.addEvent(event);
    }

    getPhase() {
        return mod1(this.unwrappedPhase);
    }

    getRate() {
        return this.rate;
    }

    setRate(rate) {
        if (!Number.isFinite(rate) || rate < 0) {
            throw new RangeError('Phasor rate must be a finite, non-negative number.');
        }
        this.transition = null;
        this.rate = rate;
    }

    setPhase(phase) {
        if (!Number.isFinite(phase)) {
            throw new RangeError('Phasor phase must be finite.');
        }
        this.transition = null;
        const turns = Math.floor(this.unwrappedPhase);
        this.unwrappedPhase = turns + mod1(phase);
    }

    addEvent(event) {
        if (!event || !Number.isFinite(event.phase)) {
            throw new TypeError('A phase event must contain a finite phase value.');
        }
        this.eventList.push({ ...event, phase: mod1(event.phase) });
        this.eventList.sort((a, b) => a.phase - b.phase);
    }

    removeEvent(eventOrId) {
        const before = this.eventList.length;
        this.eventList = this.eventList.filter((event) =>
            typeof eventOrId === 'object'
                ? event !== eventOrId
                : event.id !== eventOrId
        );
        return before !== this.eventList.length;
    }

    /**
     * Begin a transition at the phasor's current state.
     *
     * The nominal trajectory is a linear frequency ramp. A smooth correction
     * 6u(1-u) is added to frequency so the integrated phase reaches the target
     * exactly while preserving both endpoint frequencies.
     *
     * The phase target has infinitely many unwrapped branches. We choose the
     * branch closest to the nominal phase advance that keeps rotation forward.
     */
    beginTransition({ durationFrames, targetRate, targetPhase, sharpness = 0 }) {
        if (!Number.isInteger(durationFrames) || durationFrames < 0) {
            throw new RangeError('durationFrames must be a non-negative integer.');
        }
        if (!Number.isFinite(targetRate) || targetRate < 0) {
            throw new RangeError('targetRate must be a finite, non-negative number.');
        }
        if (!Number.isFinite(targetPhase)) {
            throw new RangeError('targetPhase must be finite.');
        }
        if (!Number.isFinite(sharpness) || sharpness < 0 || sharpness > 6) {
            throw new RangeError('sharpness must be finite and between 0 and 6.');
        }

        if (durationFrames === 0) {
            this.setPhase(targetPhase);
            this.rate = targetRate;
            this.transition = null;
            return;
        }

        this.transition = {
            durationFrames,
            elapsedFrames: 0,
            startUnwrappedPhase: this.unwrappedPhase,
            startPhase: this.getPhase(),
            startRate: this.rate,
            targetRate,
            targetPhase: mod1(targetPhase),
            sharpness,
            // Filled by _prepareTransition on the first process call, when the
            // sample rate is known.
            sampleRate: null,
            desiredAdvance: null,
            correctionCycles: null
        };
    }

    /**
     * Linearly change rate without imposing a separate endpoint phase.
     * The target phase is the one naturally accumulated by the rate ramp, so
     * beginTransition's phase-correction term resolves to zero.
     */
    beginRateTransition({ durationFrames, targetRate, sampleRate, sharpness = 0 }) {
        if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
            throw new RangeError('sampleRate must be positive and finite.');
        }
        const durationSeconds = durationFrames / sampleRate;
        const targetPhase = this.getPhase()
            + durationSeconds * (this.getRate() + targetRate) / 2;
        this.beginTransition({
            durationFrames,
            targetRate,
            targetPhase,
            sharpness
        });
    }

    /**
     * Advance by frameCount samples and return every crossed phase event.
     * sampleOffset is fractional and measured from the start of this block.
     */
    processBlock(frameCount, sampleRate) {
        if (!Number.isInteger(frameCount) || frameCount < 0) {
            throw new RangeError('frameCount must be a non-negative integer.');
        }
        if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
            throw new RangeError('sampleRate must be positive and finite.');
        }

        if (this.transition && this.transition.sampleRate === null) {
            this._prepareTransition(sampleRate);
        } else if (this.transition && this.transition.sampleRate !== sampleRate) {
            throw new Error('Sample rate changed during a phasor transition.');
        }

        const triggered = [];

        for (let sample = 0; sample < frameCount; sample++) {
            const previous = this.unwrappedPhase;
            const next = this._nextSamplePhase(sampleRate);
            this._collectCrossings(previous, next, sample, triggered);
            this.unwrappedPhase = next;
        }

        return triggered;
    }

    _prepareTransition(sampleRate) {
        const t = this.transition;
        t.sampleRate = sampleRate;

        const durationSeconds = t.durationFrames / sampleRate;
        const nominalAdvance = durationSeconds * (t.startRate + t.targetRate) / 2;
        const phaseDisplacement = mod1(t.targetPhase - t.startPhase);

        let best = null;
        const approximateTurns = Math.max(0, Math.round(nominalAdvance - phaseDisplacement));
        const firstTurns = Math.max(0, approximateTurns - 2);
        const lastTurns = approximateTurns + 64;

        for (let wholeTurns = firstTurns; wholeTurns <= lastTurns; wholeTurns++) {
            const desiredAdvance = phaseDisplacement + wholeTurns;
            const correctionCycles = desiredAdvance - nominalAdvance;

            if (!this._frequencyStaysNonNegative(
                t.startRate,
                t.targetRate,
                correctionCycles / durationSeconds,
                t.sharpness
            )) continue;

            const distance = Math.abs(correctionCycles);
            if (!best || distance < best.distance) {
                best = { desiredAdvance, correctionCycles, distance };
            }
        }

        if (!best) {
            throw new Error('Could not find a forward-rotating transition branch.');
        }

        t.desiredAdvance = best.desiredAdvance;
        t.correctionCycles = best.correctionCycles;
    }

    _frequencyStaysNonNegative(
        startRate,
        targetRate,
        correctionRate,
        sharpness
    ) {
        // Inspect the actual shaped path. This is performed only when choosing
        // a transition branch, not in the per-sample rendering loop.
        const inspectionSteps = 4096;
        for (let index = 0; index <= inspectionSteps; index++) {
            const u = index / inspectionSteps;
            const value = startRate
                + (targetRate - startRate) * shapedProgress(u, sharpness)
                + correctionRate * 6 * u * (1 - u);
            if (value < -EPSILON) return false;
        }
        return true;
    }

    _nextSamplePhase(sampleRate) {
        const t = this.transition;
        if (!t) return this.unwrappedPhase + this.rate / sampleRate;

        const nextElapsed = t.elapsedFrames + 1;
        const u = Math.min(1, nextElapsed / t.durationFrames);
        const durationSeconds = t.durationFrames / sampleRate;

        // Integral of the linear ramp plus the correction basis 6u(1-u).
        const progress = shapedProgress(u, t.sharpness);
        const integratedProgress = integratedShapedProgress(u, t.sharpness);
        const nominalCycles = durationSeconds * (
            t.startRate * u + (t.targetRate - t.startRate) * integratedProgress
        );
        const correctionCycles = t.correctionCycles * (3 * u * u - 2 * u * u * u);
        const nextPhase = t.startUnwrappedPhase + nominalCycles + correctionCycles;

        // Instantaneous frequency at the new boundary.
        this.rate = t.startRate
            + (t.targetRate - t.startRate) * progress
            + (t.correctionCycles / durationSeconds) * 6 * u * (1 - u);
        t.elapsedFrames = nextElapsed;

        if (nextElapsed >= t.durationFrames) {
            this.rate = t.targetRate;
            this.transition = null;
        }

        return nextPhase;
    }

    _collectCrossings(previous, next, sample, output) {
        if (next >= previous) {
            const distance = next - previous;
            for (const event of this.eventList) {
                let crossing = event.phase + Math.floor(previous - event.phase) + 1;
                while (crossing <= next + EPSILON) {
                    const fraction = distance > EPSILON ? (crossing - previous) / distance : 0;
                    output.push({ ...event, sampleOffset: sample + fraction });
                    crossing += 1;
                }
            }
        } else {
            // Included for completeness if a future policy permits reverse motion.
            const distance = previous - next;
            for (const event of this.eventList) {
                let crossing = event.phase + Math.ceil(previous - event.phase) - 1;
                while (crossing >= next - EPSILON) {
                    const fraction = distance > EPSILON ? (previous - crossing) / distance : 0;
                    output.push({ ...event, sampleOffset: sample + fraction });
                    crossing -= 1;
                }
            }
        }
    }
}

export default TransitionPhasor;
