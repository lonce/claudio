export class Parameter {
    constructor(soundModel, name, defaultValue, min, max, attackTime = 0.01, decayTime = 0.01) {
        this.soundModel=soundModel;
        this.name = name;
        this.value = defaultValue;
        this.min = min;
        this.max = max;
        this.attackTime = attackTime;
        this.decayTime = decayTime;
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
    constructor(soundModel, name, defaultValue, min, max, attackTime = 0.01, decayTime = 0.01) {
        super(soundModel, name, defaultValue, min, max, attackTime, decayTime);
    }
}
////////////////////////////////////////////////////////////////////////
export class IntegerParameter extends Parameter {
    constructor(soundModel, name, defaultValue, min, max, attackTime = 0.01, decayTime = 0.01) {
        super(soundModel, name, Math.floor(defaultValue), Math.floor(min), Math.floor(max), attackTime, decayTime);
    }

    set(value) {
        this.value = Math.floor(Math.max(this.min, Math.min(this.max, value)));  
        this.soundModel.updateParameter(this.name); 
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