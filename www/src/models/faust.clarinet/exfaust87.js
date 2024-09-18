
/*
Code generated with Faust version 2.15.10
Compilation options: wasm-ib, -scal -ftz 2
*/

function getJSONexfaust87() {
	return '{"name": "Clarinet","filename": "exfaust87","version": "2.15.10","compile_options": "-scal -ftz 2","library_list": ["/usr/local/share/faust/stdfaust.lib","/usr/local/share/faust/physmodels.lib","/usr/local/share/faust/signals.lib","/usr/local/share/faust/noises.lib","/usr/local/share/faust/filters.lib","/usr/local/share/faust/maths.lib","/usr/local/share/faust/oscillators.lib","/usr/local/share/faust/basics.lib","/usr/local/share/faust/routes.lib","/usr/local/share/faust/delays.lib"],"include_pathnames": ["/usr/local/share/faust","/usr/local/share/faust","/usr/share/faust",".","/tmp/sessions/56E260ECEB6C89102803700E6A8040BFE66B9A8E/web/wasmjs-worklet"],"size": "278692","inputs": "0","outputs": "2","meta": [ { "basics.lib/name": "Faust Basic Element Library" },{ "basics.lib/version": "0.0" },{ "copyright": "(c)Romain Michon, CCRMA (Stanford University), GRAME" },{ "delays.lib/name": "Faust Delay Library" },{ "delays.lib/version": "0.1" },{ "description": "Simple clarinet physical model with physical parameters." },{ "filename": "exfaust87" },{ "filters.lib/name": "Faust Filters Library" },{ "filters.lib/version": "0.0" },{ "license": "MIT" },{ "maths.lib/author": "GRAME" },{ "maths.lib/copyright": "GRAME" },{ "maths.lib/license": "LGPL with exception" },{ "maths.lib/name": "Faust Math Library" },{ "maths.lib/version": "2.1" },{ "name": "Clarinet" },{ "noises.lib/name": "Faust Noise Generator Library" },{ "noises.lib/version": "0.0" },{ "oscillators.lib/name": "Faust Oscillator Library" },{ "oscillators.lib/version": "0.0" },{ "routes.lib/name": "Faust Signal Routing Library" },{ "routes.lib/version": "0.0" },{ "signals.lib/name": "Faust Signal Routing Library" },{ "signals.lib/version": "0.0" }],"ui": [ {"type": "hgroup","label": "clarinet","items": [ {"type": "vgroup","label": "blower","items": [ {"type": "hslider","label": "pressure","address": "/clarinet/blower/pressure","index": "262168","meta": [{ "0": "" }],"init": "0","min": "0","max": "1","step": "0.01"},{"type": "hslider","label": "breathGain","address": "/clarinet/blower/breathGain","index": "262180","meta": [{ "1": "" }],"init": "0.1","min": "0","max": "1","step": "0.01"},{"type": "hslider","label": "breathCutoff","address": "/clarinet/blower/breathCutoff","index": "262196","meta": [{ "2": "" }],"init": "2000","min": "20","max": "20000","step": "0.1"},{"type": "hslider","label": "vibratoFreq","address": "/clarinet/blower/vibratoFreq","index": "262228","meta": [{ "3": "" }],"init": "5","min": "0.1","max": "10","step": "0.1"},{"type": "hslider","label": "vibratoGain","address": "/clarinet/blower/vibratoGain","index": "262220","meta": [{ "4": "" }],"init": "0.25","min": "0","max": "1","step": "0.01"}]},{"type": "vgroup","label": "clarinetModel","items": [ {"type": "hslider","label": "tubeLength","address": "/clarinet/clarinetModel/tubeLength","index": "270456","meta": [{ "0": "" }],"init": "0.8","min": "0.01","max": "3","step": "0.01"},{"type": "hslider","label": "reedStiffness","address": "/clarinet/clarinetModel/reedStiffness","index": "262248","meta": [{ "1": "" }],"init": "0.5","min": "0","max": "1","step": "0.01"},{"type": "hslider","label": "bellOpening","address": "/clarinet/clarinetModel/bellOpening","index": "262156","meta": [{ "2": "" }],"init": "0.5","min": "0","max": "1","step": "0.01"},{"type": "hslider","label": "outGain","address": "/clarinet/clarinetModel/outGain","index": "262144","meta": [{ "3": "" }],"init": "0.5","min": "0","max": "1","step": "0.01"}]}]}]}';
}
function getBase64Codeexfaust87() { return "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LmxpYiIsIi91c3IvbG9jYWwvc2hhcmUvZmF1c3QvbWF0aHMubGliIiwiL3Vzci9sb2NhbC9zaGFyZS9mYXVzdC9vc2NpbGxhdG9ycy5saWIiLCIvdXNyL2xvY2FsL3NoYXJlL2ZhdXN0L2Jhc2ljcy5saWIiLCIvdXNyL2xvY2FsL3NoYXJlL2ZhdXN0L3JvdXRlcy5saWIiLCIvdXNyL2xvY2FsL3NoYXJlL2ZhdXN0L2RlbGF5cy5saWIiXSwiaW5jbHVkZV9wYXRobmFtZXMiOiBbIi91c3IvbG9jYWwvc2hhcmUvZmF1c3QiLCIvdXNyL2xvY2FsL3NoYXJlL2ZhdXN0IiwiL3Vzci9zaGFyZS9mYXVzdCIsIi4iLCIvdG1wL3Nlc3Npb25zLzU2RTI2MEVDRUI2Qzg5MTAyODAzNzAwRTZBODA0MEJGRTY2QjlBOEUvd2ViL3dhc21qcy13b3JrbGV0Il0sInNpemUiOiAiMjc4NjkyIiwiaW5wdXRzIjogIjAiLCJvdXRwdXRzIjogIjIiLCJtZXRhIjogWyB7ICJiYXNpY3MubGliL25hbWUiOiAiRmF1c3QgQmFzaWMgRWxlbWVudCBMaWJyYXJ5IiB9LHsgImJhc2ljcy5saWIvdmVyc2lvbiI6ICIwLjAiIH0seyAiY29weXJpZ2h0IjogIihjKVJvbWFpbiBNaWNob24sIENDUk1BIChTdGFuZm9yZCBVbml2ZXJzaXR5KSwgR1JBTUUiIH0seyAiZGVsYXlzLmxpYi9uYW1lIjogIkZhdXN0IERlbGF5IExpYnJhcnkiIH0seyAiZGVsYXlzLmxpYi92ZXJzaW9uIjogIjAuMSIgfSx7ICJkZXNjcmlwdGlvbiI6ICJTaW1wbGUgY2xhcmluZXQgcGh5c2ljYWwgbW9kZWwgd2l0aCBwaHlzaWNhbCBwYXJhbWV0ZXJzLiIgfSx7ICJmaWxlbmFtZSI6ICJleGZhdXN0ODciIH0seyAiZmlsdGVycy5saWIvbmFtZSI6ICJGYXVzdCBGaWx0ZXJzIExpYnJhcnkiIH0seyAiZmlsdGVycy5saWIvdmVyc2lvbiI6ICIwLjAiIH0seyAibGljZW5zZSI6ICJNSVQiIH0seyAibWF0aHMubGliL2F1dGhvciI6ICJHUkFNRSIgfSx7ICJtYXRocy5saWIvY29weXJpZ2h0IjogIkdSQU1FIiB9LHsgIm1hdGhzLmxpYi9saWNlbnNlIjogIkxHUEwgd2l0aCBleGNlcHRpb24iIH0seyAibWF0aHMubGliL25hbWUiOiAiRmF1c3QgTWF0aCBMaWJyYXJ5IiB9LHsgIm1hdGhzLmxpYi92ZXJzaW9uIjogIjIuMSIgfSx7ICJuYW1lIjogIkNsYXJpbmV0IiB9LHsgIm5vaXNlcy5saWIvbmFtZSI6ICJGYXVzdCBOb2lzZSBHZW5lcmF0b3IgTGlicmFyeSIgfSx7ICJub2lzZXMubGliL3ZlcnNpb24iOiAiMC4wIiB9LHsgIm9zY2lsbGF0b3JzLmxpYi9uYW1lIjogIkZhdXN0IE9zY2lsbGF0b3IgTGlicmFyeSIgfSx7ICJvc2NpbGxhdG9ycy5saWIvdmVyc2lvbiI6ICIwLjAiIH0seyAicm91dGVzLmxpYi9uYW1lIjogIkZhdXN0IFNpZ25hbCBSb3V0aW5nIExpYnJhcnkiIH0seyAicm91dGVzLmxpYi92ZXJzaW9uIjogIjAuMCIgfSx7ICJzaWduYWxzLmxpYi9uYW1lIjogIkZhdXN0IFNpZ25hbCBSb3V0aW5nIExpYnJhcnkiIH0seyAic2lnbmFscy5saWIvdmVyc2lvbiI6ICIwLjAiIH1dLCJ1aSI6IFsgeyJ0eXBlIjogImhncm91cCIsImxhYmVsIjogImNsYXJpbmV0IiwiaXRlbXMiOiBbIHsidHlwZSI6ICJ2Z3JvdXAiLCJsYWJlbCI6ICJibG93ZXIiLCJpdGVtcyI6IFsgeyJ0eXBlIjogImhzbGlkZXIiLCJsYWJlbCI6ICJwcmVzc3VyZSIsImFkZHJlc3MiOiAiL2NsYXJpbmV0L2Jsb3dlci9wcmVzc3VyZSIsImluZGV4IjogIjI2MjE2OCIsIm1ldGEiOiBbeyAiMCI6ICIiIH1dLCJpbml0IjogIjAiLCJtaW4iOiAiMCIsIm1heCI6ICIxIiwic3RlcCI6ICIwLjAxIn0seyJ0eXBlIjogImhzbGlkZXIiLCJsYWJlbCI6ICJicmVhdGhHYWluIiwiYWRkcmVzcyI6ICIvY2xhcmluZXQvYmxvd2VyL2JyZWF0aEdhaW4iLCJpbmRleCI6ICIyNjIxODAiLCJtZXRhIjogW3sgIjEiOiAiIiB9XSwiaW5pdCI6ICIwLjEiLCJtaW4iOiAiMCIsIm1heCI6ICIxIiwic3RlcCI6ICIwLjAxIn0seyJ0eXBlIjogImhzbGlkZXIiLCJsYWJlbCI6ICJicmVhdGhDdXRvZmYiLCJhZGRyZXNzIjogIi9jbGFyaW5ldC9ibG93ZXIvYnJlYXRoQ3V0b2ZmIiwiaW5kZXgiOiAiMjYyMTk2IiwibWV0YSI6IFt7ICIyIjogIiIgfV0sImluaXQiOiAiMjAwMCIsIm1pbiI6ICIyMCIsIm1heCI6ICIyMDAwMCIsInN0ZXAiOiAiMC4xIn0seyJ0eXBlIjogImhzbGlkZXIiLCJsYWJlbCI6ICJ2aWJyYXRvRnJlcSIsImFkZHJlc3MiOiAiL2NsYXJpbmV0L2Jsb3dlci92aWJyYXRvRnJlcSIsImluZGV4IjogIjI2MjIyOCIsIm1ldGEiOiBbeyAiMyI6ICIiIH1dLCJpbml0IjogIjUiLCJtaW4iOiAiMC4xIiwibWF4IjogIjEwIiwic3RlcCI6ICIwLjEifSx7InR5cGUiOiAiaHNsaWRlciIsImxhYmVsIjogInZpYnJhdG9HYWluIiwiYWRkcmVzcyI6ICIvY2xhcmluZXQvYmxvd2VyL3ZpYnJhdG9HYWluIiwiaW5kZXgiOiAiMjYyMjIwIiwibWV0YSI6IFt7ICI0IjogIiIgfV0sImluaXQiOiAiMC4yNSIsIm1pbiI6ICIwIiwibWF4IjogIjEiLCJzdGVwIjogIjAuMDEifV19LHsidHlwZSI6ICJ2Z3JvdXAiLCJsYWJlbCI6ICJjbGFyaW5ldE1vZGVsIiwiaXRlbXMiOiBbIHsidHlwZSI6ICJoc2xpZGVyIiwibGFiZWwiOiAidHViZUxlbmd0aCIsImFkZHJlc3MiOiAiL2NsYXJpbmV0L2NsYXJpbmV0TW9kZWwvdHViZUxlbmd0aCIsImluZGV4IjogIjI3MDQ1NiIsIm1ldGEiOiBbeyAiMCI6ICIiIH1dLCJpbml0IjogIjAuOCIsIm1pbiI6ICIwLjAxIiwibWF4IjogIjMiLCJzdGVwIjogIjAuMDEifSx7InR5cGUiOiAiaHNsaWRlciIsImxhYmVsIjogInJlZWRTdGlmZm5lc3MiLCJhZGRyZXNzIjogIi9jbGFyaW5ldC9jbGFyaW5ldE1vZGVsL3JlZWRTdGlmZm5lc3MiLCJpbmRleCI6ICIyNjIyNDgiLCJtZXRhIjogW3sgIjEiOiAiIiB9XSwiaW5pdCI6ICIwLjUiLCJtaW4iOiAiMCIsIm1heCI6ICIxIiwic3RlcCI6ICIwLjAxIn0seyJ0eXBlIjogImhzbGlkZXIiLCJsYWJlbCI6ICJiZWxsT3BlbmluZyIsImFkZHJlc3MiOiAiL2NsYXJpbmV0L2NsYXJpbmV0TW9kZWwvYmVsbE9wZW5pbmciLCJpbmRleCI6ICIyNjIxNTYiLCJtZXRhIjogW3sgIjIiOiAiIiB9XSwiaW5pdCI6ICIwLjUiLCJtaW4iOiAiMCIsIm1heCI6ICIxIiwic3RlcCI6ICIwLjAxIn0seyJ0eXBlIjogImhzbGlkZXIiLCJsYWJlbCI6ICJvdXRHYWluIiwiYWRkcmVzcyI6ICIvY2xhcmluZXQvY2xhcmluZXRNb2RlbC9vdXRHYWluIiwiaW5kZXgiOiAiMjYyMTQ0IiwibWV0YSI6IFt7ICIzIjogIiIgfV0sImluaXQiOiAiMC41IiwibWluIjogIjAiLCJtYXgiOiAiMSIsInN0ZXAiOiAiMC4wMSJ9XX1dfV19"; }

