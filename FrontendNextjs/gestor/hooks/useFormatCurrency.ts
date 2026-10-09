'use client'

import { useCallback } from 'react'
import { useAppLocale } from '@/lib/i18n/date-locale'
import { type FormatCurrencyOptions, formatCurrency } from '@/lib/utils'

/**
 * Returns `formatCurrency` bound to the active next-intl locale, so client
 * components format money the same way as server components
 * (`formatCurrency(value, currency, { locale: await getLocale() })`).
 */
export function useFormatCurrency() {
	const locale = useAppLocale()
	return useCallback(
		(value: number, currency?: string | null, options: Omit<FormatCurrencyOptions, 'locale'> = {}) =>
			formatCurrency(value, currency, { ...options, locale }),
		[locale],
	)
}
