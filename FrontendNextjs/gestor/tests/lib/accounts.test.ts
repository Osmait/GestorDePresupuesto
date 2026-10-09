import { describe, expect, it } from 'vitest'
import { isFundingAccount } from '@/lib/accounts'

describe('isFundingAccount', () => {
	it('excludes credit cards from funding / payout selectors', () => {
		expect(isFundingAccount({ type: 'bank' })).toBe(true)
		expect(isFundingAccount({ type: undefined })).toBe(true)
		expect(isFundingAccount({ type: 'credit_card' })).toBe(false)
	})
})
