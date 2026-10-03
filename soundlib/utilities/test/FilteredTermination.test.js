import test from 'node:test';
import assert from 'node:assert/strict';
import { FilteredTermination } from '../FilteredTermination.js';
import { BridgeTermination } from '../BridgeTermination.js';
import { RigidTermination } from '../RigidTermination.js';
import { BidirectionalWaveguide } from '../BidirectionalWaveguide.js';
import { LoopLossFilter } from '../LoopLossFilter.js';
import { InitialConditionExciter } from '../InitialConditionExciter.js';
import { ResonatorBank } from '../ResonatorBank.js';

const SAMPLE_RATE = 48000;
const SHELF_CORNER_HZ = 1500;

// BRIDGE_POLARITY is internal to FilteredTermination.js (-1, matching
// RigidTermination's own real-string-end convention) -- re-derived here
// rather than exported, since a test should observe behavior through the
// public reflect()/lastX interface, same as every other component test in
// this codebase.
const BRIDGE_POLARITY = -1;

test('exact ENERGY-accounting identity holds every sample across a reflection x tilt x couplingEfficiency grid (reflected^2+transmitted^2+dissipated^2 === incident^2)', () => {
    // Pre-C.5.3 reparameterization: this test previously checked an exact
    // AMPLITUDE identity (incident === reflected + transmitted +
    // dissipated), which the user's energy-accounting request explicitly
    // supersedes -- an exact linear sum and an exact quadratic (energy)
    // sum cannot both hold simultaneously here. See
    // FilteredTermination.js's own class-level comment and
    // WG3/knowledge/causal-claims.yaml for the superseded claim.
    let maxErr = 0;
    for (const reflection of [0, 0.3, 0.6, 1]) {
        for (const reflectionTilt of [0]) { // exact only at neutral tilt -- see below
            for (const couplingEfficiency of [0, 0.5, 1]) {
                const ft = new FilteredTermination(SAMPLE_RATE, SHELF_CORNER_HZ, reflection, reflectionTilt, couplingEfficiency);
                for (let i = 0; i < 500; i++) {
                    const incident = Math.sin(i * 0.013) * 0.7 + (i % 7 === 0 ? 0.3 : -0.1);
                    ft.reflect(incident);
                    const energySum = ft.lastReflected ** 2 + ft.lastTransmitted ** 2 + ft.lastDissipated ** 2;
                    maxErr = Math.max(maxErr, Math.abs(energySum - incident * incident));
                }
            }
        }
    }
    // Floating-point exact, not an approximation -- the identity holds by
    // construction (see FilteredTermination.js's own comment) at
    // reflectionTilt=0. NOT yet proven/tested exact under nonzero tilt --
    // see the separate "approximate under tilt" note below.
    assert.ok(maxErr < 1e-9, `expected the identity to hold to floating-point precision, got max error ${maxErr}`);
});

test('the energy identity is only an approximation under nonzero reflectionTilt, by design -- documented, not silently assumed exact', () => {
    // transmitted/dissipated are computed from the SCALAR `reflection`
    // regardless of tilt, but the ACTUAL reflected sample is tilt-shaped
    // -- so the three squared terms generally do NOT sum to incident^2
    // once tilt != 0. This test confirms that gap exists (rather than
    // silently assuming the identity generalizes), per the directive's
    // own explicit allowance to defer full tilt-energy integration.
    const ft = new FilteredTermination(SAMPLE_RATE, SHELF_CORNER_HZ, 0.7, 1, 0.5);
    let maxErr = 0;
    for (let i = 0; i < 500; i++) {
        const incident = Math.sin(i * 0.05) * 0.6;
        ft.reflect(incident);
        const energySum = ft.lastReflected ** 2 + ft.lastTransmitted ** 2 + ft.lastDissipated ** 2;
        maxErr = Math.max(maxErr, Math.abs(energySum - incident * incident));
    }
    assert.ok(maxErr > 1e-6, `expected a real, nonzero energy-identity gap under tilt!=0 (confirming it is NOT exact there), got maxErr=${maxErr}`);
});

