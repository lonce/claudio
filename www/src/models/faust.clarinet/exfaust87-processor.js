
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

// Monophonic Faust DSP
class exfaust87Processor extends AudioWorkletProcessor {
    
    // JSON parsing functions
    static parse_ui(ui, obj, callback)
    {
        for (var i = 0; i < ui.length; i++) {
            exfaust87Processor.parse_group(ui[i], obj, callback);
        }
    }
    
    static parse_group(group, obj, callback)
    {
        if (group.items) {
            exfaust87Processor.parse_items(group.items, obj, callback);
        }
    }
    
    static parse_items(items, obj, callback)
    {
        for (var i = 0; i < items.length; i++) {
            callback(items[i], obj, callback);
        }
    }
    
    static parse_item1(item, obj, callback)
    {
        if (item.type === "vgroup"
            || item.type === "hgroup"
            || item.type === "tgroup") {
            exfaust87Processor.parse_items(item.items, obj, callback);
        } else if (item.type === "hbargraph"
                   || item.type === "vbargraph") {
            // Nothing
        } else if (item.type === "vslider"
                   || item.type === "hslider"
                   || item.type === "button"
                   || item.type === "checkbox"
                   || item.type === "nentry") {
            obj.push({ name: item.address,
                     defaultValue: item.init,
                     minValue: item.min,
                     maxValue: item.max });
        }
    }
    
    static parse_item2(item, obj, callback)
    {
        if (item.type === "vgroup"
            || item.type === "hgroup"
            || item.type === "tgroup") {
            exfaust87Processor.parse_items(item.items, obj, callback);
        } else if (item.type === "hbargraph"
                   || item.type === "vbargraph") {
            // Keep bargraph adresses
            obj.outputs_items.push(item.address);
            obj.pathTable[item.address] = parseInt(item.index);
        } else if (item.type === "soundfile") {
            // Keep soundfile adresses
            obj.soundfile_items.push(item.address);
            obj.pathTable[item.address] = parseInt(item.index);
        } else if (item.type === "vslider"
                   || item.type === "hslider"
                   || item.type === "button"
                   || item.type === "checkbox"
                   || item.type === "nentry") {
            // Keep inputs adresses
            obj.inputs_items.push(item.address);
            obj.pathTable[item.address] = parseInt(item.index);
        }
    }
    
    static b64ToUint6(nChr)
    {
        return nChr > 64 && nChr < 91 ?
        nChr - 65
        : nChr > 96 && nChr < 123 ?
        nChr - 71
        : nChr > 47 && nChr < 58 ?
        nChr + 4
        : nChr === 43 ?
        62
        : nChr === 47 ?
        63
        :
        0;
    }
    