/*
 faust2wasm: GRAME 2017-2018
*/

'use strict';

if (typeof (AudioWorkletNode) === "undefined") {
	alert("AudioWorklet is not supported in this browser !")
}

class exfaust87Node extends AudioWorkletNode {

    constructor(context, baseURL, options) {

        var json_object = JSON.parse(getJSONexfaust87());

        // Setting values for the input, the output and the channel count.
        options.numberOfInputs = (parseInt(json_object.inputs) > 0) ? 1 : 0;
        options.numberOfOutputs = (parseInt(json_object.outputs) > 0) ? 1 : 0;
        options.channelCount = Math.max(1, parseInt(json_object.inputs));
        options.outputChannelCount = [parseInt(json_object.outputs)];
        options.channelCountMode = "explicit";
        options.channelInterpretation = "speakers";

        super(context, 'exfaust87', options);
        this.baseURL = baseURL;
      
        // JSON parsing functions
        this.parse_ui = function(ui, obj)
        {
            for (var i = 0; i < ui.length; i++) {
                this.parse_group(ui[i], obj);
            }
        }

        this.parse_group = function(group, obj)
        {
            if (group.items) {
                this.parse_items(group.items, obj);
            }
        }

        this.parse_items = function(items, obj)
        {
            for (var i = 0; i < items.length; i++) {
            	this.parse_item(items[i], obj);
            }
        }

        this.parse_item = function(item, obj)
        {
            if (item.type === "vgroup"
                || item.type === "hgroup"
                || item.type === "tgroup") {
                this.parse_items(item.items, obj);
            } else if (item.type === "hbargraph"
                       || item.type === "vbargraph") {
                // Keep bargraph adresses
                obj.outputs_items.push(item.address);
            } else if (item.type === "vslider"
                       || item.type === "hslider"
                       || item.type === "button"
                       || item.type === "checkbox"
                       || item.type === "nentry") {
                // Keep inputs adresses
                obj.inputs_items.push(item.address);
                obj.descriptor.push(item);
                // Decode MIDI
                if (item.meta !== undefined) {
                    for (var i = 0; i < item.meta.length; i++) {
                        if (item.meta[i].midi !== undefined) {
                            if (item.meta[i].midi.trim() === "pitchwheel") {
                                obj.fPitchwheelLabel.push(item.address);
                            } else if (item.meta[i].midi.trim().split(" ")[0] === "ctrl") {
                                obj.fCtrlLabel[parseInt(item.meta[i].midi.trim().split(" ")[1])]
                                .push({ path:item.address,
                                      min:parseFloat(item.min),
                                      max:parseFloat(item.max) });
                            }
                        }
                    }
                }      
                // Define setXXX/getXXX, replacing '/c' with 'C' everywhere in the string
                var set_name = "set" + item.address;
                var get_name = "get" + item.address;
                set_name = set_name.replace(/\/./g, (x) => { return x.substr(1,1).toUpperCase(); });     
                get_name = get_name.replace(/\/./g, (x) => { return x.substr(1,1).toUpperCase(); });
                obj[set_name] = (val) => { obj.setParamValue(item.address, val); };
                obj[get_name] = () => { return obj.getParamValue(item.address); };
                //console.log(set_name);
                //console.log(get_name);
            }
        }

        this.output_handler = null;

        this.json_object = json_object;

        // input/output items
        this.inputs_items = [];
        this.outputs_items = [];
        this.descriptor = [];
        
        // MIDI
        this.fPitchwheelLabel = [];
        this.fCtrlLabel = new Array(128);
        for (var i = 0; i < this.fCtrlLabel.length; i++) { this.fCtrlLabel[i] = []; }

        // Parse UI
        this.parse_ui(this.json_object.ui, this);

        // Set message handler
        this.port.onmessage = this.handleMessage.bind(this);
    }

