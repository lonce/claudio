export class Parameter {
    constructor(soundModel, name, defaultValue, min, max, attackTime = 0.01, decayTime = 0.01, preference = null) {
        this.soundModel=soundModel;
        this.name = name;
        this.value = defaultValue; // subject to continuous updates
        this.defaultValue = defaultValue; // used to reseet
        this.min = min;
        this.max = max;
        this.attackTime = attackTime;
        this.decayTime = decayTime;

        // Optional, inert hint for a preferred control mapping (e.g. 'pitch',
        // 'roll', 'x', 'y'). soundlib itself never reads this -- it's up to
        // whatever's driving the sound (a GUI app, a game) to honor it or not.
        this.preference = preference;
    }

    get() {
        return this.value;
    }

    getNormalized() {
        return (this.value - this.min) / (this.max - this.min);
    }

    set(value) {
        this.value = Math.max(this.min, Math.min(this.max, value));
        this.soundModel.updateParameter(this.name);
    }
    setNormalized(normalizedValue) {
        this.set(this.min + normalizedValue * (this.max - this.min));
        this.soundModel.updateParameter(this.name);
    }

    isStringParameter() {
        return false;
    }

    isIntegerParameter() {
        return false;
    }
}

////////////////////////////////////////////////////////////////////////
export class FloatParameter extends Parameter {
    constructor(soundModel, name, defaultValue, min, max, attackTime = 0.01, decayTime = 0.01, preference = null) {
        super(soundModel, name, defaultValue, min, max, attackTime, decayTime, preference);
    }
}
////////////////////////////////////////////////////////////////////////
export class IntegerParameter extends Parameter {
    constructor(soundModel, name, defaultValue, min, max, attackTime = 0.01, decayTime = 0.01, preference = null) {
        super(soundModel, name, Math.floor(defaultValue), Math.floor(min), Math.floor(max), attackTime, decayTime, preference);
    }

    set(value) {
        this.value = Math.floor(Math.max(this.min, Math.min(this.max, value)));
        this.soundModel.updateParameter(this.name);
    }

    // Give each integer value an equal-width bucket: normalizedValue in
    // [0,1] maps onto (max - min + 1) equal slices, each flooring down to
    // its integer (e.g. x for raw values in [x, x+1)). The base class's
    // formula instead divides into (max - min) slices, which makes the top
    // value (max) reachable only at the single point normalizedValue === 1.
    setNormalized(normalizedValue) {
        this.set(this.min + normalizedValue * (this.max - this.min + 1));
    }

    isIntegerParameter() {
        return true;
    }
}
////////////////////////////////////////////////////////////////////////
export class StringParameter extends Parameter {
    constructor(soundModel, name, defaultValue) {
        super(soundModel, name, defaultValue, null, null, 0, 0);
    }

    set(value) {
        this.value = value;
    }

    isStringParameter() {
        return true;
    }

    getNormalized() {
        return 0; // Not applicable for string parameters
    }

    setNormalized(normalizedValue) {
        // Not applicable for string parameters
    }
}