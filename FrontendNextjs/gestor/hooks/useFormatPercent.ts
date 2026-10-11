'use client'

import { useCallback } from 'react'
import { useAppLocale } from '@/lib/i18n/date-locale'
import { type FormatPercentOptions, formatPercent } from '@/lib/utils'

/** `formatPercent` with the locale already bound. */
export type FormatPercentFn = (value: number, options?: Omit<FormatPercentOptions, 'locale'>) => string

/**
 * The canonical way to format percentages in client components (the
 * `useFormatCurrency` of percents): locale-aware, 1 decimal at most by default.
 *
 * @example
 * const formatPercent = useFormatPercent()
 * formatPercent(12.345) // "12.3%"
 * formatPercent(roi, { signDisplay: 'exceptZero', minimumFractionDigits: 2, maximumFractionDigits: 2 }) // "+4.20%"
 */
export function useFormatPercent(): FormatPercentFn {
	const locale = useAppLocale()
	return useCallback(
		(value: number, options: Omit<FormatPercentOptions, 'locale'> = {}) => formatPercent(value, { ...options, locale }),
		[locale],
	)
}
