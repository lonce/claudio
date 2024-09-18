export class Parameter {
    constructor(name, defaultValue, min, max, attackTime=.05, decayTime=.3) {
        this.name = name;
        this.min = min;
        this.max = max;
        this.value = defaultValue;
        this.attackTime = attackTime;
        this.decayTime = decayTime;  
    }

    set(value) {
        this.value = Math.max(this.min, Math.min(this.max, value));
    }

    get() {
        return this.value;
    }

    setNormalized(normalizedValue) {
        this.set(this.min + (this.max - this.min) * normalizedValue);
    }

    getNormalized() {
        return (this.value - this.min) / (this.max - this.min);
    }
}