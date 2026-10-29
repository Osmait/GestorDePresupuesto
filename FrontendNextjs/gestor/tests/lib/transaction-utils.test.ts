import { describe, expect, it } from 'vitest'
import {
	getSignedAmount,
	getTransactionTypeKey,
	isAdjustmentTransaction,
	isDeletableTransaction,
	isEditableTransaction,
	isInflowTransaction,
} from '@/lib/transaction-utils'
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

	it('signs balance adjustments by direction and maps them to their own keys', () => {
		expect(isInflowTransaction(TypeTransaction.ADJUSTMENT_IN)).toBe(true)
		expect(isInflowTransaction(TypeTransaction.ADJUSTMENT_OUT)).toBe(false)
		expect(getSignedAmount({ amount: 50.5, type_transation: TypeTransaction.ADJUSTMENT_IN })).toBe(50.5)
		expect(getSignedAmount({ amount: 50.5, type_transation: TypeTransaction.ADJUSTMENT_OUT })).toBe(-50.5)
		expect(getTransactionTypeKey('adjustment_in')).toBe('types.adjustment_in')
		expect(getTransactionTypeKey('adjustment_out')).toBe('types.adjustment_out')
	})

	it('flags only the adjustment types as adjustments', () => {
		expect(isAdjustmentTransaction(TypeTransaction.ADJUSTMENT_IN)).toBe(true)
		expect(isAdjustmentTransaction(TypeTransaction.ADJUSTMENT_OUT)).toBe(true)
		expect(isAdjustmentTransaction(TypeTransaction.BILL)).toBe(false)
		expect(isAdjustmentTransaction(undefined)).toBe(false)
	})

	it('treats a card payment received as an inflow on the card, neither editable nor deletable alone', () => {
		expect(isInflowTransaction(TypeTransaction.CARD_PAYMENT_RECEIVED)).toBe(true)
		expect(isInflowTransaction(TypeTransaction.CARD_PAYMENT)).toBe(false)
		expect(getTransactionTypeKey('card_payment_received')).toBe('types.card_payment_received')
		expect(getTransactionTypeKey('card_payment')).toBe('types.card_payment')
		expect(isEditableTransaction(TypeTransaction.CARD_PAYMENT_RECEIVED)).toBe(false)
		expect(isDeletableTransaction(TypeTransaction.CARD_PAYMENT_RECEIVED)).toBe(false)
		expect(isEditableTransaction(TypeTransaction.ADJUSTMENT_IN)).toBe(false)
		expect(isDeletableTransaction(TypeTransaction.ADJUSTMENT_IN)).toBe(true)
		expect(isEditableTransaction(TypeTransaction.BILL)).toBe(true)
		expect(isDeletableTransaction(TypeTransaction.BILL)).toBe(true)
	})
})