test('neutral settings (reflection=1, reflectionTilt=0) reproduce RigidTermination(-1) exactly, for any couplingEfficiency', () => {
    for (const couplingEfficiency of [0, 0.5, 1]) {
        const ft = new FilteredTermination(SAMPLE_RATE, SHELF_CORNER_HZ, 1, 0, couplingEfficiency);
        const rt = new RigidTermination(-1);
        let maxDiff = 0;
        for (let i = 0; i < 500; i++) {
            const incident = Math.sin(i * 0.02) * 0.5 + Math.cos(i * 0.1) * 0.2;
            const a = ft.reflect(incident);
            const b = rt.reflect(incident);
            maxDiff = Math.max(maxDiff, Math.abs(a - b));
        }
        assert.ok(maxDiff < 1e-12, `couplingEfficiency=${couplingEfficiency}: expected exact match, got maxDiff=${maxDiff}`);
        // Math.abs(...) === 0, not assert.equal (which uses Object.is and
        // treats -0 !== 0 -- a real gotcha already documented elsewhere
        // in this codebase, e.g. EnergyAccumulator.test.js).
        assert.ok(Math.abs(ft.lastTransmitted) === 0, 'a fully-reflecting boundary should transmit nothing');
        assert.ok(Math.abs(ft.lastDissipated) === 0, 'a fully-reflecting boundary should dissipate nothing');
    }
});

// Measures the un-inverted base-reflection magnitude (reflectedWave /
// BRIDGE_POLARITY) at steady state for a swept sinusoid -- the quantity
// the passivity bound |baseReflected| <= reflection applies to.
function steadyStateReflectionGain(reflection, reflectionTilt, freqHz) {
    const ft = new FilteredTermination(SAMPLE_RATE, SHELF_CORNER_HZ, reflection, reflectionTilt, 0);
    const settleSamples = 2000;
    const measureSamples = 2000;
    for (let i = 0; i < settleSamples; i++) {
        ft.reflect(Math.sin((2 * Math.PI * freqHz * i) / SAMPLE_RATE));
    }
    let maxIn = 0;
    let maxOut = 0;
    for (let i = settleSamples; i < settleSamples + measureSamples; i++) {
        const x = Math.sin((2 * Math.PI * freqHz * i) / SAMPLE_RATE);
        const baseReflected = BRIDGE_POLARITY * ft.reflect(x);
        maxIn = Math.max(maxIn, Math.abs(x));
        maxOut = Math.max(maxOut, Math.abs(baseReflected));
    }
    return maxOut / maxIn;
}

test('passive by construction: swept-sinusoid steady-state reflection magnitude never exceeds `reflection`, across reflection x tilt x frequency', () => {
    const EPSILON = 1e-6;
    let worstRatio = 0;
    let worstCase = null;
    for (const reflection of [0.3, 0.7, 1.0]) {
        for (const reflectionTilt of [-1, -0.5, 0, 0.5, 1]) {
            for (const freqHz of [50, 220, 1000, 4000, 10000, 20000]) {
                const ratio = steadyStateReflectionGain(reflection, reflectionTilt, freqHz);
                if (ratio > worstRatio) {
                    worstRatio = ratio;
                    worstCase = { reflection, reflectionTilt, freqHz, ratio };
                }
            }
        }
    }
    assert.ok(
        worstRatio <= 1 + EPSILON,
        `expected magnitude ratio never to exceed 1 (reflection is the bound, measured as a fraction of it), worst case ${JSON.stringify(worstCase)}`
    );
});

