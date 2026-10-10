import { describe, expect, it } from 'vitest'
import { getSignedAmount, getTransactionTypeKey, isInflowTransaction } from '@/lib/transaction-utils'
import { TypeTransaction } from '@/types/transaction'

describe('transaction-utils', () => {
	it('treats income and loan collections as inflows', () => {
		expect(isInflowTransaction(TypeTransaction.INCOME)).toBe(true)
		expect(isInflowTransaction(TypeTransaction.LOAN_COLLECTION)).toBe(true)
		expect(isInflowTransaction(TypeTransaction.BILL)).toBe(false)
		expect(isInflowTransaction(TypeTransaction.INVESTMENT_FUNDING)).toBe(false)
		expect(isInflowTransaction(undefined)).toBe(false)
	})

	it('signs amounts by type (the API sends positive amounts)', () => {
		expect(getSignedAmount({ amount: 0.01, type_transation: TypeTransaction.BILL })).toBe(-0.01)
		expect(getSignedAmount({ amount: 1500.5, type_transation: TypeTransaction.INCOME })).toBe(1500.5)
		expect(getSignedAmount({ amount: -20, type_transation: TypeTransaction.BILL })).toBe(-20)
	})

	it('maps type values to i18n keys', () => {
		expect(getTransactionTypeKey('bill')).toBe('types.bill')
		expect(getTransactionTypeKey('income')).toBe('types.income')
		expect(getTransactionTypeKey('something-new')).toBe('types.unknown')
	})
})
