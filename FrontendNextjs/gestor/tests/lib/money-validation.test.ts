import { describe, expect, it } from 'vitest'
import { decimalPlaces, hasAtMostDecimals } from '@/lib/money-validation'

describe('decimalPlaces', () => {
	it('counts significant fractional digits', () => {
		expect(decimalPlaces(10)).toBe(0)
		expect(decimalPlaces(0.1)).toBe(1)
		expect(decimalPlaces(19.99)).toBe(2)
		expect(decimalPlaces(0.001)).toBe(3)
		expect(decimalPlaces('1.500')).toBe(1)
		expect(decimalPlaces('-0.009')).toBe(3)
		expect(decimalPlaces(1e-7)).toBe(7)
		expect(decimalPlaces(1e21)).toBe(0)
	})

	it('is NaN for non-numeric input', () => {
		expect(decimalPlaces('abc')).toBeNaN()
		expect(decimalPlaces('')).toBeNaN()
		expect(decimalPlaces(Number.NaN)).toBeNaN()
		expect(decimalPlaces(Number.POSITIVE_INFINITY)).toBeNaN()
	})
})

describe('hasAtMostDecimals', () => {
	it('accepts cents and rejects sub-cent amounts', () => {
		expect(hasAtMostDecimals(0.01)).toBe(true)
		expect(hasAtMostDecimals(1234567890123.45)).toBe(true)
		expect(hasAtMostDecimals(0.07)).toBe(true)
		expect(hasAtMostDecimals(0.001)).toBe(false)
		expect(hasAtMostDecimals(1.005)).toBe(false)
		expect(hasAtMostDecimals('12.345')).toBe(false)
		expect(hasAtMostDecimals(0.0001, 4)).toBe(true)
	})
})
