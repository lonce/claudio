export class Parameter {
    constructor(name, defaultValue, min, max) {
        this.name = name;
        this.min = min;
        this.max = max;
        this.value = defaultValue;
        this.attackTime = 0.1; // Default attack time
        this.decayTime = 0.1;  // Default decay time
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