// Formats a number to a total of `totalDigits` digit characters (sign,
// decimal point, and exponent notation don't count), splitting the budget
// between the integer and fractional parts based on magnitude.
//
// toPrecision() alone doesn't do this: it guarantees significant figures,
// not total displayed characters, so a small magnitude like 0.0160739649
// (gamma) comes out as "0.016074" -- 7 digit characters, because the leading
// zeros aren't "significant" but still take up space on screen.
export function formatFixedDigits(value, totalDigits = 5) {
    if (!Number.isFinite(value)) return String(value);
    if (value === 0) return (0).toFixed(totalDigits - 1);

    const magnitude = Math.floor(Math.log10(Math.abs(value)));
    const intDigits = magnitude + 1;

    if (intDigits >= totalDigits) {
        return value.toPrecision(totalDigits);
    }

    let decimalDigits = intDigits > 0 ? totalDigits - intDigits : totalDigits - 1;
    let result = value.toFixed(decimalDigits);

    // Rounding can carry into an extra integer digit (e.g. 9.99996 -> "10.0000");
    // drop one decimal place if so, to keep the total digit count correct.
    const digitCount = result.replace(/[^0-9]/g, '').length;
    if (digitCount > totalDigits && decimalDigits > 0) {
        result = value.toFixed(decimalDigits - 1);
    }

    return result;
}