    // To be called by the message port with messages coming from the processor
    handleMessage(event)
    {
        var msg = event.data;
        if (this.output_handler) {
            this.output_handler(msg.path, msg.value);
        }
    }

    // Public API

    /**
     *  Returns a full JSON description of the DSP.
     */
    getJSON()
    {
        return getJSONexfaust87();
    }
    
    // For WAP
    async getMetadata() 
    {
        return new Promise(resolve => {
            let real_url = (this.baseURL === "") ? "main.json" : (this.baseURL + "/main.json");
            fetch(real_url).then(responseJSON => {
            	return responseJSON.json();
        	}).then(json => {
        		resolve(json);
        	})
    	});
    }

    /**
     *  Set the control value at a given path.
     *
     * @param path - a path to the control
     * @param val - the value to be set
     */
    setParamValue(path, val)
    {
        // Needed for sample accurate control
        this.parameters.get(path).setValueAtTime(val, 0);
    }
    
    // For WAP
    setParam(path, val)
    {
        // Needed for sample accurate control
        this.parameters.get(path).setValueAtTime(val, 0);
    }

    /**
     *  Get the control value at a given path.
     *
     * @return the current control value
     */
    getParamValue(path)
    {
        return this.parameters.get(path).value;
    }
    
    // For WAP
    getParam(path) 
    {
        return this.parameters.get(path).value;
    }

