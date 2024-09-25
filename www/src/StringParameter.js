export class StringParameter {
    constructor(name, defaultValue) {
        this.name = name;
        this.value = defaultValue;
    }

    set(value) {
        this.value = value;
    }

    get() {
        return this.value;
    }

    // Method to identify this as a string parameter
    isStringParameter() {
        return true;
    }
}
