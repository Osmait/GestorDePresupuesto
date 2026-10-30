import * as z from 'zod'
import { CENTS_SCALE } from '@/lib/money-validation'

/**
 * Parsing of amounts typed by people into a text field.
 *
 * Money fields are `<input type="text" inputMode="decimal">` (see MoneyInput), never
 * `type="number"`: a number input is parsed with the browser's locale, so Chromium with
 * es-DO turns "1500,50" into 150050 and Firefox/Safari return '' for anything they cannot
 * parse, which `z.coerce.number()` silently turns into 0. This module decides what was meant.
 *
 * Separator rule (written for es-DO users, who mostly type "1,500.50"):
 * 1. Both '.' and ',' present: the LAST one is the decimal mark and the other one groups
 *    thousands: "1,500.50" and "1.500,50" are both 1500.5.
 * 2. One separator repeated ("1,500,000", "1.500.000"): thousands separators, no decimals.
 * 3. A single ',':
 *    - followed by exactly 3 digits, with 1-3 digits before it (not starting with 0), it groups
 *      thousands: "1,500" is 1500, "12,345" is 12345 (that is how es-DO writes thousands);
 *    - otherwise it is the decimal mark: "1500,50" is 1500.5, "12,5" is 12.5, "0,750" is 0.75.
 * 4. A single '.' is always the decimal mark: "1.5" is 1.5 and "1.500" is 1.5 (es-DO reading).
 * Thousands groups must be well formed (1-3 leading digits, then groups of exactly 3):
 * "1,50,000" or "1.500,000.5" are rejected instead of guessed. Spaces (also non-breaking ones)
 * and a leading currency symbol ("RD$", "US$", "$", "€") are ignored; a leading '-' is kept, so
 * forms that need a positive amount add `.min()` / `.positive()`.
 *
 * The result has at most `decimals` decimal places (2 for money by default; investment
 * quantities and exchange rates pass more). Trailing zeros do not count ("1.500" has 1).
 * Empty input and garbage are errors, never 0.
 */

export type MoneyParseError = 'empty' | 'invalid' | 'decimals'

export type MoneyParseResult = { ok: true; value: number } | { ok: false; error: MoneyParseError }

export interface MoneyParseOptions {
	/** Maximum decimal places allowed (default 2, the DECIMAL(x,2) money columns). */
	decimals?: number
}

const IGNORED = /[\s  ]/g
const CURRENCY_PREFIX = /^(?:RD\$|US\$|\$|€)/i
const ALLOWED = /^-?[\d.,]+$/
const LEAD_GROUP = /^[1-9]\d{0,2}$/
const GROUP = /^\d{3}$/

/** "1,500,000" split on `sep` is a well-formed thousands grouping. */
function isGrouped(parts: string[]): boolean {
	return LEAD_GROUP.test(parts[0]) && parts.slice(1).every((g) => GROUP.test(g))
}

/** Splits the unsigned body into integer digits and fraction digits, or null when malformed. */
function splitNumber(body: string): { int: string; frac: string } | null {
	const lastDot = body.lastIndexOf('.')
	const lastComma = body.lastIndexOf(',')

	// Rule 1: both separators, the last one is the decimal mark.
	if (lastDot !== -1 && lastComma !== -1) {
		const decimalIndex = Math.max(lastDot, lastComma)
		const group = lastDot > lastComma ? ',' : '.'
		const intPart = body.slice(0, decimalIndex)
		const frac = body.slice(decimalIndex + 1)
		if (frac.includes('.') || frac.includes(',') || !/^\d+$/.test(frac)) return null
		const groups = intPart.split(group)
		if (groups.length < 2 || !isGrouped(groups)) return null
		return { int: groups.join(''), frac }
	}

	const sep = lastDot !== -1 ? '.' : lastComma !== -1 ? ',' : null
	if (!sep) return /^\d+$/.test(body) ? { int: body, frac: '' } : null

	const parts = body.split(sep)
	// Rule 2: a repeated separator only groups thousands.
	if (parts.length > 2) return isGrouped(parts) ? { int: parts.join(''), frac: '' } : null

	const [intPart, frac] = parts
	if (!/^\d*$/.test(intPart) || !/^\d+$/.test(frac)) return null
	// Rule 3: "1,500" groups thousands (es-DO).
	if (sep === ',' && isGrouped(parts)) return { int: intPart + frac, frac: '' }
	// Rules 3 and 4: otherwise the single separator is the decimal mark.
	return { int: intPart || '0', frac }
}

