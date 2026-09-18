import { SimplexNoise } from './SimplexNoise.js';

const EPSILON = 1e-12;
const LINEAR_SHARPNESS_EPSILON = 1e-6;
const DEFAULT_OCTAVE_WEIGHTS = Object.freeze([0.6, 0.25, 0.15]);

// Calibration measured over 32 seeded paths and 32,000 coordinate units for
// the default three-octave contour. It gives approximately one positive zero
// crossing per base-phase cycle.
const DEFAULT_NOISE_COORDINATE_SCALE = 0.995891945723889;

function mod1(value) {
    return ((value % 1) + 1) % 1;
}

function shapedProgress(u, sharpness) {
    if (sharpness < LINEAR_SHARPNESS_EPSILON) return u;
    return 0.5 * (
        1 + Math.tanh(sharpness * (u - 0.5)) / Math.tanh(sharpness / 2)
    );
}

function correctionBasis(u) {
    return 6 * u * (1 - u);
}

function normalizeWeights(weights) {
    const source = Array.isArray(weights) && weights.length > 0
        ? weights
        : DEFAULT_OCTAVE_WEIGHTS;
    const cleaned = source.map(Number);
    if (cleaned.some((value) => !Number.isFinite(value) || value < 0)) {
        throw new RangeError('octaveWeights must contain finite, non-negative values.');
    }
    const total = cleaned.reduce((sum, value) => sum + value, 0);
    if (total <= 0) throw new RangeError('At least one octave weight must be positive.');
    return cleaned.map((value) => value / total);
}

function lerp(a, b, fraction) {
    return a + (b - a) * fraction;
}

/**
 * A forward-only phase-event generator whose instantaneous output rate is
 *
 *     baseRate * 2 ** (weight * simplexValue)
 *
 * Simplex traversal follows base-phase progress. The class preserves a clean
 * base phase while phase events are crossed by the separately integrated
 * output phase. Seeded future noise is forecast during rendezvous planning so
 * output phase can land on an exact target even when targetWeight is nonzero.
 */
export class PlusSimplexPhasor {
    constructor(rate = 1, eventList = [], phase = 0, options = {}) {
        if (!Number.isFinite(rate) || rate < 0) {
            throw new RangeError('Phasor rate must be a finite, non-negative number.');
        }
        if (!Number.isFinite(phase)) {
            throw new RangeError('Phasor phase must be finite.');
        }

        const weight = options.weight ?? 0;
        if (!Number.isFinite(weight) || weight < 0) {
            throw new RangeError('Simplex weight must be finite and non-negative.');
        }

        this.baseUnwrappedPhase = mod1(phase);
        this.outputUnwrappedPhase = mod1(phase);
        this.rate = rate;
        this.weight = weight;
        this.eventList = [];
        this.transition = null;

        this.seed = Number(options.seed ?? 1) >>> 0;
        this.simplex = new SimplexNoise(this.seed);
        this.fixedY = Number.isFinite(options.fixedY)
            ? options.fixedY
            : SimplexNoise.deriveFixedY(this.seed);
        this.octaveWeights = normalizeWeights(options.octaveWeights);
        this.noiseCoordinate = Number.isFinite(options.initialNoiseCoordinate)
            ? options.initialNoiseCoordinate
            : 0;
        this.noiseCoordinateScale = Number.isFinite(options.noiseCoordinateScale)
            && options.noiseCoordinateScale > 0
            ? options.noiseCoordinateScale
            : DEFAULT_NOISE_COORDINATE_SCALE;
        this.planningSteps = Number.isInteger(options.planningSteps)
            && options.planningSteps >= 128
            ? options.planningSteps
            : 1024;

        for (const event of eventList) this.addEvent(event);
    }

    getPhase() {
        return this.getOutputPhase();
    }

    getOutputPhase() {
        return mod1(this.outputUnwrappedPhase);
    }

    getBasePhase() {
        return mod1(this.baseUnwrappedPhase);
    }

    getRate() {
        return this.rate;
    }

    getWeight() {
        return this.weight;
    }

    getNoiseValue() {
        return this._sampleNoise(this.noiseCoordinate);
    }

    getOutputRate() {
        return this.rate * 2 ** (this.weight * this.getNoiseValue());
    }

    setRate(rate) {
        this._validateRate(rate, 'rate');
        this.transition = null;
        this.rate = rate;
    }

    setWeight(weight) {
        this._validateWeight(weight, 'weight');
        this.transition = null;
        this.weight = weight;
    }