    /**
     * Setup a control output handler with a function of type (path, value)
     * to be used on each generated output value. This handler will be called
     * each audio cycle at the end of the 'compute' method.
     *
     * @param handler - a function of type function(path, value)
     */
    setOutputParamHandler(handler)
    {
        this.output_handler = handler;
    }

    /**
     * Get the current output handler.
     */
    getOutputParamHandler()
    {
        return this.output_handler;
    }

    getNumInputs()
    {
        return parseInt(this.json_object.inputs);
    }

    getNumOutputs()
    {
        return parseInt(this.json_object.outputs);
    }
    
    // For WAP
    inputChannelCount() 
    {
        return parseInt(this.json_object.inputs);
    }

    outputChannelCount() 
    {
        return parseInt(this.json_object.outputs);
    }

    /**
     * Returns an array of all input paths (to be used with setParamValue/getParamValue)
     */
    getParams()
    {
        return this.inputs_items;
    }
    
    // For WAP
    getDescriptor() 
    {
        var desc = {};
        for (const item in this.descriptor) {
            if (this.descriptor.hasOwnProperty(item)) {
                if (this.descriptor[item].label != "bypass") {
                    desc = Object.assign({ [this.descriptor[item].label]: { minValue: this.descriptor[item].min, maxValue: this.descriptor[item].max, defaultValue: this.descriptor[item].init } }, desc);
                }
            }
        }
        return desc;
    }

