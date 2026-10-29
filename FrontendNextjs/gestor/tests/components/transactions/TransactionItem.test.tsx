import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { vi } from 'vitest'
import TransactionItem from '@/components/transactions/TransactionItem'
import { TypeTransaction } from '@/types/transaction'

vi.mock('next-intl', () => ({
	useTranslations: () => (key: string, values?: Record<string, unknown>) =>
		values ? `${key}(${Object.values(values).join(',')})` : key,
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

// Mock dependencies
vi.mock('lucide-react', async () => {
	const actual = await vi.importActual('lucide-react')
	return {
		...actual,
		// Add any specific mocks if necessary
	}
})

describe('TransactionItem', () => {
	const mockTransaction = {
		id: 't1',
		name: 'Netflix Subscription',
		description: 'Monthly payment',
		amount: 15.99,
		type_transation: TypeTransaction.BILL,
		created_at: new Date('2024-01-01T12:00:00Z').toISOString(),
		account_id: 'a1',
		category_id: 'c1',
		user_id: 'u1',
	}

	const mockCategory = {
		id: 'c1',
		name: 'Entertainment',
		icon: '🎬',
		color: '#FF0000',
		user_id: 'u1',
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	}

	it('renders transaction details correctly', () => {
		render(<TransactionItem transaction={mockTransaction} category={mockCategory} />)

		expect(screen.getByText('Netflix Subscription')).toBeInTheDocument()
		expect(screen.getByText('Monthly payment')).toBeInTheDocument()
		expect(screen.getByText('Entertainment')).toBeInTheDocument()
		expect(screen.getByText((content) => content.includes('15.99'))).toBeInTheDocument()
	})

	it('renders an expense as a negative amount in the destructive tone', () => {
		render(<TransactionItem transaction={mockTransaction} />)

		const amountText = screen.getByText((content) => content.includes('15.99'))
		expect(amountText).toHaveAttribute('data-tone', 'negative')
		expect(amountText).toHaveClass('text-destructive')
		expect(amountText).toHaveTextContent('-')
	})

	it('renders an income as a positive amount in the success tone', () => {
		const incomeTransaction = {
			...mockTransaction,
			name: 'Salary',
			amount: 5000,
			type_transation: TypeTransaction.INCOME,
		}

		render(<TransactionItem transaction={incomeTransaction} />)

		const amountText = screen.getByText((content) => content.includes('5,000'))
		expect(amountText).toHaveAttribute('data-tone', 'positive')
		expect(amountText).toHaveClass('text-success')
		expect(amountText).toHaveTextContent('+')
	})

	it('formats the amount with the account currency, sign and 2 decimals', () => {
		render(<TransactionItem transaction={{ ...mockTransaction, amount: 1500.5, currency: 'DOP' }} />)
		expect(screen.getByText('-RD$1,500.50')).toBeInTheDocument()

		render(
			<TransactionItem
				transaction={{
					...mockTransaction,
					id: 't2',
					amount: 20,
					currency: 'USD',
					type_transation: TypeTransaction.INCOME,
				}}
			/>,
		)
		expect(screen.getByText('+US$20.00')).toBeInTheDocument()
	})

	it('opens the details when the card is clicked', async () => {
		const user = userEvent.setup()
		const onOpenDetails = vi.fn()
		render(<TransactionItem transaction={mockTransaction} onOpenDetails={onOpenDetails} />)

		await user.click(screen.getByTestId('transaction-card'))
		expect(onOpenDetails).toHaveBeenCalledWith(mockTransaction)
	})

	it('opens the details from the keyboard through the name button', async () => {
		const user = userEvent.setup()
		const onOpenDetails = vi.fn()
		render(<TransactionItem transaction={mockTransaction} onOpenDetails={onOpenDetails} />)

		screen.getByRole('button', { name: 'Netflix Subscription' }).focus()
		await user.keyboard('{Enter}')
		expect(onOpenDetails).toHaveBeenCalledTimes(1)
	})

	it('confirming delete does not open the details of the deleted transaction', async () => {
		const user = userEvent.setup()
		const onOpenDetails = vi.fn()
		const onTransactionDeleted = vi.fn().mockResolvedValue(undefined)
		render(
			<TransactionItem
				transaction={mockTransaction}
				onOpenDetails={onOpenDetails}
				onTransactionDeleted={onTransactionDeleted}
			/>,
		)

		await user.click(screen.getByRole('button', { name: 'actions.rowMenu(Netflix Subscription)' }))
		await user.click(await screen.findByRole('menuitem', { name: 'delete' }))

		const dialog = await screen.findByRole('alertdialog')
		expect(dialog).toHaveTextContent('deleteTitle')
		// ConfirmDialog's confirm button (common.actions.delete)
		await user.click(within(dialog).getByRole('button', { name: 'delete' }))

		await waitFor(() => expect(onTransactionDeleted).toHaveBeenCalledTimes(1))
		await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
		expect(onOpenDetails).not.toHaveBeenCalled()
	})

	it('cancelling the delete dialog does not open the details either', async () => {
		const user = userEvent.setup()
		const onOpenDetails = vi.fn()
		render(
			<TransactionItem transaction={mockTransaction} onOpenDetails={onOpenDetails} onTransactionDeleted={vi.fn()} />,
		)

		await user.click(screen.getByRole('button', { name: 'actions.rowMenu(Netflix Subscription)' }))
		await user.click(await screen.findByRole('menuitem', { name: 'delete' }))
		await user.click(await screen.findByRole('button', { name: 'cancel' }))

		await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
		expect(onOpenDetails).not.toHaveBeenCalled()
	})

	it('keeps the confirmation open and reports the error when the delete fails', async () => {
		const user = userEvent.setup()
		const onTransactionDeleted = vi.fn().mockRejectedValue(new Error('boom'))
		render(<TransactionItem transaction={mockTransaction} onTransactionDeleted={onTransactionDeleted} />)

		await user.click(screen.getByRole('button', { name: 'actions.rowMenu(Netflix Subscription)' }))
		await user.click(await screen.findByRole('menuitem', { name: 'delete' }))
		const dialog = await screen.findByRole('alertdialog')
		await user.click(within(dialog).getByRole('button', { name: 'delete' }))

		await waitFor(() => expect(toast.error).toHaveBeenCalledWith('deleteError'))
		expect(screen.getByRole('alertdialog')).toBeInTheDocument()
	})

	it('names the transaction (not its description) in the delete confirmation', async () => {
		const user = userEvent.setup()
		render(<TransactionItem transaction={mockTransaction} onTransactionDeleted={vi.fn()} />)

		await user.click(screen.getByRole('button', { name: 'actions.rowMenu(Netflix Subscription)' }))
		await user.click(await screen.findByRole('menuitem', { name: 'delete' }))

		const dialog = await screen.findByRole('alertdialog')
		expect(dialog).toHaveTextContent('deleteDescription(Netflix Subscription)')
		expect(dialog).not.toHaveTextContent('Monthly payment')
	})

	it('offers edit for a regular transaction but not for a balance adjustment', async () => {
		const user = userEvent.setup()
		const onEdit = vi.fn()
		const { unmount } = render(
			<TransactionItem transaction={mockTransaction} onEdit={onEdit} onTransactionDeleted={vi.fn()} />,
		)
		await user.click(screen.getByRole('button', { name: 'actions.rowMenu(Netflix Subscription)' }))
		expect(await screen.findByRole('menuitem', { name: 'edit' })).toBeInTheDocument()
		unmount()

		const adjustment = {
			...mockTransaction,
			name: 'Balance adjustment',
			type_transation: TypeTransaction.ADJUSTMENT_OUT,
		}
		render(<TransactionItem transaction={adjustment} onEdit={onEdit} onTransactionDeleted={vi.fn()} />)
		await user.click(screen.getByRole('button', { name: 'actions.rowMenu(Balance adjustment)' }))
		expect(await screen.findByRole('menuitem', { name: 'delete' })).toBeInTheDocument()
		expect(screen.queryByRole('menuitem', { name: 'edit' })).not.toBeInTheDocument()
	})
})
