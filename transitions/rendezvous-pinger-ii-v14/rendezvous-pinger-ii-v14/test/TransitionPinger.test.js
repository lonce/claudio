import assert from 'node:assert/strict';
import {
    CHORD_INTERVALS,
    frequenciesForChord,
    jitterFrequencies
} from '../soundModels/RendezvousPinger/_TransitionPinger.js';

assert.equal(CHORD_INTERVALS.length, 4);

const major = frequenciesForChord(220, 0);
assert.equal(major.length, 3);
assert.ok(Math.abs(major[0] - 220) < 1e-12);
assert.ok(Math.abs(major[1] - 277.1826309768721) < 1e-10);
assert.ok(Math.abs(major[2] - 329.6275569128699) < 1e-10);

const roundedMinor = frequenciesForChord(220, 0.7);
assert.ok(Math.abs(roundedMinor[1] - 261.6255653005986) < 1e-10);

const upwardJitter = jitterFrequencies([100, 200, 300], 0.005, () => 1);
upwardJitter.forEach((frequency, index) => {
    assert.ok(Math.abs(frequency - [100.5, 201, 301.5][index]) < 1e-10);
});

const downwardJitter = jitterFrequencies([100, 200], 0.005, () => 0);
downwardJitter.forEach((frequency, index) => {
    assert.ok(Math.abs(frequency - [99.5, 199][index]) < 1e-10);
});

console.log('TransitionPinger chord tests passed.');
