import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility function to merge Tailwind CSS classes conditionally.
 * Combines `clsx` for conditional classes and `tailwind-merge` to resolve conflicts.
 *
 * @param inputs - Class definitions to merge.
 * @returns A merged string of class names.
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

/** Currency used by the backend when an account/transaction has none (`COALESCE(currency, 'DOP')`). */
export const DEFAULT_CURRENCY = 'DOP'

/**
 * Fixed symbols for the currencies the app handles. Both are "dollars", so the
 * prefix always disambiguates them regardless of the UI language
 * (Intl would otherwise print "DOP 1,500.50" in English and "$" for USD).
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
	DOP: 'RD$',
	USD: 'US$',
}

/** Maps the app locale (next-intl: `es` | `en`) to the Intl locale used for numbers. */
export function toIntlLocale(locale?: string | null): string {
	if (locale?.toLowerCase().startsWith('en')) return 'en-US'
	// Dominican Spanish groups thousands with "," and uses "." for decimals.
	return 'es-DO'
}

export interface FormatCurrencyOptions {
	/** App locale (`es` | `en`). Defaults to Spanish. */
	locale?: string | null
	/** Intl sign display. Use `exceptZero` to force a "+" on positive values. */
	signDisplay?: 'auto' | 'always' | 'exceptZero' | 'never'
	/**
	 * Maximum decimals (0–2). Defaults to 2, which always prints cents. Lower it
	 * only where cents are noise (chart axes, compact KPI hints): `0` prints
	 * "RD$1,501". The minimum follows it, so whole amounts never gain decimals.
	 */
	maximumFractionDigits?: 0 | 1 | 2
}

/**
 * Formats a money amount: locale-aware grouping, 2 decimals (unless
 * `maximumFractionDigits` lowers it), and a consistent symbol per currency
 * (DOP → "RD$", USD → "US$").
 *
 * @param value - The amount (API amounts are JSON numbers with exact cents).
 * @param currency - ISO 4217 code; empty/unknown values fall back to DOP.
 * @param options - Locale, sign display and maximum decimals.
 * @returns e.g. "RD$1,600.50", "-US$12.00", "+RD$0.01".
 */
export function formatCurrency(
	value: number,
	currency: string | null | undefined = DEFAULT_CURRENCY,
	options: FormatCurrencyOptions = {},
): string {
	const code = (currency || DEFAULT_CURRENCY).toUpperCase()
	const fractionDigits = options.maximumFractionDigits ?? 2
	const factor = 10 ** fractionDigits
	// Round to the printed precision first so -0.004 renders as "RD$0.00" instead of "-RD$0.00".
	const safeValue = Number.isFinite(value) ? Math.round(value * factor) / factor || 0 : 0

	let formatter: Intl.NumberFormat
	try {
		formatter = new Intl.NumberFormat(toIntlLocale(options.locale), {
			style: 'currency',
			currency: code,
			minimumFractionDigits: fractionDigits,
			maximumFractionDigits: fractionDigits,
			signDisplay: options.signDisplay ?? 'auto',
		})
	} catch {
		// Invalid ISO code coming from data: never crash the UI over it.
		return formatCurrency(safeValue, DEFAULT_CURRENCY, options)
	}

	const symbol = CURRENCY_SYMBOLS[code]
	if (!symbol) return formatter.format(safeValue)

	const parts = formatter.formatToParts(safeValue)
	const currencyIndex = parts.findIndex((part) => part.type === 'currency')
	return parts
		.filter((part, index) => {
			// Drop the space Intl puts between an ISO code and the number ("DOP 1.00").
			const nextToCurrency = index === currencyIndex - 1 || index === currencyIndex + 1
			return !(nextToCurrency && part.type === 'literal' && part.value.trim() === '')
		})
		.map((part) => (part.type === 'currency' ? symbol : part.value))
		.join('')
}

export interface FormatPercentOptions {
	/** App locale (`es` | `en`). Defaults to Spanish. */
	locale?: string | null
	/** Decimals printed at most. Default 1. */
	maximumFractionDigits?: number
	/** Decimals always printed. Default 0 (so "12%" and "12.5%"). */
	minimumFractionDigits?: number
	/** `exceptZero` prints "+12.5%" for gains. */
	signDisplay?: 'auto' | 'always' | 'exceptZero' | 'never'
}

/**
 * Formats a percentage given in percent units (`12.5` → "12.5%") with the
 * app locale. Rounds first, so a tiny negative prints "0%", never "-0%".
 * Client components use `useFormatPercent()`; server components pass
 * `locale: await getLocale()`. Don't build percents with `toFixed(1) + '%'`.
 *
 * @example formatPercent(12.345, { locale: 'en' }) // "12.3%"
 * @example formatPercent(-4.2, { signDisplay: 'exceptZero' }) // "-4.2%"
 */
export function formatPercent(value: number, options: FormatPercentOptions = {}): string {
	const maximumFractionDigits = options.maximumFractionDigits ?? 1
	const minimumFractionDigits = Math.min(options.minimumFractionDigits ?? 0, maximumFractionDigits)
	const factor = 10 ** maximumFractionDigits
	const rounded = Number.isFinite(value) ? Math.round(value * factor) / factor || 0 : 0
	return new Intl.NumberFormat(toIntlLocale(options.locale), {
		style: 'percent',
		minimumFractionDigits,
		maximumFractionDigits,
		signDisplay: options.signDisplay ?? 'auto',
	}).format(rounded / 100)
}
