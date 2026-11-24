// Exact half-up rounding to pesewas: litres (3 decimals) × GHS/L (4 decimals).
export function fuelTotalCents(litres, price) {
    const scaled = (value, places) => {
        if (!new RegExp(`^\\d+(\\.\\d{1,${places}})?$`).test(String(value ?? ''))) return null;
        const [whole, fraction = ''] = String(value).split('.');
        const number = BigInt(whole) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, '0'));
        return number > 0n && number <= 9999999999n ? number : null;
    };
    const volume = scaled(litres, 3); const rate = scaled(price, 4);
    if (volume === null || rate === null) return null;
    const cents = (volume * rate + 50000n) / 100000n;
    return cents > 0n && cents <= 9999999999n ? Number(cents) : null;
}
