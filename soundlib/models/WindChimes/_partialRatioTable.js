// Measured partial-ratio data for the Python original's 5 wind-chime
// tubes (scratch/DS_WindChimes_1.1/WindChimes.py's makeChimes()), and a
// pitch-parameterized generalization of it. Each tube's partials don't
// sit at one fixed non-harmonic ratio shape -- the ratios drift smoothly
// as the fundamental changes (e.g. partial 5's ratio: 11.44, 11.28, 11.16,
// 11.02, 10.97 across the 5 measured tubes, low to high). Treating each
// partial's ratio as a function of pitch -- piecewise-linear across the 5
// measured points, linearly extrapolated beyond them -- lets any pitch,
// not just the 5 originally measured ones, get a physically-informed
// ratio shape instead of one fixed borrowed shape.

const CANONICAL_TUBE_CF = [
    [219.8, 590.2, 1115.4, 1766.2, 2513.9],
    [245.8, 657.6, 1239.2, 1955.3, 2773.1],
    [293.9, 782.4, 1465.2, 2311.8, 3278.8],
    [331.6, 875.5, 1633.0, 2576.5, 3654.2],
    [366.1, 967.5, 1794.2, 2831.0, 4015.1]
];

function hzToPitch(hz) {
    return 69 + 12 * Math.log2(hz / 440);
}

// [{ pitch, ratios: [1, r1, r2, r3, r4] }, ...], ascending by pitch --
// already true of the source data, fundamentals increase tube 0 -> 4.
const MEASURED_POINTS = CANONICAL_TUBE_CF.map((cf) => ({
    pitch: hzToPitch(cf[0]),
    ratios: cf.map((f) => f / cf[0])
}));

const MIN_MEASURED_PITCH = MEASURED_POINTS[0].pitch;
const MAX_MEASURED_PITCH = MEASURED_POINTS[MEASURED_POINTS.length - 1].pitch;
const PARTIAL_COUNT = MEASURED_POINTS[0].ratios.length;

export function measuredPitchRange() {
    return [MIN_MEASURED_PITCH, MAX_MEASURED_PITCH];
}

// Piecewise-linear interpolation/extrapolation of each partial's ratio, as
// a function of pitch, across the 5 measured tubes' own ratio shapes.
export function ratiosForPitch(pitch) {
    const ratios = new Array(PARTIAL_COUNT);
    ratios[0] = 1; // the fundamental is always ratio 1, by definition
    for (let partialIndex = 1; partialIndex < PARTIAL_COUNT; partialIndex++) {
        ratios[partialIndex] = Math.max(1, interpolatePartial(partialIndex, pitch));
    }
    return ratios;
}

function interpolatePartial(partialIndex, pitch) {
    let lower = MEASURED_POINTS[0];
    let upper = MEASURED_POINTS[MEASURED_POINTS.length - 1];

    if (pitch <= MIN_MEASURED_PITCH) {
        lower = MEASURED_POINTS[0];
        upper = MEASURED_POINTS[1];
    } else if (pitch >= MAX_MEASURED_PITCH) {
        lower = MEASURED_POINTS[MEASURED_POINTS.length - 2];
        upper = MEASURED_POINTS[MEASURED_POINTS.length - 1];
    } else {
        for (let i = 0; i < MEASURED_POINTS.length - 1; i++) {
            if (pitch >= MEASURED_POINTS[i].pitch && pitch <= MEASURED_POINTS[i + 1].pitch) {
                lower = MEASURED_POINTS[i];
                upper = MEASURED_POINTS[i + 1];
                break;
            }
        }
    }

    const span = upper.pitch - lower.pitch;
    const t = span !== 0 ? (pitch - lower.pitch) / span : 0;
    return lower.ratios[partialIndex] + t * (upper.ratios[partialIndex] - lower.ratios[partialIndex]);
}
