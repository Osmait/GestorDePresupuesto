/**
 * Money columns such as card_payments.amount, loans.principal_amount,
 * certificates.base_capital, recurring_transactions.amount and
 * monthly_plan_items.amount are DECIMAL(x,2): the API rejects amounts with
 * more than 2 decimal places, so forms reject them first.
 */
export const CENTS_SCALE = 2

const DECIMAL_PATTERN = /^[+-]?\d*(?:\.(\d*))?(?:e([+-]?\d+))?$/i

/**
 * Number of significant fractional digits of a number or numeric string
 * (trailing zeros do not count: "1.500" → 1). NaN for non-numeric input.
 */
export function decimalPlaces(value: number | string): number {
	if (typeof value === 'number' && !Number.isFinite(value)) return Number.NaN
	// String(number) is the shortest round-trip representation (0.1 → "0.1").
	const text = String(value).trim()
	const match = DECIMAL_PATTERN.exec(text)
	if (!text || !match) return Number.NaN
	const fraction = (match[1] ?? '').replace(/0+$/, '').length
	const exponent = match[2] ? Number(match[2]) : 0
	return Math.max(0, fraction - exponent)
}

/** True when `value` has at most `places` decimal places (default: cents). */
export function hasAtMostDecimals(value: number | string, places: number = CENTS_SCALE): boolean {
	const count = decimalPlaces(value)
	return Number.isFinite(count) && count <= places
}