    static atob(sBase64, nBlocksSize)
    {
        if (typeof atob === 'function') {
            return atob(sBase64);
        } else {
            
            var sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, "");
            var nInLen = sB64Enc.length;
            var nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2;
            var taBytes = new Uint8Array(nOutLen);
            
            for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
                nMod4 = nInIdx & 3;
                nUint24 |= exfaust87Processor.b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
                if (nMod4 === 3 || nInLen - nInIdx === 1) {
                    for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
                        taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
                    }
                    nUint24 = 0;
                }
            }
            return taBytes.buffer;
        }
    }
   
    static get parameterDescriptors() 
    {
        // Analyse JSON to generate AudioParam parameters
        var params = [];
        exfaust87Processor.parse_ui(JSON.parse(getJSONexfaust87()).ui, params, exfaust87Processor.parse_item1);
        return params;
    }
    
    constructor(options)
    {
        super(options);
      
        this.json_object = JSON.parse(getJSONexfaust87());

        this.output_handler = function(path, value) { this.port.postMessage({ path: path, value: value }); };
        
        this.ins = null;
        this.outs = null;

        this.dspInChannnels = [];
        this.dspOutChannnels = [];

        this.numIn = parseInt(this.json_object.inputs);
        this.numOut = parseInt(this.json_object.outputs);

        // Memory allocator
        this.ptr_size = 4;
        this.sample_size = 4;
        this.integer_size = 4;
        
        this.exfaust87_instance = new WebAssembly.Instance(exfaust87Processor.wasm_module, exfaust87Processor.importObject);
  	   	this.factory = this.exfaust87_instance.exports;
        this.HEAP = this.exfaust87_instance.exports.memory.buffer;
        this.HEAP32 = new Int32Array(this.HEAP);
        this.HEAPF32 = new Float32Array(this.HEAP);

        //console.log(this.HEAP);
        //console.log(this.HEAP32);
        //console.log(this.HEAPF32);

        // bargraph
        this.outputs_timer = 5;
        this.outputs_items = [];

        // input items
        this.inputs_items = [];
        
        // soundfile items
        this.soundfile_items = [];

        // Start of HEAP index

        // DSP is placed first with index 0. Audio buffer start at the end of DSP.
        this.audio_heap_ptr = parseInt(this.json_object.size);

        // Setup pointers offset
        this.audio_heap_ptr_inputs = this.audio_heap_ptr;
        this.audio_heap_ptr_outputs = this.audio_heap_ptr_inputs + (this.numIn * this.ptr_size);

        // Setup buffer offset
        this.audio_heap_inputs = this.audio_heap_ptr_outputs + (this.numOut * this.ptr_size);
        this.audio_heap_outputs = this.audio_heap_inputs + (this.numIn * exfaust87Processor.buffer_size * this.sample_size);
        
        // Start of DSP memory : DSP is placed first with index 0
        this.dsp = 0;

        this.pathTable = [];
     
        // Send output values to the AudioNode
        this.update_outputs = function ()
        {
            if (this.outputs_items.length > 0 && this.output_handler && this.outputs_timer-- === 0) {
                this.outputs_timer = 5;
                for (var i = 0; i < this.outputs_items.length; i++) {
                    this.output_handler(this.outputs_items[i], this.HEAPF32[this.pathTable[this.outputs_items[i]] >> 2]);
                }
            }
        }
        
        this.loadFile = function (sound_index, sound_ptr, length, sample_rate, channels, buffers)
        {
            /*
             Soundfile layout:
            
                FAUSTFLOAT** fBuffers;
                int fLength;
                int fSampleRate;
                int fChannels;
             
                ===========
                Soundfile struct
                fBuffers[channels]
                fBuffers0
                fBuffers1
                ...
                Soundfile struct
                fBuffers[channels]
                fBuffers0
                fBuffers1
                ...
                ===========
            */
            
            var size_of_soundfile = this.ptr_size + (this.integer_size * 3);  // fBuffers, fLength, fSampleRate, fChannels
            
            //console.log("sound_ptr " + sound_ptr);
            //console.log("size_of_soundfile " + size_of_soundfile);
            
            // end of sounfile
            var end_of_soundfile_ptr = sound_ptr + size_of_soundfile;
            
            this.HEAP32[sound_ptr >> 2] = end_of_soundfile_ptr;
            this.HEAP32[(sound_ptr + 4) >> 2] = length;      // fLength
            this.HEAP32[(sound_ptr + 8) >> 2] = sample_rate; // fSampleRate
            this.HEAP32[(sound_ptr + 12) >> 2] = channels;   // fChannels
            
            //console.log("end_of_soundfile_ptr " + end_of_soundfile_ptr);
            
            // Setup soundfile pointers
            var start_of_soundfile_data_ptr = end_of_soundfile_ptr + this.ptr_size * channels;
            
            for (var i = 0; i < channels; i++) {
                this.HEAP32[(end_of_soundfile_ptr + (i * this.ptr_size)) >> 2] = start_of_soundfile_data_ptr + (i * length * this.sample_size);
            }
            
            // Setup soundfile buffer
            for (var i = 0; i < channels; i++) {
                
                // start of sound buffer
                var start_of_buffer_ptr = start_of_soundfile_data_ptr + (i * length * this.sample_size);
                
                // generate a 440 Hz signal
                for (var j = 0; j < length; j++) {
                    this.HEAPF32[(start_of_buffer_ptr + (j * this.sample_size)) >> 2] = 0.8 * Math.sin((j/length)*2*Math.PI);
                }
            }
            
            // Setup fSoundfile fields in the DSP structure
            //console.log("sound_index " + sound_index);
            //console.log("this.pathTable[this.soundfile_items[sound_index]] " + this.pathTable[this.soundfile_items[sound_index]]);
            
            this.HEAP32[this.pathTable[this.soundfile_items[sound_index]] >> 2] = sound_ptr;
            
            /*
            console.log("start_of_soundfile_data_ptr " + start_of_soundfile_data_ptr);
            console.log("length " + length);
            console.log("channels " + channels);
            console.log("this.sample_size " + this.sample_size);
            console.log("END " + (start_of_soundfile_data_ptr + (channels * length * this.sample_size)));
            */
            
            // End of buffer data;
            return start_of_soundfile_data_ptr + (channels * length * this.sample_size);
        }
        
        this.initAux = function ()
        {
            var i;
            
            if (this.numIn > 0) {
                this.ins = this.audio_heap_ptr_inputs;
                for (i = 0; i < this.numIn; i++) {
                    this.HEAP32[(this.ins >> 2) + i] = this.audio_heap_inputs + ((exfaust87Processor.buffer_size * this.sample_size) * i);
                }
                
                // Prepare Ins buffer tables
                var dspInChans = this.HEAP32.subarray(this.ins >> 2, (this.ins + this.numIn * this.ptr_size) >> 2);
                for (i = 0; i < this.numIn; i++) {
                    this.dspInChannnels[i] = this.HEAPF32.subarray(dspInChans[i] >> 2, (dspInChans[i] + exfaust87Processor.buffer_size * this.sample_size) >> 2);
                }
            }
            
            if (this.numOut > 0) {
                this.outs = this.audio_heap_ptr_outputs;
                for (i = 0; i < this.numOut; i++) {
                    this.HEAP32[(this.outs >> 2) + i] = this.audio_heap_outputs + ((exfaust87Processor.buffer_size * this.sample_size) * i);
                }
                
                // Prepare Out buffer tables
                var dspOutChans = this.HEAP32.subarray(this.outs >> 2, (this.outs + this.numOut * this.ptr_size) >> 2);
                for (i = 0; i < this.numOut; i++) {
                    this.dspOutChannnels[i] = this.HEAPF32.subarray(dspOutChans[i] >> 2, (dspOutChans[i] + exfaust87Processor.buffer_size * this.sample_size) >> 2);
                }
            }
            
            // Parse UI
            exfaust87Processor.parse_ui(this.json_object.ui, this, exfaust87Processor.parse_item2);
            
            /*
            console.log("soundfile_items.length " + this.soundfile_items.length);
            
            // Setup soundfile offset (after audio data)
            this.soundfile_ptr = this.audio_heap_outputs + (this.numOut * exfaust87Processor.buffer_size * this.sample_size);
            
            var sound_ptr1 = this.soundfile_ptr;
            var sound_ptr2 = this.loadFile(0, sound_ptr1, 44100/700, 44100, 2, null);
            var sound_ptr3 = this.loadFile(1, sound_ptr2, 44100/500, 44100, 2, null);
            */
             
            // Init DSP
            this.factory.init(this.dsp, sampleRate); // 'sampleRate' is defined in AudioWorkletGlobalScope  
        }

        this.setParamValue = function (path, val)
        {
            this.HEAPF32[this.pathTable[path]] = val;
        }

        this.getParamValue = function (path)
        {
            return this.HEAPF32[this.pathTable[path]];
        }

        // Init resulting DSP
        this.initAux();
    }
    
    process(inputs, outputs, parameters) 
    {
        var input = inputs[0];
        var output = outputs[0];
        
        // Check inputs
        if (this.numIn > 0 && ((input === undefined) || (input[0].length === 0))) {
            //console.log("Process input error");
            return true;
        }
        // Check outputs
        if (this.numOut > 0 && ((output === undefined) || (output[0].length === 0))) {
            //console.log("Process output error");
            return true;
        }
        
        // Copy inputs
        if (input !== undefined) {
            for (var chan = 0; chan < Math.min(this.numIn, input.length) ; ++chan) {
                var dspInput = this.dspInChannnels[chan];
                dspInput.set(input[chan]);
            }
        }
        
        /*
        TODO: sample accurate control change is not yet handled
        When no automation occurs, params[i][1] has a length of 1,
        otherwise params[i][1] has a length of 128 with possible control change each sample
    	*/
        
        // Update controls
        var params = Object.entries(parameters);
        for (var i = 0; i < params.length; i++) {
            this.HEAPF32[this.pathTable[params[i][0]] >> 2] = params[i][1][0];
        }
        
        // Compute
        this.factory.compute(this.dsp, exfaust87Processor.buffer_size, this.ins, this.outs);
        
        // Update bargraph
        this.update_outputs();
        
        // Copy outputs
        if (output !== undefined) {
            for (var chan = 0; chan < Math.min(this.numOut, output.length); ++chan) {
                var dspOutput = this.dspOutChannnels[chan];
                output[chan].set(dspOutput);
            }
        }
        
        return true;
    }
}

