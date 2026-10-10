import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	clearTransactionDraft,
	loadTransactionDraft,
	saveTransactionDraft,
	transactionDraftKey,
} from '@/components/transactions/TransactionFormModal'
import { TypeTransaction } from '@/types/transaction'

describe('transaction form draft (session expiry)', () => {
	afterEach(() => {
		window.sessionStorage.clear()
		vi.restoreAllMocks()
	})

	it('keys drafts by user and form', () => {
		expect(transactionDraftKey('u1')).not.toBe(transactionDraftKey('u2'))
		expect(transactionDraftKey('u1')).not.toBe(transactionDraftKey('u1', 'tx-9'))
		expect(transactionDraftKey('u1', null)).toBe(transactionDraftKey('u1'))
	})

	it('round-trips the form values, including the date', () => {
		const key = transactionDraftKey('u1')
		const createdAt = new Date('2026-05-04T10:00:00.000Z')

		expect(
			saveTransactionDraft(key, {
				name: 'Supermercado',
				amount: 125.5,
				type_transaction: TypeTransaction.BILL,
				account_id: 'acc-1',
				category_id: 'cat-1',
				currency: 'DOP',
				created_at: createdAt,
			}),
		).toBe(true)

		const draft = loadTransactionDraft(key)
		expect(draft).toMatchObject({ name: 'Supermercado', amount: 125.5, account_id: 'acc-1', currency: 'DOP' })
		expect(draft?.created_at).toBeInstanceOf(Date)
		expect(draft?.created_at?.toISOString()).toBe(createdAt.toISOString())
		expect(loadTransactionDraft(transactionDraftKey('u2'))).toBeNull()

		clearTransactionDraft(key)
		expect(loadTransactionDraft(key)).toBeNull()
	})

	it('never throws when storage is unavailable or the draft is corrupted', () => {
		const key = transactionDraftKey('u1')
		window.sessionStorage.setItem(key, '{not json')
		expect(loadTransactionDraft(key)).toBeNull()

		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('QuotaExceededError')
		})
		expect(saveTransactionDraft(key, { name: 'x' })).toBe(false)
	})
})
