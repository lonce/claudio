import { BaseSound } from '../BaseSound.js';
import FaustFactory from "./faust.clarinet/exfaust87.js";
import parse_faust_ui from '../fausthelper.js';


export class FaustClarinet extends BaseSound {
    constructor(context, name) {
        super(context, name);
        this.gainNode = this.context.createGain();
        this.outputNode = this.gainNode;
        //this.ffact = new FaustFactory(this.context, 'https://172.18.0.1:8221/src/models/faust.clarinet');
        this.ffact = new FaustFactory(this.context, '/src/models/faust.clarinet');
        this.faustNode = null;
        this.faustParams = new Map(); // To store Faust parameter info

        const initialGain=.25;
        this.addParameter('gain', initialGain, 0, 1);
        this.addParameter('note', 60, 21, 108); // MIDI note range from A0 to C8
        this.addParameter('pressure', 0.6, 0.01, 1); // Add pressure with initial value

        // Set the initial gain value on the gainNode
        this.gainNode.gain.setValueAtTime(initialGain, this.context.currentTime);


        this.initPromise = this.initialize();    }

    async initialize() {
        try {
            await this.ffact.load();
            this.faustNode = await this.ffact.load();
            const pui = parse_faust_ui(this.faustNode.descriptor);

            for (let i = 0; i < pui.length; i++) {
                if (pui[i].label !== "gate" && pui[i].label !== "gain" ) {
                    // If the parameter is not already added, add it AND dont addParam(tubeLength) cause 'note' controls it
                    if (!this.getParameter(pui[i].label) && pui[i].label !== "tubeLength") {
                        this.addParameter(pui[i].label, pui[i].value, pui[i].min, pui[i].max);
                    }
                    this.faustParams.set(pui[i].label, {
                        address: pui[i].address,
                        min: pui[i].min,
                        max: pui[i].max
                    });
                }
            }

            this.faustNode.connect(this.gainNode);
        } catch (error) {
            console.error("Failed to initialize FaustClarinet:", error);
        }
    }

    startSound() {
        const pressureParam = this.getParameter('pressure');
        if (pressureParam) {
            this.faustNode.setParamValue(this.faustParams.get('pressure').address, pressureParam.get());
        }

    }

    stopSound() {
        const pressureParam = this.faustParams.get('pressure');
        if (pressureParam) {
            this.faustNode.setParamValue(pressureParam.address, 0);
        }
    }

    updateParameter(name) {
        const param = this.getParameter(name);
        if (!param) return;

        if (name === 'gain') {
            this.gainNode.gain.setValueAtTime(param.get(), this.context.currentTime);
        } else if (name === 'note') {
            const noteNum = param.get();
            const tubeLength = 1.295 * Math.pow(2, -(noteNum - 60) / 12);
            const tubeLengthParam = this.faustParams.get('tubeLength');
            if (tubeLengthParam) {
                this.faustNode.setParamValue(tubeLengthParam.address, tubeLength);
            }
        } else {
            const faustParam = this.faustParams.get(name);
            if (faustParam) {
                this.faustNode.setParamValue(faustParam.address, param.get());
            } else {
                console.warn(`Unknown parameter: ${name}`);
            }
        }
    }

    // Optional: implement custom release behavior
    release() {
        this.stopSound();
        // Add any additional release behavior here
        super.release();
    }
}
