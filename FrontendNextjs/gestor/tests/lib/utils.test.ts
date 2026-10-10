import { describe, expect, it } from 'vitest'
import { cn, formatCurrency, toIntlLocale } from '@/lib/utils'

describe('lib/utils', () => {
	describe('cn (class name merger)', () => {
		it('merges class names', () => {
			expect(cn('foo', 'bar')).toBe('foo bar')
		})

		it('handles conditional classes', () => {
			expect(cn('foo', true && 'bar', false && 'baz')).toBe('foo bar')
		})

		it('handles arrays', () => {
			expect(cn(['foo', 'bar'])).toBe('foo bar')
		})

		it('resolves Tailwind conflicts (last wins)', () => {
			// tailwind-merge resolves conflicts
			expect(cn('p-2', 'p-4')).toBe('p-4')
			expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
		})

		it('handles empty inputs', () => {
			expect(cn()).toBe('')
			expect(cn('')).toBe('')
			expect(cn(null, undefined)).toBe('')
		})
	})

	describe('formatCurrency', () => {
		it('defaults to DOP (backend default currency) with RD$ and 2 decimals', () => {
			expect(formatCurrency(1600.5)).toBe('RD$1,600.50')
			expect(formatCurrency(1234.56, 'DOP')).toBe('RD$1,234.56')
		})

		it('uses US$ for USD in every locale', () => {
			expect(formatCurrency(1234.56, 'USD')).toBe('US$1,234.56')
			expect(formatCurrency(1234.56, 'USD', { locale: 'en' })).toBe('US$1,234.56')
			expect(formatCurrency(1234.56, 'USD', { locale: 'es' })).toBe('US$1,234.56')
		})

		it('does not print the ISO code for DOP in English ("DOP 1,500.5")', () => {
			expect(formatCurrency(1500.5, 'DOP', { locale: 'en' })).toBe('RD$1,500.50')
		})

		it('groups thousands and keeps 2 decimals in Spanish (no "1134,56")', () => {
			expect(formatCurrency(1134.56, 'DOP', { locale: 'es' })).toBe('RD$1,134.56')
			expect(formatCurrency(1134.56, 'USD', { locale: 'es' })).toBe('US$1,134.56')
		})

		it('formats zero', () => {
			expect(formatCurrency(0)).toBe('RD$0.00')
			expect(formatCurrency(0, 'USD', { locale: 'en' })).toBe('US$0.00')
		})

		it('never renders a negative zero', () => {
			expect(formatCurrency(-0)).toBe('RD$0.00')
			expect(formatCurrency(-0.004)).toBe('RD$0.00')
			expect(formatCurrency(-0.004, 'DOP', { signDisplay: 'exceptZero' })).toBe('RD$0.00')
		})

		it('formats negative numbers with a leading minus', () => {
			expect(formatCurrency(-500.99, 'USD')).toBe('-US$500.99')
			expect(formatCurrency(-1600.5, 'DOP', { locale: 'en' })).toBe('-RD$1,600.50')
		})

		it('formats large numbers', () => {
			expect(formatCurrency(1000000, 'DOP')).toBe('RD$1,000,000.00')
			expect(formatCurrency(1234567890.12, 'USD', { locale: 'en' })).toBe('US$1,234,567,890.12')
		})

		it('rounds to 2 decimal places', () => {
			expect(formatCurrency(10.999, 'USD')).toBe('US$11.00')
			expect(formatCurrency(10.001, 'USD')).toBe('US$10.00')
			expect(formatCurrency(0.01, 'DOP')).toBe('RD$0.01')
		})

		it('shows an explicit sign when requested', () => {
			expect(formatCurrency(1500.5, 'DOP', { signDisplay: 'exceptZero' })).toBe('+RD$1,500.50')
			expect(formatCurrency(-0.01, 'DOP', { signDisplay: 'exceptZero' })).toBe('-RD$0.01')
			expect(formatCurrency(0, 'DOP', { signDisplay: 'exceptZero' })).toBe('RD$0.00')
		})

		it('falls back to DOP for missing or invalid currency codes and to 0 for non-finite values', () => {
			expect(formatCurrency(5, undefined)).toBe('RD$5.00')
			expect(formatCurrency(5, '')).toBe('RD$5.00')
			expect(formatCurrency(5, 'not-a-code')).toBe('RD$5.00')
			expect(formatCurrency(Number.NaN, 'USD')).toBe('US$0.00')
		})

		it('uses Intl symbols for other currencies', () => {
			expect(formatCurrency(10, 'EUR', { locale: 'en' })).toBe('€10.00')
		})
	})

	describe('toIntlLocale', () => {
		it('maps app locales to Intl locales', () => {
			expect(toIntlLocale('en')).toBe('en-US')
			expect(toIntlLocale('es')).toBe('es-DO')
			expect(toIntlLocale(undefined)).toBe('es-DO')
		})
	})
})