/**
 * Parses a typed amount (or a number already in the form state).
 * See the module comment for the separator rule.
 */
export function parseMoneyInput(input: unknown, { decimals = CENTS_SCALE }: MoneyParseOptions = {}): MoneyParseResult {
	if (input === null || input === undefined) return { ok: false, error: 'empty' }
	if (typeof input === 'number') {
		if (!Number.isFinite(input)) return { ok: false, error: 'invalid' }
		return parseMoneyInput(toMoneyInputText(input), { decimals })
	}
	if (typeof input !== 'string') return { ok: false, error: 'invalid' }

	let text = input.replace(IGNORED, '')
	if (!text) return { ok: false, error: 'empty' }
	const negative = text.startsWith('-')
	if (negative) text = text.slice(1)
	text = text.replace(CURRENCY_PREFIX, '')
	if (!text || !ALLOWED.test(text)) return { ok: false, error: 'invalid' }

	const parts = splitNumber(text)
	if (!parts) return { ok: false, error: 'invalid' }

	const frac = parts.frac.replace(/0+$/, '')
	if (frac.length > decimals) return { ok: false, error: 'decimals' }

	const value = Number(`${negative ? '-' : ''}${parts.int}${frac ? `.${frac}` : ''}`)
	if (!Number.isFinite(value)) return { ok: false, error: 'invalid' }
	// Avoid -0 for "-0" / "-0,00".
	return { ok: true, value: value === 0 ? 0 : value }
}

/** The parsed amount, or NaN when the input is empty or invalid (for live previews). */
export function moneyInputToNumber(input: unknown, options?: MoneyParseOptions): number {
	const result = parseMoneyInput(input, options)
	return result.ok ? result.value : Number.NaN
}

/**
 * Text shown in a money field for a value held in the form state: numbers are written in
 * plain decimal notation (no exponent, '.' as decimal mark), so they parse back unchanged.
 */
export function toMoneyInputText(value: unknown): string {
	if (value === null || value === undefined) return ''
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) return ''
		return value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 })
	}
	return String(value)
}

export interface MoneySchemaMessages {
	/** Shown when the field is empty. */
	required: string
	/** Shown when the text is not an amount (defaults to `required`). */
	invalid?: string
	/** Shown when there are too many decimal places (defaults to `invalid`). */
	decimals?: string
}

type FormsTranslator = (key: string, values?: Record<string, string | number>) => string

/**
 * Standard messages from the `forms` namespace (`useTranslations('forms')`).
 * `required` overrides the empty-field message (e.g. a field-specific one).
 */
export function moneyMessages(
	tForms: FormsTranslator,
	{ required, decimals = CENTS_SCALE, number = false }: { required?: string; decimals?: number; number?: boolean } = {},
): MoneySchemaMessages & { invalid: string } {
	return {
		required: required ?? tForms('amountMissing'),
		invalid: number ? tForms('invalidNumber') : tForms('invalidAmount'),
		decimals: decimals === CENTS_SCALE ? tForms('maxTwoDecimals') : tForms('maxDecimals', { count: decimals }),
	}
}

function messageFor(error: MoneyParseError, messages: MoneySchemaMessages): string {
	if (error === 'empty') return messages.required
	if (error === 'decimals') return messages.decimals ?? messages.invalid ?? messages.required
	return messages.invalid ?? messages.required
}

/**
 * Zod schema for a required money field: accepts the field's text (or a number default)
 * and outputs a number, with a field error for empty, invalid or over-precise input.
 * Chain range checks with `.pipe(z.number().min(...))`.
 */
export function moneySchema(messages: MoneySchemaMessages, options?: MoneyParseOptions) {
	return z.union([z.string(), z.number()]).transform((raw, ctx) => {
		const result = parseMoneyInput(raw, options)
		if (result.ok) return result.value
		ctx.addIssue({ code: 'custom', message: messageFor(result.error, messages) })
		return z.NEVER
	})
}

/** Like moneySchema, but an empty field is `undefined` instead of an error. */
export function optionalMoneySchema(
	messages: Omit<MoneySchemaMessages, 'required'> & { invalid: string },
	options?: MoneyParseOptions,
) {
	return z
		.union([z.string(), z.number()])
		.optional()
		.transform((raw, ctx) => {
			const result = parseMoneyInput(raw, options)
			if (result.ok) return result.value
			if (result.error === 'empty') return undefined
			ctx.addIssue({ code: 'custom', message: messageFor(result.error, { required: messages.invalid, ...messages }) })
			return z.NEVER
		})
}