    /**
     * Control change
     *
     * @param channel - the MIDI channel (0..15, not used for now)
     * @param ctrl - the MIDI controller number (0..127)
     * @param value - the MIDI controller value (0..127)
     */
    ctrlChange(channel, ctrl, value)
    {
        if (this.fCtrlLabel[ctrl] !== []) {
            for (var i = 0; i < this.fCtrlLabel[ctrl].length; i++) {
                var path = this.fCtrlLabel[ctrl][i].path;
                this.setParamValue(path, exfaust87Node.remap(value, 0, 127, this.fCtrlLabel[ctrl][i].min, this.fCtrlLabel[ctrl][i].max));
                if (this.output_handler) {
                    this.output_handler(path, this.getParamValue(path));
                }
            }
        }
    }

    /**
     * PitchWeel
     *
     * @param channel - the MIDI channel (0..15, not used for now)
     * @param value - the MIDI controller value (-1..1)
     */
    pitchWheel(channel, wheel)
    {
        for (var i = 0; i < this.fPitchwheelLabel.length; i++) {
            var path = this.fPitchwheelLabel[i];
            this.setParamValue(path, Math.pow(2.0, wheel/12.0));
            if (this.output_handler) {
                this.output_handler(path, this.getParamValue(path));
            }
        }
    }