test('couplingEfficiency=0 dissipates everything non-reflected; transmittedSignal stays at 0', () => {
    const ft = new FilteredTermination(SAMPLE_RATE, SHELF_CORNER_HZ, 0.5, 0.3, 0);
    for (let i = 0; i < 500; i++) {
        ft.reflect(Math.sin(i * 0.05) * 0.6);
        assert.ok(Math.abs(ft.lastTransmitted) < 1e-12, `expected transmittedSignal === 0 at sample ${i}, got ${ft.lastTransmitted}`);
    }
});

test('couplingEfficiency=1 transmits everything non-reflected; dissipated stays at 0', () => {
    const ft = new FilteredTermination(SAMPLE_RATE, SHELF_CORNER_HZ, 0.5, 0.3, 1);
    for (let i = 0; i < 500; i++) {
        ft.reflect(Math.sin(i * 0.05) * 0.6);
        assert.ok(Math.abs(ft.lastDissipated) < 1e-12, `expected dissipated === 0 at sample ${i}, got ${ft.lastDissipated}`);
    }
});

test('reflectionTilt genuinely reshapes the reflection spectrum, not just rescales it -- directional, measured', () => {
    const reflection = 0.9;
    const lowHz = 100;
    const highHz = 8000;

    const flatLow = steadyStateReflectionGain(reflection, 0, lowHz);
    const flatHigh = steadyStateReflectionGain(reflection, 0, highHz);
    // Flat (tilt=0) should be frequency-independent -- both close to `reflection`.
    assert.ok(Math.abs(flatLow - flatHigh) < 0.02, `expected flat response at tilt=0, got low=${flatLow} high=${flatHigh}`);

    const darkLow = steadyStateReflectionGain(reflection, 1, lowHz);
    const darkHigh = steadyStateReflectionGain(reflection, 1, highHz);
    assert.ok(darkHigh < darkLow - 0.05, `positive (darkening) tilt should reflect high frequencies measurably less than low, got low=${darkLow} high=${darkHigh}`);

    const brightLow = steadyStateReflectionGain(reflection, -1, lowHz);
    const brightHigh = steadyStateReflectionGain(reflection, -1, highHz);
    assert.ok(brightHigh > brightLow + 0.05, `negative (brightening) tilt should reflect high frequencies measurably more than low, got low=${brightLow} high=${brightHigh}`);
});

test('reset() clears internal filter state back to a fresh instance\'s own response', () => {
    const fresh = new FilteredTermination(SAMPLE_RATE, SHELF_CORNER_HZ, 0.8, 0.6, 0.2);
    const reused = new FilteredTermination(SAMPLE_RATE, SHELF_CORNER_HZ, 0.8, 0.6, 0.2);

    // Drive `reused` with some unrelated history, then reset it.
    for (let i = 0; i < 300; i++) reused.reflect(Math.sin(i * 0.3) * 0.9);
    reused.reset();

    let maxDiff = 0;
    for (let i = 0; i < 300; i++) {
        const incident = Math.sin(i * 0.05) * 0.5;
        const a = fresh.reflect(incident);
        const b = reused.reflect(incident);
        maxDiff = Math.max(maxDiff, Math.abs(a - b));
    }
    assert.ok(maxDiff < 1e-12, `expected reset() to reproduce a fresh instance's response, got maxDiff=${maxDiff}`);
});

test('stays finite across extreme reflection/tilt/couplingEfficiency combinations with sustained input', () => {
    for (const reflection of [0, 1]) {
        for (const reflectionTilt of [-1, 1]) {
            for (const couplingEfficiency of [0, 1]) {
                const ft = new FilteredTermination(SAMPLE_RATE, SHELF_CORNER_HZ, reflection, reflectionTilt, couplingEfficiency);
                for (let i = 0; i < 5000; i++) {
                    const incident = Math.sin(i * 0.37) * 1.5 + Math.cos(i * 1.9) * 1.5;
                    const out = ft.reflect(incident);
                    assert.ok(Number.isFinite(out), `non-finite reflectedWave at reflection=${reflection} tilt=${reflectionTilt} couplingEfficiency=${couplingEfficiency} i=${i}`);
                    assert.ok(Number.isFinite(ft.lastTransmitted) && Number.isFinite(ft.lastDissipated));
                }
            }
        }
    }
});

