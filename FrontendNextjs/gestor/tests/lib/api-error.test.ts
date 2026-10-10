import { describe, expect, it } from 'vitest'
import { getApiErrorCode, getInsufficientFunds, getInsufficientFundsMessage, getSafeErrorDetail } from '@/lib/api-error'

function apiError(message: string, status?: number) {
	return Object.assign(new Error(message), { status })
}

describe('getSafeErrorDetail', () => {
	it('returns the backend message of a 4xx answer', () => {
		expect(getSafeErrorDetail(apiError('insufficient funds', 422))).toBe('insufficient funds')
		expect(getSafeErrorDetail(apiError('  amount must be positive ', 400))).toBe('amount must be positive')
	})

	it('hides server, auth, network and generic errors', () => {
		expect(getSafeErrorDetail(apiError('pq: relation does not exist', 500))).toBeNull()
		expect(getSafeErrorDetail(apiError('Session expired. Please log in again.', 401))).toBeNull()
		expect(getSafeErrorDetail(new TypeError('Failed to fetch'))).toBeNull()
		expect(getSafeErrorDetail(apiError('HTTP error! status: 404 - Not Found', 404))).toBeNull()
		expect(getSafeErrorDetail(apiError('x'.repeat(301), 400))).toBeNull()
		expect(getSafeErrorDetail('boom')).toBeNull()
	})
})

function codedError(code: string, details?: unknown) {
	return Object.assign(new Error('insufficient funds: ...'), { status: 400, code, details })
}

describe('INSUFFICIENT_FUNDS', () => {
	const tForms = (key: string, values?: Record<string, string | number>) =>
		values ? `${key}:${JSON.stringify(values)}` : key

	it('reads the stable error code', () => {
		expect(getApiErrorCode(codedError('INSUFFICIENT_FUNDS'))).toBe('INSUFFICIENT_FUNDS')
		expect(getApiErrorCode(new Error('x'))).toBeNull()
		expect(getApiErrorCode('x')).toBeNull()
	})

	it('extracts the available balance from the details', () => {
		expect(getInsufficientFunds(codedError('INSUFFICIENT_FUNDS', { available: '50.00', currency: 'DOP' }))).toEqual({
			available: 50,
			currency: 'DOP',
		})
		expect(getInsufficientFunds(codedError('INSUFFICIENT_FUNDS'))).toEqual({ available: null, currency: null })
		expect(getInsufficientFunds(codedError('VALIDATION_FAILED'))).toBeNull()
	})

	it('builds a translated message with the formatted balance', () => {
		const error = codedError('INSUFFICIENT_FUNDS', { available: '1234.5', currency: 'USD' })
		expect(getInsufficientFundsMessage(error, tForms, 'en')).toBe('insufficientFundsAvailable:{"amount":"US$1,234.50"}')
		expect(getInsufficientFundsMessage(codedError('INSUFFICIENT_FUNDS'), tForms, 'en')).toBe('insufficientFunds')
		expect(getInsufficientFundsMessage(codedError('BAD_REQUEST'), tForms, 'en')).toBeNull()
	})
})