    /**
     * Generic MIDI message handler.
     */
    midiMessage(data)
    {
        var cmd = data[0] >> 4;
        var channel = data[0] & 0xf;
        var data1 = data[1];
        var data2 = data[2];
        
        if (channel === 9) {
            return;
        } else if (cmd === 11) {
            this.ctrlChange(channel, data1, data2);
        } else if (cmd === 14) {
            this.pitchWheel(channel, ((data2 * 128.0 + data1)-8192)/8192.0);
        }
    }
    
    // For WAP
    onMidi(data) 
    {
     	midiMessage(data);
    }
    
    /**
     * @returns {Object} describes the path for each available param and its current value
     */
    async getState() 
    {
        var params = new Object();
        for (let i = 0; i < this.getParams().length; i++) {
            Object.assign(params, { [this.getParams()[i]]: `${this.getParam(this.getParams()[i])}` });
        }
        return new Promise(resolve => { resolve(params) });
    }

    /**
     * Sets each params with the value indicated in the state object
     * @param {Object} state 
     */
    async setState(state) 
    {
        return new Promise(resolve => {
            for (const param in state) {
                if (state.hasOwnProperty(param)) this.setParam(param, state[param]);
            }
            try {
                this.gui.setAttribute('state', JSON.stringify(state));
            } catch (error) {
                console.warn("Plugin without gui or GUI not defined", error);
            }
            resolve(state);
        })
    }
    
    /**
     * A different call closer to the preset management
     * @param {Object} patch to assign as a preset to the node
     */
    setPatch(patch) 
    {
        this.setState(this.presets[patch])
    }
    
