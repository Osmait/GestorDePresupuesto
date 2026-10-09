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
}

/**
 * Formats a money amount: locale-aware grouping, always 2 decimals, and a
 * consistent symbol per currency (DOP → "RD$", USD → "US$").
 *
 * @param value - The amount (API amounts are JSON numbers with exact cents).
 * @param currency - ISO 4217 code; empty/unknown values fall back to DOP.
 * @param options - Locale and sign display.
 * @returns e.g. "RD$1,600.50", "-US$12.00", "+RD$0.01".
 */
export function formatCurrency(
	value: number,
	currency: string | null | undefined = DEFAULT_CURRENCY,
	options: FormatCurrencyOptions = {},
): string {
	const code = (currency || DEFAULT_CURRENCY).toUpperCase()
	// Round to cents first so -0.004 renders as "RD$0.00" instead of "-RD$0.00".
	const safeValue = Number.isFinite(value) ? Math.round(value * 100) / 100 || 0 : 0

	let formatter: Intl.NumberFormat
	try {
		formatter = new Intl.NumberFormat(toIntlLocale(options.locale), {
			style: 'currency',
			currency: code,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
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
