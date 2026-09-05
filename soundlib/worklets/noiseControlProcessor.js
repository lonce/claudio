import { SimplexNoise } from '../utilities/SimplexNoise.js';

// Generic, chime-agnostic AudioWorkletProcessor built to
// skills/NoiseControlProcessor-Specification.md's contract. Generates
// seeded simplex noise on the audio rendering thread and offers two
// coexisting capabilities: a continuous k-rate signal output (connectable
// to an AudioParam) and threshold-crossing event notifications (postMessage
// to the main thread). This processor must not instantiate, import, or
// directly control any Claudio SoundModel -- callers translate crossing
// events into whatever musical behavior they want.

const VALID_DIRECTIONS = new Set(['rising', 'falling', 'both']);
const DEFAULT_OCTAVE_WEIGHTS = [0.6, 0.25, 0.15];

function normalizeSeed(seed) {
    return Number(seed) >>> 0;
}

function normalizeOctaveWeights(weights) {
    if (!Array.isArray(weights) || weights.length === 0) return DEFAULT_OCTAVE_WEIGHTS;
    const cleaned = weights.filter((w) => Number.isFinite(w) && w >= 0);
    return cleaned.length > 0 ? cleaned : DEFAULT_OCTAVE_WEIGHTS;
}

function normalizeInterval(seconds) {
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : 0.03;
}

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

        const processorOptions = options.processorOptions ?? {};
        this.processorSampleRate = processorOptions.sampleRate ?? sampleRate;

        this.seed = normalizeSeed(processorOptions.seed ?? 1);
        this.fixedY = Number.isFinite(processorOptions.fixedY)
            ? processorOptions.fixedY
            : SimplexNoise.deriveFixedY(this.seed);
        this.octaveWeights = normalizeOctaveWeights(processorOptions.octaveWeights);
        this.direction = VALID_DIRECTIONS.has(processorOptions.direction) ? processorOptions.direction : 'both';
        this.minimumEventInterval = normalizeInterval(processorOptions.minimumEventInterval ?? 0.03);
        this.initialCoordinate = Number.isFinite(processorOptions.initialCoordinate)
            ? processorOptions.initialCoordinate
            : 0;

        this.simplex = new SimplexNoise(this.seed);
        this.enabled = false;
        this._resetState(this.initialCoordinate);

        this.port.onmessage = ({ data }) => this._handleMessage(data);
    }

    _resetState(initialCoordinate) {
        this.noiseTime = Number.isFinite(initialCoordinate) ? initialCoordinate : 0;
        this.currentValue = this._sampleNoise(this.noiseTime);
        this.controlSampleTime = currentTime;
        this.lastEventTime = -Infinity;
        this.sequence = 0;
        // Crossing detection is disabled until the first process() call
        // after a reset has produced a genuine "next" sample -- avoids
        // treating startup as an artificial crossing.
        this.hasPreviousValue = false;
    }

    _sampleNoise(noiseTime) {
        let sum = 0;
        let weightTotal = 0;
        for (let octave = 0; octave < this.octaveWeights.length; octave++) {
            const weight = this.octaveWeights[octave];
            sum += weight * this.simplex.noise2D(noiseTime * 2 ** octave, this.fixedY);
            weightTotal += weight;
        }
        const raw = weightTotal > 0 ? sum / weightTotal : 0;
        return Math.max(-1, Math.min(1, raw));
    }

    _handleMessage(data) {
        if (!data || typeof data.type !== 'string') return;

        switch (data.type) {
            case 'set-enabled':
                this.enabled = data.enabled === true;
                break;
            case 'set-seed': {
                const seed = normalizeSeed(data.seed);
                this.seed = seed;
                this.simplex = new SimplexNoise(seed);
                this.fixedY = SimplexNoise.deriveFixedY(seed);
                if (data.reset) this._resetState(this.initialCoordinate);
                break;
            }
            case 'set-direction':
                if (VALID_DIRECTIONS.has(data.direction)) this.direction = data.direction;
                break;
            case 'set-minimum-event-interval':
                if (Number.isFinite(data.seconds) && data.seconds >= 0) {
                    this.minimumEventInterval = data.seconds;
                }
                break;
            case 'reset':
                this._resetState(Number.isFinite(data.initialCoordinate) ? data.initialCoordinate : 0);
                break;
            case 'reset-analytics':
                this.sequence = 0;
                break;
            default:
                break;
        }
    }

    process(inputs, outputs, parameters) {
        const channel = outputs[0]?.[0];
        const frames = channel?.length ?? 128; // fallback only; do not rely on 128

        if (!this.enabled) {
            if (channel) channel.fill(0);
            return true;
        }

        const rate = parameters.rate[0];
        const amplitude = parameters.amplitude[0];
        const offset = parameters.offset[0];
        const threshold = parameters.threshold[0];

        const blockDuration = frames / this.processorSampleRate;

        const previousValue = this.currentValue;
        const previousTime = this.controlSampleTime;
        const hadPreviousValue = this.hasPreviousValue;

        this.noiseTime += rate * blockDuration;
        const rawValue = this._sampleNoise(this.noiseTime);
        const currentValue = offset + amplitude * rawValue;
        const currentSampleTime = currentTime;

        if (channel) channel.fill(currentValue);

        if (hadPreviousValue) {
            this._detectAndEmit({
                previousValue,
                currentValue,
                previousTime,
                currentSampleTime,
                threshold,
                rawValue
            });
        }

        this.currentValue = currentValue;
        this.controlSampleTime = currentSampleTime;
        this.hasPreviousValue = true;

        return true;
    }

    _detectAndEmit({ previousValue, currentValue, previousTime, currentSampleTime, threshold, rawValue }) {
        const rising = previousValue < threshold && currentValue >= threshold;
        const falling = previousValue > threshold && currentValue <= threshold;

        let direction = null;
        if (rising && (this.direction === 'rising' || this.direction === 'both')) direction = 'rising';
        else if (falling && (this.direction === 'falling' || this.direction === 'both')) direction = 'falling';

        if (!direction) return;

        const denominator = currentValue - previousValue;
        let fraction = denominator !== 0 ? (threshold - previousValue) / denominator : 0;
        fraction = Math.max(0, Math.min(1, fraction));
        const crossingTime = previousTime + fraction * (currentSampleTime - previousTime);

        if (crossingTime - this.lastEventTime < this.minimumEventInterval) return;
        this.lastEventTime = crossingTime;

        this.port.postMessage({
            type: 'threshold-crossing',
            sequence: this.sequence++,
            direction,
            threshold,
            previousValue,
            currentValue,
            rawValue,
            audioTime: crossingTime,
            detectedAtAudioTime: currentSampleTime
        });
    }
}

registerProcessor('noise-control-processor', NoiseControlProcessor);
