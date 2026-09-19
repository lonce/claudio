import test from 'node:test';
import assert from 'node:assert/strict';
import { EnergyAccumulator } from '../EnergyAccumulator.js';

test('starts at zero energy with no drive', () => {
    const acc = new EnergyAccumulator(48000);
    acc.setDecaySeconds(0.35);
    assert.equal(acc.energy, 0);
    for (let i = 0; i < 1000; i++) assert.equal(acc.tick(0), 0);
});

test('an impulse raises energy, which then decays toward zero', () => {
    const acc = new EnergyAccumulator(48000, { maxEnergy: 10 });
    acc.setDecaySeconds(0.1);
    acc.injectImpulse(1);
    const afterImpulse = acc.tick(0);
    assert.ok(afterImpulse > 0.9, `expected the impulse to land close to 1, got ${afterImpulse}`);

    let last = afterImpulse;
    for (let i = 0; i < 48000; i++) { // 1 second, no drive
        const next = acc.tick(0);
        assert.ok(next <= last + 1e-12, 'energy should be monotonically non-increasing with no drive');
        last = next;
    }
    assert.ok(last < 1e-3, `expected energy to have decayed near zero, got ${last}`);
});

test('decay is sample-rate independent: same wall-clock time, same fraction remaining', () => {
    const decaySeconds = 0.2;
    const durationSeconds = 0.2; // exactly one time constant

    const lowRate = 24000;
    const accLow = new EnergyAccumulator(lowRate, { maxEnergy: 10 });
    accLow.setDecaySeconds(decaySeconds);
    accLow.injectImpulse(1);
    let energyLow = 0;
    for (let i = 0; i < Math.round(durationSeconds * lowRate); i++) {
        energyLow = accLow.tick(0);
    }

    const highRate = 96000;
    const accHigh = new EnergyAccumulator(highRate, { maxEnergy: 10 });
    accHigh.setDecaySeconds(decaySeconds);
    accHigh.injectImpulse(1);
    let energyHigh = 0;
    for (let i = 0; i < Math.round(durationSeconds * highRate); i++) {
        energyHigh = accHigh.tick(0);
    }

    // Both should have decayed to ~1/e of their post-impulse value after one
    // time constant, regardless of sample rate.
    assert.ok(
        Math.abs(energyLow - energyHigh) < 0.01,
        `expected sample-rate-independent decay, got ${energyLow} vs ${energyHigh}`
    );
    assert.ok(Math.abs(energyLow - 1 / Math.E) < 0.02, `expected ~1/e, got ${energyLow}`);
});

test('continuous drive injects the same total energy per second regardless of sample rate', () => {
    const driveScale = 8;
    const seconds = 0.5;

    const lowRate = 24000;
    const accLow = new EnergyAccumulator(lowRate, { maxEnergy: 1000, driveScale });
    accLow.setDecaySeconds(1e6); // effectively no decay, isolate drive accumulation
    let energyLow = 0;
    for (let i = 0; i < lowRate * seconds; i++) energyLow = accLow.tick(1);

    const highRate = 96000;
    const accHigh = new EnergyAccumulator(highRate, { maxEnergy: 1000, driveScale });
    accHigh.setDecaySeconds(1e6);
    let energyHigh = 0;
    for (let i = 0; i < highRate * seconds; i++) energyHigh = accHigh.tick(1);

    assert.ok(
        Math.abs(energyLow - energyHigh) / energyHigh < 0.01,
        `expected matching total drive, got ${energyLow} vs ${energyHigh}`
    );
});

test('energy is clamped to maxEnergy', () => {
    const acc = new EnergyAccumulator(48000, { maxEnergy: 2 });
    acc.setDecaySeconds(10);
    acc.injectImpulse(1000);
    const energy = acc.tick(0);
    assert.equal(energy, 2);
});

test('non-finite impulses never produce non-finite energy', () => {
    const acc = new EnergyAccumulator(48000, { maxEnergy: 4 });
    acc.setDecaySeconds(0.35);
    acc.injectImpulse(Infinity);
    const energy = acc.tick(0);
    assert.ok(Number.isFinite(energy), `expected finite energy, got ${energy}`);
});

test('reset() clears energy and any pending impulse', () => {
    const acc = new EnergyAccumulator(48000, { maxEnergy: 4 });
    acc.setDecaySeconds(0.35);
    acc.injectImpulse(1);
    acc.tick(0);
    acc.injectImpulse(1); // queued, not yet applied
    acc.reset();
    assert.equal(acc.energy, 0);
    assert.equal(acc.tick(0), 0); // the queued impulse must not still apply after reset
});

test('setEnergy() lands at the same target regardless of prior energy', () => {
    const acc = new EnergyAccumulator(48000, { maxEnergy: 4 });
    acc.setDecaySeconds(0.35);

    acc.setEnergy(1.5);
    assert.equal(acc.energy, 1.5); // takes effect immediately, before any tick()
    const fromZero = acc.tick(0); // one sample of decay applied on top

    // Leave some residual energy from a "previous shake" this time.
    acc.injectImpulse(3);
    acc.tick(0);
    acc.setEnergy(1.5);
    assert.equal(acc.energy, 1.5);
    const fromResidual = acc.tick(0);

    assert.ok(Math.abs(fromZero - 1.5) < 1e-4);
    assert.equal(
        fromResidual, fromZero,
        `expected setEnergy to ignore prior residual, got ${fromZero} vs ${fromResidual}`
    );
});

test('setEnergy() clamps to maxEnergy and discards any pending impulse', () => {
    const acc = new EnergyAccumulator(48000, { maxEnergy: 4 });
    acc.setDecaySeconds(0.35);

    acc.injectImpulse(1000); // queued, should be discarded by setEnergy
    acc.setEnergy(100);
    assert.equal(acc.energy, 4); // clamped immediately, before any tick()
});
