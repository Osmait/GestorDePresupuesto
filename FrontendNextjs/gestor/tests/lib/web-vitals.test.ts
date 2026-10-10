import { describe, expect, it } from 'vitest'
import { normalizeRoute, parseSampleRate, webVitalSchema } from '@/lib/telemetry/web-vitals'

describe('normalizeRoute', () => {
	it.each([
		['/', '/'],
		['/app/transactions', '/app/transactions'],
		['/app/accounts/3f2a9c1e-1b2c-4d5e-8f90-123456789abc/edit', '/app/accounts/:id/edit'],
		['/app/loans/42?tab=history', '/app/loans/:id'],
		['/app/x/AbC123def456ghi789', '/app/x/:id'],
		['/app/Weird%20Path', '/app/:param'],
		['/a/b/c/d/e/f/g', '/a/b/c/d/e'],
	])('%s -> %s', (input, expected) => {
		expect(normalizeRoute(input)).toBe(expected)
	})
})

describe('parseSampleRate', () => {
	it.each([
		[undefined, 0],
		['', 0],
		['abc', 0],
		['-1', 0],
		['0', 0],
		['0.25', 0.25],
		['5', 1],
	])('%s -> %s', (input, expected) => {
		expect(parseSampleRate(input)).toBe(expected)
	})
})

describe('webVitalSchema', () => {
	it('accepts a Next.js web vital and rejects unknown names', () => {
		expect(webVitalSchema.safeParse({ name: 'LCP', value: 1234.5, rating: 'good', route: '/app' }).success).toBe(true)
		expect(webVitalSchema.safeParse({ name: 'XSS', value: 1, rating: 'good', route: '/' }).success).toBe(false)
		expect(webVitalSchema.safeParse({ name: 'CLS', value: -1, rating: 'good', route: '/' }).success).toBe(false)
	})
})