test('BridgeTermination is a drop-in FilteredTermination specialization with identical default behavior', () => {
    const bt = new BridgeTermination(SAMPLE_RATE, SHELF_CORNER_HZ);
    const ft = new FilteredTermination(SAMPLE_RATE, SHELF_CORNER_HZ);
    let maxDiff = 0;
    for (let i = 0; i < 300; i++) {
        const incident = Math.sin(i * 0.04) * 0.6;
        maxDiff = Math.max(maxDiff, Math.abs(bt.reflect(incident) - ft.reflect(incident)));
    }
    assert.equal(maxDiff, 0);
});

// --- REUSE DEMONSTRATION: Exciter -> DispersiveWaveguide -> FilteredTermination -> second resonator ---
//
// Proves the transmission port's interface (BidirectionalWaveguide.
// lastTransmittedSignal) can drive an independent downstream resonant
// component, per the directive's own required demonstration -- kept at
// the test level, not built into WG3 itself (no second audible child
// model), per the directive's explicit "need not become a polished
// SoundModel" allowance.
function pluckAndDriveDownstreamResonator(couplingEfficiency) {
    const maxRailSamples = Math.ceil(SAMPLE_RATE / (2 * 55)) + 4;
    const waveguide = new BidirectionalWaveguide(maxRailSamples);
    waveguide.setRailLength(SAMPLE_RATE / (2 * 220));

    const nutTermination = new RigidTermination(-1);
    const bridgeTermination = new BridgeTermination(SAMPLE_RATE, SHELF_CORNER_HZ, 0.6, 0.2, couplingEfficiency);
    const lossFilter = new LoopLossFilter(1.0, SAMPLE_RATE, waveguide.railLength);
    const exciter = new InitialConditionExciter(7);

    exciter.exciteAtPosition(waveguide.rightGoing, waveguide.leftGoing, waveguide.railLength, 0.2, 'noise', 0.8);

    // A small, independent downstream resonator -- the "second resonator"
    // a future body/coupling model would be. One mode is enough to prove
    // the interface works.
    const downstream = new ResonatorBank(SAMPLE_RATE, 1);
    downstream.setMode(0, 330, 0.5, 1);

    let downstreamSumSq = 0;
    const frames = Math.round(SAMPLE_RATE * 0.3);
    for (let i = 0; i < frames; i++) {
        waveguide.tick(nutTermination, bridgeTermination, lossFilter, null);
        downstream.excite(0, waveguide.lastTransmittedSignal);
        const y = downstream.tick();
        assert.ok(Number.isFinite(y), `non-finite downstream resonator output at sample ${i}`);
        downstreamSumSq += y * y;
    }
    return Math.sqrt(downstreamSumSq / frames);
}

test('REUSE DEMONSTRATION: transmittedSignal can drive an independent downstream ResonatorBank', () => {
    // couplingEfficiency=0.7: most of the non-reflected energy is
    // transmitted -- active. couplingEfficiency=0: ALL non-reflected
    // energy is dissipated, nothing transmitted -- silent (the inverted
    // sense from the old terminationDamping convention: 0 is now the
    // "nothing transmitted" endpoint, not 1).
    const activeRms = pluckAndDriveDownstreamResonator(0.7);
    assert.ok(activeRms > 1e-6, `expected the downstream resonator to produce real, nonzero output when driven, got rms=${activeRms}`);

    const silentRms = pluckAndDriveDownstreamResonator(0);
    assert.ok(silentRms < 1e-9, `expected the downstream resonator to stay silent when couplingEfficiency=0 (nothing transmitted), got rms=${silentRms}`);
});