    static remap(v, mn0, mx0, mn1, mx1)
    {
        return (1.0 * (v - mn0) / (mx0 - mn0)) * (mx1 - mn1) + mn1;
    }
    
    // Loads a sample and decode it
    static loadAudioSample(context, url)
    {
        return new Promise(function(resolve, reject) {
                           fetch(url)
                           .then((response) => {
                                 return response.arrayBuffer();
                                 })
                           .then((buffer) => {
                                 context.decodeAudioData(buffer, (decodedAudioData) => {
                                                         resolve(decodedAudioData);
                                                         });
                                 });
                           });
    }
    
    
    
    // Loads a sample
    static loadSample(url)
    {
        return new Promise(function(resolve, reject) {
                           fetch(url)
                           .then((response) => {
                                 resolve (response.arrayBuffer());
                                 })
                           });
    }
    
}

// Factory class
export default class exfaust87 {

    /**
     * Factory constructor.
     *
     * @param context - the audio context
     * @param baseURL - the baseURL of the plugin folder
     */
    constructor(context, baseURL = "")
    {
    	// Resume audio context each time...
    	context.resume();
    	
    	console.log("baseLatency " + context.baseLatency);
    	console.log("outputLatency " + context.outputLatency);
    	console.log("sampleRate " + context.sampleRate);
    	
        this.context = context;
        this.baseURL = baseURL;
        
        this.pathTable = [];
        
        // soundfile items
        this.soundfile_items = [];
    }
    
    // JSON parsing functions
    parse_ui(ui)
    {
        for (var i = 0; i < ui.length; i++) {
            this.parse_group(ui[i]);
        }
    }
    
    parse_group(group)
    {
        if (group.items) {
            this.parse_items(group.items);
        }
    }
    
    parse_items(items)
    {
        for (var i = 0; i < items.length; i++) {
            this.parse_item(items[i]);
        }
    }
    
    parse_item(item)
    {
        if (item.type === "vgroup"
            || item.type === "hgroup"
            || item.type === "tgroup") {
            this.parse_items(item.items);
        } else if (item.type === "soundfile") {
            // Keep soundfile adresses
            this.soundfile_items.push(item.address);
            this.pathTable[item.address] = parseInt(item.index);
        }
    }
  
    /**
     * Load additionnal resources to prepare the custom AudioWorkletNode. Returns a promise to be used with the created node.
     */
    load()
    {
    	return new Promise((resolve, reject) => {   
            let real_url = (this.baseURL === "") ? "exfaust87-processor.js" : (this.baseURL + "/exfaust87-processor.js");
            this.context.audioWorklet.addModule(real_url).then(() => {
            this.node = new exfaust87Node(this.context, this.baseURL, {});
            this.node.onprocessorerror = () => { console.log('An error from exfaust87-processor was detected.');}
            return (this.node);
            }).then((node) => {
                resolve(node);
            }).catch((e) => {
                reject(e);
            });
        });
    }
    
    loadGui() 
    {
        return new Promise((resolve, reject) => {
            try {
                // DO THIS ONLY ONCE. If another instance has already been added, do not add the html file again
                let real_url = (this.baseURL === "") ? "main.html" : (this.baseURL + "/main.html");
                if (!this.linkExists(real_url)) {
                    // LINK DOES NOT EXIST, let's add it to the document
                    var link = document.createElement('link');
                    link.rel = 'import';
                    link.href = real_url;
                    document.head.appendChild(link);
                    link.onload = (e) => {
                        // the file has been loaded, instanciate GUI
                        // and get back the HTML elem
                        // HERE WE COULD REMOVE THE HARD CODED NAME
                        var element = createexfaust87GUI(this.node);
                        resolve(element);
                    }
                } else {
                    // LINK EXIST, WE AT LEAST CREATED ONE INSTANCE PREVIOUSLY
                    // so we can create another instance
                    var element = createexfaust87GUI(this.node);
                    resolve(element);
                }
            } catch (e) {
                console.log(e);
                reject(e);
            }
        });
    };

	linkExists(url) 
	{
    	return document.querySelectorAll(`link[href="${url}"]`).length > 0;
   	}

}

    

