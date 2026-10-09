import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSession } from 'next-auth/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import TransactionFormModal, {
	loadTransactionDraft,
	saveTransactionDraft,
	transactionDraftKey,
} from '@/components/transactions/TransactionFormModal'
import { renderWithIntl } from '@/tests/utils/intl'
import { TypeTransaction } from '@/types/transaction'

beforeAll(() => {
	HTMLElement.prototype.hasPointerCapture = vi.fn()
	HTMLElement.prototype.scrollIntoView = vi.fn()
	global.ResizeObserver = class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof globalThis.ResizeObserver
})

vi.mock('@/components/transactions/TransactionContext', () => ({
	useTransactionContext: () => ({ editingTransaction: null, updateTransaction: vi.fn() }),
}))
vi.mock('@/hooks/queries/useAccountsQuery', () => ({
	useGetAccounts: () => ({
		data: [{ id: 'acc-1', name: 'Checking', bank: 'BPD', type: 'bank', currency: 'DOP' }],
	}),
}))
vi.mock('@/hooks/queries/useCategoriesQuery', () => ({
	useGetCategories: () => ({ data: [{ id: 'cat-1', name: 'Food', icon: '🍔' }], refetch: vi.fn() }),
	useCreateCategoryMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/queries/useBudgetsQuery', () => ({ useGetBudgets: () => ({ data: [] }) }))
vi.mock('@/hooks/queries/useAIQuery', () => ({
	useSuggestCategoryMutation: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/hooks/useFeatureFlags', () => ({
	useFeatureFlags: () => ({ isEnabled: () => false, isLoading: false }),
}))
vi.mock('@/lib/repositoryConfig', () => ({ getCreditCardRepository: vi.fn() }))

describe('TransactionFormModal draft restore', () => {
	const draftKey = transactionDraftKey('u1')

	beforeEach(() => {
		vi.mocked(useSession).mockReturnValue({
			data: { user: { id: 'u1' }, expires: '' },
			status: 'authenticated',
			update: vi.fn(),
		} as any)
		saveTransactionDraft(draftKey, {
			name: 'Borrador perdido',
			description: '',
			amount: 777.77,
			type_transaction: TypeTransaction.BILL,
			account_id: 'acc-1',
			category_id: 'cat-1',
			currency: 'DOP',
			created_at: new Date('2026-05-04T10:00:00.000Z'),
		})
	})

	afterEach(() => {
		window.sessionStorage.clear()
		vi.mocked(useSession).mockReset()
	})

	it('shows a clean form when reopened after the restored draft was submitted', async () => {
		const user = userEvent.setup()
		const createTransaction = vi.fn().mockResolvedValue(undefined)
		const setOpen = vi.fn()
		const props = { setOpen, createTransaction, isLoading: false, error: null }

		const { rerender } = renderWithIntl(<TransactionFormModal open {...props} />)

		await waitFor(() => expect(screen.getByPlaceholderText('Ex: Electricity bill')).toHaveValue('Borrador perdido'))
		expect(screen.getByText(/We restored the draft/)).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: /Create Transaction/ }))

		await waitFor(() => expect(createTransaction).toHaveBeenCalledTimes(1))
		expect(createTransaction.mock.calls[0][0]).toBe('Borrador perdido')
		expect(createTransaction.mock.calls[0][2]).toBe(777.77)
		await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false))
		expect(loadTransactionDraft(draftKey)).toBeNull()

		rerender(<TransactionFormModal open={false} {...props} />)
		rerender(<TransactionFormModal open {...props} />)

		const nameInput = await screen.findByPlaceholderText('Ex: Electricity bill')
		expect(nameInput).toHaveValue('')
		expect(screen.getByRole('spinbutton')).not.toHaveValue(777.77)
		expect(screen.queryByText(/We restored the draft/)).not.toBeInTheDocument()
	})
})
