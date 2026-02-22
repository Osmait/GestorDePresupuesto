import { describe, expect, it } from 'vitest'
import { ApiError, normalizeUserError, toApiError } from '@/lib/api-error'

describe('api-error utilities', () => {
	it('parses structured backend error response', async () => {
		const response = new Response(JSON.stringify({
			error: {
				code: 'ACCOUNT_CURRENCY_MISMATCH',
				message: 'currency mismatch',
				details: { expected: 'DOP' },
				type: 'validation',
				retryable: false,
			},
		}), {
			status: 400,
			headers: {
				'Content-Type': 'application/json',
				'X-Request-ID': 'req-123',
			},
		})

		const error = await toApiError(response)
		expect(error).toBeInstanceOf(ApiError)
		expect(error.code).toBe('ACCOUNT_CURRENCY_MISMATCH')
		expect(error.status).toBe(400)
		expect(error.requestId).toBe('req-123')
	})

	it('builds user-friendly messages from error codes', () => {
		const error = new ApiError('currency mismatch', {
			code: 'ACCOUNT_CURRENCY_MISMATCH',
			status: 400,
			requestId: 'req-123',
		})

		expect(normalizeUserError(error)).toBe('The transaction currency does not match the selected account currency.')
	})
})
