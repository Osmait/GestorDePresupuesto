'use client'

import { useCallback } from 'react'
import { useAppLocale } from '@/lib/i18n/date-locale'
import { type FormatCurrencyOptions, formatCurrency } from '@/lib/utils'

/** `formatCurrency` with the locale already bound. */
export type FormatCurrencyFn = (
	value: number,
	currency?: string | null,
	options?: Omit<FormatCurrencyOptions, 'locale'>,
) => string

/**
 * The canonical way to format money in client components.
 *
 * Returns `formatCurrency` bound to the active next-intl locale, so client
 * components format money the same way as server components
 * (`formatCurrency(value, currency, { locale: await getLocale() })`):
 * locale grouping, always 2 decimals, "RD$" / "US$" symbols, DOP fallback.
 *
 * For rendering an amount in the UI prefer `<Amount>` (components/shared/Amount),
 * which uses this hook and adds tone, sign and tabular figures. Use the hook
 * directly for strings: aria-labels, toasts, chart tooltips, CSV export.
 * Do not write local `formatMoney`/`money`/`formatDOP` wrappers or inline
 * `Intl.NumberFormat` for money.
 *
 * @example
 * const formatCurrency = useFormatCurrency()
 * formatCurrency(1500.5, account.currency) // "RD$1,500.50"
 * formatCurrency(12, 'USD', { signDisplay: 'exceptZero' }) // "+US$12.00"
 */
export function useFormatCurrency(): FormatCurrencyFn {
	const locale = useAppLocale()
	return useCallback(
		(value: number, currency?: string | null, options: Omit<FormatCurrencyOptions, 'locale'> = {}) =>
			formatCurrency(value, currency, { ...options, locale }),
		[locale],
	)
}
