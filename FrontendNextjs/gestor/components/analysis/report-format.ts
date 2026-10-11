'use client'

import { useCallback } from 'react'
import { formatLocalDate, getIntlLocale, useAppLocale } from '@/lib/i18n/date-locale'

/** Upper-cases the first letter ("septiembre" → "Septiembre") for labels that start a line. */
export function capitalize(value: string, locale: string): string {
	if (!value) return value
	return value.charAt(0).toLocaleUpperCase(getIntlLocale(locale)) + value.slice(1)
}

/** Month name in the active locale ("septiembre" / "September", or "sept." / "Sep" with `short`). */
export function useMonthName() {
	const locale = useAppLocale()
	return useCallback(
		(year: number, month: number, style: 'long' | 'short' = 'long') =>
			formatLocalDate(new Date(year, month - 1, 1), locale, { month: style }),
		[locale],
	)
}

/** "Comida, Transporte y Salud" / "Food, Transport, and Health". */
export function useListFormat() {
	const locale = useAppLocale()
	return useCallback(
		(items: string[]) =>
			new Intl.ListFormat(getIntlLocale(locale), { style: 'long', type: 'conjunction' }).format(items),
		[locale],
	)
}

/** Compact date range in the active locale ("1–11 de septiembre" / "September 1 – 11"). */
export function formatDateRange(from: Date, to: Date, locale: string, options: Intl.DateTimeFormatOptions): string {
	const formatter = new Intl.DateTimeFormat(getIntlLocale(locale), options)
	return typeof formatter.formatRange === 'function'
		? formatter.formatRange(from, to)
		: `${formatter.format(from)} – ${formatter.format(to)}`
}
