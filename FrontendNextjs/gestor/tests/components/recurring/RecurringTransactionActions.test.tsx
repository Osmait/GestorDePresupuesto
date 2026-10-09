import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { RecurringTransactionActions } from '@/components/recurring/RecurringTransactionActions'
import { renderWithIntl } from '@/tests/utils/intl'

// Mock context
const mockSetModalOpen = vi.fn()
const mockSetEditingTransaction = vi.fn()
vi.mock('@/components/recurring/RecurringTransactionContext', () => ({
	useRecurringTransactionContext: () => ({
		setModalOpen: mockSetModalOpen,
		setEditingTransaction: mockSetEditingTransaction,
	}),
}))

// Mock mutation
vi.mock('@/hooks/queries/useRecurringTransactionsQuery', () => ({
	useProcessRecurringTransactionsMutation: () => ({
		mutate: vi.fn(),
		isPending: false,
	}),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}))

describe('RecurringTransactionActions', () => {
	beforeEach(() => {
		mockSetModalOpen.mockClear()
		mockSetEditingTransaction.mockClear()
	})

	it('renders action buttons in Spanish', () => {
		renderWithIntl(<RecurringTransactionActions />, { locale: 'es' })

		expect(screen.getByText('Ejecutar ahora')).toBeInTheDocument()
		expect(screen.getByText('Nueva recurrente')).toBeInTheDocument()
	})

	it('renders action buttons in English', () => {
		renderWithIntl(<RecurringTransactionActions />)

		expect(screen.getByText('Run now')).toBeInTheDocument()
		expect(screen.getByText('New recurring')).toBeInTheDocument()
	})

	it('opens modal when new button is clicked', async () => {
		const user = userEvent.setup()
		renderWithIntl(<RecurringTransactionActions />)

		await user.click(screen.getByText('New recurring'))

		expect(mockSetEditingTransaction).toHaveBeenCalledWith(null)
		expect(mockSetModalOpen).toHaveBeenCalledWith(true)
	})

	it('shows confirmation dialog when execute button is clicked', async () => {
		const user = userEvent.setup()
		renderWithIntl(<RecurringTransactionActions />)

		await user.click(screen.getByText('Run now'))

		expect(await screen.findByText('Run recurring transactions')).toBeInTheDocument()
		expect(await screen.findByText('Confirm run')).toBeInTheDocument()
	})
})
