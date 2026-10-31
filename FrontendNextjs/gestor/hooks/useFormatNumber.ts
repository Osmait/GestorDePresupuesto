'use client'

import { useCallback } from 'react'
import { useAppLocale } from '@/lib/i18n/date-locale'
import { type FormatNumberOptions, formatNumber } from '@/lib/utils'

/** `formatNumber` with the locale already bound. */
export type FormatNumberFn = (value: number, options?: Omit<FormatNumberOptions, 'locale'>) => string

/**
 * The canonical way to format plain numbers (exchange rates) in client components.
 *
 * @example
 * const formatNumber = useFormatNumber()
 * formatNumber(rate, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) // "58.1234"
 */
export function useFormatNumber(): FormatNumberFn {
	const locale = useAppLocale()
	return useCallback(
		(value: number, options: Omit<FormatNumberOptions, 'locale'> = {}) => formatNumber(value, { ...options, locale }),
		[locale],
	)
}
