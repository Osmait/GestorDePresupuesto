import { describe, expect, it } from 'vitest'
import { formatLocalDate, getDateFnsLocale, getIntlLocale } from '@/lib/i18n/date-locale'

describe('date-locale helpers', () => {
	it('maps app locales to date-fns and Intl locales', () => {
		expect(getDateFnsLocale('es').code).toBe('es')
		expect(getDateFnsLocale('en').code).toBe('en-US')
		expect(getDateFnsLocale('fr').code).toBe('es')
		expect(getIntlLocale('en')).toBe('en-US')
		expect(getIntlLocale(undefined)).toBe('es-DO')
	})

	it('formats dates in the requested locale', () => {
		const options: Intl.DateTimeFormatOptions = { month: 'long' }
		expect(formatLocalDate('2024-01-15', 'en', options)).toBe('January')
		expect(formatLocalDate('2024-01-15', 'es', options)).toBe('enero')
	})

	it('keeps calendar dates on the same day regardless of timezone', () => {
		const options: Intl.DateTimeFormatOptions = { day: 'numeric' }
		expect(formatLocalDate('2024-01-15', 'en', options)).toBe('15')
		expect(formatLocalDate('2024-01-15T00:00:00Z', 'en', options)).toBe('15')
	})

	it('returns a dash for invalid input', () => {
		expect(formatLocalDate('not-a-date', 'en')).toBe('-')
	})
})