// Globals
exfaust87Processor.buffer_size = 128;

exfaust87Processor.importObject = {
    env: {
        memoryBase: 0,
        tableBase: 0,
            
        // Integer version
        _abs: Math.abs,
        
        // Float version
        _acosf: Math.acos,
        _asinf: Math.asin,
        _atanf: Math.atan,
        _atan2f: Math.atan2,
        _ceilf: Math.ceil,
        _cosf: Math.cos,
        _expf: Math.exp,
        _floorf: Math.floor,
        _fmodf: function(x, y) { return x % y; },
        _logf: Math.log,
        _log10f: Math.log10,
        _max_f: Math.max,
        _min_f: Math.min,
        _remainderf: function(x, y) { return x - Math.round(x/y) * y; },
        _powf: Math.pow,
        _roundf: Math.fround,
        _sinf: Math.sin,
        _sqrtf: Math.sqrt,
        _tanf: Math.tan,
           
        // Double version
        _acos: Math.acos,
        _asin: Math.asin,
        _atan: Math.atan,
        _atan2: Math.atan2,
        _ceil: Math.ceil,
        _cos: Math.cos,
        _exp: Math.exp,
        _floor: Math.floor,
        _fmod: function(x, y) { return x % y; },
        _log: Math.log,
        _log10: Math.log10,
        _max_: Math.max,
        _min_: Math.min,
        _remainder:function(x, y) { return x - Math.round(x/y) * y; },
        _pow: Math.pow,
        _round: Math.fround,
        _sin: Math.sin,
        _sqrt: Math.sqrt,
        _tan: Math.tan,
        
        table: new WebAssembly.Table({ initial: 0, element: 'anyfunc' })
    }
};

// Synchronously compile and instantiate the WASM module
try {
    if (exfaust87Processor.wasm_module == undefined) {
        exfaust87Processor.wasm_module = new WebAssembly.Module(exfaust87Processor.atob(getBase64Codeexfaust87()));
        registerProcessor('exfaust87', exfaust87Processor);
    }
} catch (e) {
    console.log(e); console.log("Faust exfaust87 cannot be loaded or compiled");
}

