class ChuaProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'alpha', defaultValue: -6.7114, minValue: -1100, maxValue: 100 },
            { name: 'beta', defaultValue: -1.52, minValue: -250, maxValue: 250 },
            { name: 'gamma', defaultValue: 0, minValue: -4, maxValue: 4 },
            { name: 'm0', defaultValue: -1.14, minValue: -10, maxValue: 5 },
            { name: 'm1', defaultValue: -0.714, minValue: -150, maxValue: 5 },
            { name: 'mk', defaultValue: 1, minValue: -1, maxValue: 1 },
            { name: 'tscale', defaultValue: 1000, minValue: 0, maxValue: 100000 },
            { name: 'active', defaultValue: 0, minValue: 0, maxValue: 1 }
        ];
    }

    constructor(options) {
        super();
        this.sampleRate = options.processorOptions.sampleRate;
        this.dt = 1 / this.sampleRate;

        // Fixed initial conditions, matching DSChua.py's own defaults (x0=.1, y0=0, z0=0).
        this.x = 0.1;
        this.y = 0;
        this.z = 0;
        this.silenced = false; // true once the trajectory has diverged to non-finite values

        this.port.onmessage = (event) => {
            if (event.data.action === 'start') {
                this.x = 0.1;
                this.y = 0;
                this.z = 0;
                this.silenced = false;
            }
        };
    }

    nonlin(x, m0, m1) {
        return m1 * x + ((m0 - m1) * (Math.abs(x + 1) - Math.abs(x - 1))) / 2;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channel = output[0];

        if (parameters.active[0] === 0 || this.silenced) {
            channel.fill(0);
            return true;
        }

        const alpha = parameters.alpha[0];
        const beta = parameters.beta[0];
        const gamma = parameters.gamma[0];
        const m0 = parameters.m0[0];
        const m1 = parameters.m1[0];
        const mk = parameters.mk[0];
        const tscale = parameters.tscale[0];
        const dt = this.dt;

        // Euler-integrated dimensionless Chua oscillator (DSChua.py: dU_dt).
        const LIMIT = 1e6; // guards against divergence for unstable parameter sets

        for (let i = 0; i < channel.length; i++) {
            const dx = tscale * mk * (alpha * (this.y - this.x - this.nonlin(this.x, m0, m1)));
            const dy = tscale * mk * (this.x - this.y + this.z);
            const dz = -tscale * mk * (beta * this.y + gamma * this.z);

            const nx = this.x + dt * dx;
            const ny = this.y + dt * dy;
            const nz = this.z + dt * dz;

            if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) {
                // Diverged to NaN/Infinity -- the LIMIT clamp below can't filter NaN
                // (Math.min/Math.max with a NaN operand return NaN), so stop here and
                // go silent rather than let NaN poison the state forever.
                this.silenced = true;
                channel.fill(0, i);
                return true;
            }

            this.x = Math.max(-LIMIT, Math.min(LIMIT, nx));
            this.y = Math.max(-LIMIT, Math.min(LIMIT, ny));
            this.z = Math.max(-LIMIT, Math.min(LIMIT, nz));

            channel[i] = Math.tanh(this.x);
        }

        return true;
    }
}

registerProcessor('chuaProcessor', ChuaProcessor);