    // Compatibility operation: an immediate phase reset aligns both clocks.
    setPhase(phase) {
        this._validatePhase(phase, 'phase');
        this.transition = null;
        const baseTurns = Math.floor(this.baseUnwrappedPhase);
        const outputTurns = Math.floor(this.outputUnwrappedPhase);
        this.baseUnwrappedPhase = baseTurns + mod1(phase);
        this.outputUnwrappedPhase = outputTurns + mod1(phase);
    }

    setOutputPhase(phase) {
        this._validatePhase(phase, 'phase');
        this.transition = null;
        this.outputUnwrappedPhase = Math.floor(this.outputUnwrappedPhase) + mod1(phase);
    }

    setBasePhase(phase) {
        this._validatePhase(phase, 'phase');
        this.transition = null;
        this.baseUnwrappedPhase = Math.floor(this.baseUnwrappedPhase) + mod1(phase);
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
     * Transition rate and weight along the same shaped progress curve and land
     * output phase exactly on targetPhase. A smooth rate correction, zero at
     * both endpoints, supplies the additional or reduced phase advance.
     */
    beginTransition({
        durationFrames,
        targetRate,
        targetWeight,
        targetPhase,
        sharpness = 0
    }) {
        this._validateTransitionArguments({
            durationFrames,
            targetRate,
            targetWeight,
            targetPhase,
            sharpness,
            phaseRequired: true
        });

        if (durationFrames === 0) {
            this.rate = targetRate;
            this.weight = targetWeight;
            this.setOutputPhase(targetPhase);
            return;
        }

        this.transition = this._newTransition({
            durationFrames,
            targetRate,
            targetWeight,
            targetPhase: mod1(targetPhase),
            sharpness
        });
    }

    /** Change rate and weight naturally, without imposing an endpoint phase. */
    beginNaturalTransition({
        durationFrames,
        targetRate,
        targetWeight,
        sharpness = 0
    }) {
        this._validateTransitionArguments({
            durationFrames,
            targetRate,
            targetWeight,
            targetPhase: null,
            sharpness,
            phaseRequired: false
        });

        if (durationFrames === 0) {
            this.transition = null;
            this.rate = targetRate;
            this.weight = targetWeight;
            return;
        }

        this.transition = this._newTransition({
            durationFrames,
            targetRate,
            targetWeight,
            targetPhase: null,
            sharpness
        });
    }

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
            const previous = this.outputUnwrappedPhase;
            this._advanceOneSample(sampleRate);
            this._collectCrossings(
                previous,
                this.outputUnwrappedPhase,
                sample,
                triggered
            );
        }
        triggered.sort((a, b) => a.sampleOffset - b.sampleOffset);
        return triggered;
    }

    _newTransition({ durationFrames, targetRate, targetWeight, targetPhase, sharpness }) {
        return {
            durationFrames,
            elapsedFrames: 0,
            startBasePhase: this.baseUnwrappedPhase,
            startOutputPhase: this.outputUnwrappedPhase,
            startNoiseCoordinate: this.noiseCoordinate,
            startRate: this.rate,
            startWeight: this.weight,
            targetRate,
            targetWeight,
            targetPhase,
            sharpness,
            sampleRate: null,
            plan: null,
            desiredAdvance: null,
            correctionRate: 0
        };
    }

    _prepareTransition(sampleRate) {
        const t = this.transition;
        t.sampleRate = sampleRate;
        const steps = Math.min(t.durationFrames, this.planningSteps);
        const natural = this._simulateTransition(t, sampleRate, steps, 0, false);

        let correctionRate = 0;
        let desiredAdvance = natural.outputAdvance;

        if (t.targetPhase !== null) {
            const displacement = mod1(t.targetPhase - mod1(t.startOutputPhase));
            const approximateTurns = Math.max(
                0,
                Math.round(natural.outputAdvance - displacement)
            );
            const firstTurns = Math.max(0, approximateTurns - 2);
            const lastTurns = approximateTurns + 32;
            const candidates = [];
            for (let turns = firstTurns; turns <= lastTurns; turns++) {
                candidates.push(displacement + turns);
            }
            candidates.sort((a, b) =>
                Math.abs(a - natural.outputAdvance)
                - Math.abs(b - natural.outputAdvance)
            );

            let best = null;
            // Candidates are nearest-first, so the first feasible branch also
            // requires the smallest departure from the natural trajectory.
            for (const candidateAdvance of candidates) {
                const solved = this._solveCorrection(
                    t,
                    sampleRate,
                    steps,
                    candidateAdvance,
                    natural.outputAdvance
                );
                if (!solved) continue;
                best = {
                    correctionRate: solved.correctionRate,
                    desiredAdvance: candidateAdvance
                };
                break;
            }

            if (!best) {
                throw new Error('Could not find a forward-rotating Plus Simplex transition branch.');
            }
            correctionRate = best.correctionRate;
            desiredAdvance = best.desiredAdvance;
        }

        t.correctionRate = correctionRate;
        t.desiredAdvance = desiredAdvance;
        t.plan = this._simulateTransition(
            t,
            sampleRate,
            steps,
            correctionRate,
            true
        ).plan;

        // Remove the last few floating-point ulps without changing the contour.
        if (t.targetPhase !== null) {
            t.plan.outputPhases[steps] = t.startOutputPhase + desiredAdvance;
        }
    }

    _solveCorrection(t, sampleRate, steps, desiredAdvance, naturalAdvance) {
        const durationSeconds = t.durationFrames / sampleRate;
        const lowerBound = this._minimumCorrectionRate(t, steps);
        const tolerance = 1e-10;
        if (Math.abs(desiredAdvance - naturalAdvance) <= tolerance) {
            return { correctionRate: 0 };
        }

        let low;
        let high;
        if (desiredAdvance < naturalAdvance) {
            low = lowerBound + 1e-10;
            high = 0;
            const lowAdvance = this._simulateTransition(
                t, sampleRate, steps, low, false
            ).outputAdvance;
            if (lowAdvance > desiredAdvance + tolerance) return null;
        } else {
            low = 0;
            high = Math.max(1 / durationSeconds, 1);
            let highAdvance = this._simulateTransition(
                t, sampleRate, steps, high, false
            ).outputAdvance;
            let expansions = 0;
            while (highAdvance < desiredAdvance && expansions++ < 40) {
                high *= 2;
                highAdvance = this._simulateTransition(
                    t, sampleRate, steps, high, false
                ).outputAdvance;
            }
            if (highAdvance < desiredAdvance) return null;
        }

        for (let iteration = 0; iteration < 24; iteration++) {
            const middle = 0.5 * (low + high);
            const advance = this._simulateTransition(
                t, sampleRate, steps, middle, false
            ).outputAdvance;
            if (advance < desiredAdvance) low = middle;
            else high = middle;
        }
        return { correctionRate: 0.5 * (low + high) };
    }

    _minimumCorrectionRate(t, steps) {
        let lowerBound = -Infinity;
        for (let index = 0; index <= steps; index++) {
            const u = index / steps;
            const basis = correctionBasis(u);
            if (basis <= EPSILON) continue;
            const progress = shapedProgress(u, t.sharpness);
            const naturalRate = lerp(t.startRate, t.targetRate, progress);
            lowerBound = Math.max(lowerBound, -naturalRate / basis);
        }
        return Number.isFinite(lowerBound) ? lowerBound : 0;
    }

    _simulateTransition(t, sampleRate, steps, correctionRate, capturePlan) {
        const durationSeconds = t.durationFrames / sampleRate;
        const secondsPerStep = durationSeconds / steps;
        let basePhase = t.startBasePhase;
        let outputPhase = t.startOutputPhase;
        let noiseCoordinate = t.startNoiseCoordinate;

        const plan = capturePlan ? {
            steps,
            basePhases: new Float64Array(steps + 1),
            outputPhases: new Float64Array(steps + 1),
            noiseCoordinates: new Float64Array(steps + 1),
            rates: new Float64Array(steps + 1),
            weights: new Float64Array(steps + 1)
        } : null;

        if (plan) {
            plan.basePhases[0] = basePhase;
            plan.outputPhases[0] = outputPhase;
            plan.noiseCoordinates[0] = noiseCoordinate;
            plan.rates[0] = t.startRate;
            plan.weights[0] = t.startWeight;
        }

        for (let index = 1; index <= steps; index++) {
            const uMid = (index - 0.5) / steps;
            const progressMid = shapedProgress(uMid, t.sharpness);
            const rateMid = lerp(t.startRate, t.targetRate, progressMid)
                + correctionRate * correctionBasis(uMid);
            if (rateMid < -EPSILON) {
                return { outputAdvance: -Infinity, plan: null };
            }
            const weightMid = lerp(t.startWeight, t.targetWeight, progressMid);
            const baseAdvance = Math.max(0, rateMid) * secondsPerStep;
            const noiseMid = this._sampleNoise(
                noiseCoordinate + 0.5 * this.noiseCoordinateScale * baseAdvance
            );
            const outputAdvance = baseAdvance * 2 ** (weightMid * noiseMid);

            basePhase += baseAdvance;
            outputPhase += outputAdvance;
            noiseCoordinate += this.noiseCoordinateScale * baseAdvance;

            if (plan) {
                const u = index / steps;
                const progress = shapedProgress(u, t.sharpness);
                plan.basePhases[index] = basePhase;
                plan.outputPhases[index] = outputPhase;
                plan.noiseCoordinates[index] = noiseCoordinate;
                plan.rates[index] = index === steps
                    ? t.targetRate
                    : lerp(t.startRate, t.targetRate, progress)
                        + correctionRate * correctionBasis(u);
                plan.weights[index] = index === steps
                    ? t.targetWeight
                    : lerp(t.startWeight, t.targetWeight, progress);
            }
        }

        return {
            outputAdvance: outputPhase - t.startOutputPhase,
            plan
        };
    }

    _advanceOneSample(sampleRate) {
        const t = this.transition;
        if (!t) {
            const baseAdvance = this.rate / sampleRate;
            const noiseMid = this._sampleNoise(
                this.noiseCoordinate
                + 0.5 * this.noiseCoordinateScale * baseAdvance
            );
            this.baseUnwrappedPhase += baseAdvance;
            this.outputUnwrappedPhase += baseAdvance
                * 2 ** (this.weight * noiseMid);
            this.noiseCoordinate += this.noiseCoordinateScale * baseAdvance;
            return;
        }

        const nextElapsed = t.elapsedFrames + 1;
        const planPosition = nextElapsed / t.durationFrames * t.plan.steps;
        const lower = Math.min(t.plan.steps, Math.floor(planPosition));
        const upper = Math.min(t.plan.steps, lower + 1);
        const fraction = planPosition - lower;

        this.baseUnwrappedPhase = lerp(
            t.plan.basePhases[lower], t.plan.basePhases[upper], fraction
        );
        this.outputUnwrappedPhase = lerp(
            t.plan.outputPhases[lower], t.plan.outputPhases[upper], fraction
        );
        this.noiseCoordinate = lerp(
            t.plan.noiseCoordinates[lower], t.plan.noiseCoordinates[upper], fraction
        );
        this.rate = lerp(t.plan.rates[lower], t.plan.rates[upper], fraction);
        this.weight = lerp(t.plan.weights[lower], t.plan.weights[upper], fraction);
        t.elapsedFrames = nextElapsed;

        if (nextElapsed >= t.durationFrames) {
            this.rate = t.targetRate;
            this.weight = t.targetWeight;
            this.transition = null;
        }
    }

    _sampleNoise(noiseCoordinate) {
        let value = 0;
        for (let octave = 0; octave < this.octaveWeights.length; octave++) {
            value += this.octaveWeights[octave] * this.simplex.noise2D(
                noiseCoordinate * 2 ** octave,
                this.fixedY
            );
        }
        return Math.max(-1, Math.min(1, value));
    }

    _collectCrossings(previous, next, sample, output) {
        const distance = next - previous;
        if (distance <= EPSILON) return;
        for (const event of this.eventList) {
            let crossing = event.phase + Math.floor(previous - event.phase) + 1;
            // Avoid reporting the same boundary twice when accumulation leaves
            // `previous` a few floating-point ulps below the exact crossing.
            while (crossing <= previous + EPSILON) crossing += 1;
            while (crossing <= next + EPSILON) {
                output.push({
                    ...event,
                    sampleOffset: sample + (crossing - previous) / distance
                });
                crossing += 1;
            }
        }
    }

    _validateTransitionArguments({
        durationFrames,
        targetRate,
        targetWeight,
        targetPhase,
        sharpness,
        phaseRequired
    }) {
        if (!Number.isInteger(durationFrames) || durationFrames < 0) {
            throw new RangeError('durationFrames must be a non-negative integer.');
        }
        this._validateRate(targetRate, 'targetRate');
        this._validateWeight(targetWeight, 'targetWeight');
        if (phaseRequired) this._validatePhase(targetPhase, 'targetPhase');
        if (!Number.isFinite(sharpness) || sharpness < 0 || sharpness > 6) {
            throw new RangeError('sharpness must be finite and between 0 and 6.');
        }
    }

    _validateRate(value, name) {
        if (!Number.isFinite(value) || value < 0) {
            throw new RangeError(`${name} must be finite and non-negative.`);
        }
    }

    _validateWeight(value, name) {
        if (!Number.isFinite(value) || value < 0) {
            throw new RangeError(`${name} must be finite and non-negative.`);
        }
    }

    _validatePhase(value, name) {
        if (!Number.isFinite(value)) {
            throw new RangeError(`${name} must be finite.`);
        }
    }
}

export {
    DEFAULT_NOISE_COORDINATE_SCALE,
    DEFAULT_OCTAVE_WEIGHTS,
    shapedProgress
};

export default PlusSimplexPhasor;
