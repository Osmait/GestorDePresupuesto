import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import TransactionItem from '@/components/transactions/TransactionItem'
import { TypeTransaction } from '@/types/transaction'

vi.mock('next-intl', () => ({
	useTranslations: () => (key: string, values?: Record<string, unknown>) =>
		values ? `${key}(${Object.values(values).join(',')})` : key,
}))

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

	it('renders expense with red styling', () => {
		render(<TransactionItem transaction={mockTransaction} />)

		// Find Element by text might fail if split, so we find the amount number first
		// Or check the amount text present in the card
		const amountText = screen.getByText((content, element) => {
			return element?.tagName.toLowerCase() === 'p' && content.includes('15.99')
		})
		expect(amountText).toBeInTheDocument()
		expect(amountText).toHaveClass('text-red-600')
		expect(amountText).toHaveTextContent('-')
	})

	it('renders income with green styling', () => {
		const incomeTransaction = {
			...mockTransaction,
			name: 'Salary',
			amount: 5000,
			type_transation: TypeTransaction.INCOME,
		}

		render(<TransactionItem transaction={incomeTransaction} />)

		const amountText = screen.getByText((content, element) => {
			return element?.tagName.toLowerCase() === 'p' && content.includes('5,000')
		})
		expect(amountText).toBeInTheDocument()
		expect(amountText).toHaveClass('text-green-600')
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

		await user.click(screen.getByRole('button', { name: 'options' }))
		await user.click(await screen.findByRole('menuitem', { name: 'delete' }))

		const dialog = await screen.findByRole('dialog')
		expect(dialog).toHaveTextContent('deleteTitle')
		// The confirm button is the one inside the dialog footer labelled "delete"
		const confirm = Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent === 'delete')
		expect(confirm).toBeDefined()
		await user.click(confirm!)

		await waitFor(() => expect(onTransactionDeleted).toHaveBeenCalledTimes(1))
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(onOpenDetails).not.toHaveBeenCalled()
	})

	it('cancelling the delete dialog does not open the details either', async () => {
		const user = userEvent.setup()
		const onOpenDetails = vi.fn()
		render(
			<TransactionItem transaction={mockTransaction} onOpenDetails={onOpenDetails} onTransactionDeleted={vi.fn()} />,
		)

		await user.click(screen.getByRole('button', { name: 'options' }))
		await user.click(await screen.findByRole('menuitem', { name: 'delete' }))
		await user.click(await screen.findByRole('button', { name: 'cancel' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(onOpenDetails).not.toHaveBeenCalled()
	})

	it('names the transaction (not its description) in the delete confirmation', async () => {
		const user = userEvent.setup()
		render(<TransactionItem transaction={mockTransaction} onTransactionDeleted={vi.fn()} />)

		await user.click(screen.getByRole('button', { name: 'options' }))
		await user.click(await screen.findByRole('menuitem', { name: 'delete' }))

		const dialog = await screen.findByRole('dialog')
		expect(dialog).toHaveTextContent('deleteDescription(Netflix Subscription)')
		expect(dialog).not.toHaveTextContent('Monthly payment')
	})
})
