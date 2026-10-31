import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, vi } from 'vitest'
import TransactionsList from '@/components/transactions/TransactionsList'
import { TypeTransaction } from '@/types/transaction'

const listState = vi.hoisted(() => ({
	transactions: null as any[] | null,
	error: null as string | null,
	reloadCurrentView: vi.fn(),
	setModalOpen: vi.fn(),
}))

// Mock Hooks
vi.mock('next/navigation', () => ({
	useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next-intl', () => ({
	useTranslations: () => (key: string) => key,
}))

// Mock Contexts
vi.mock('@/components/transactions/TransactionContext', () => ({
	useTransactionContext: () => ({
		error: listState.error,
		transactions: listState.transactions ?? [
			{
				id: 't1',
				name: 'Salary',
				amount: 5000,
				type_transation: TypeTransaction.INCOME,
				category_id: 'c1',
			},
			{
				id: 't2',
				name: 'Rent',
				amount: 1000,
				type_transation: TypeTransaction.BILL,
				category_id: 'c2',
				description: 'January rent',
			},
		],
		pagination: { total_records: 2, current_page: 1, total_pages: 1 },
		isLoading: false,
	}),
	useTransactionActions: () => ({
		deleteTransaction: vi.fn(),
		clearFilters: vi.fn(),
		reloadCurrentView: listState.reloadCurrentView,
		setEditingTransaction: vi.fn(),
		setModalOpen: listState.setModalOpen,
	}),
}))

vi.mock('@/hooks/queries/useCategoriesQuery', () => ({
	useGetCategories: () => ({
		data: [
			{ id: 'c1', name: 'Work' },
			{ id: 'c2', name: 'Housing' },
		],
		isLoading: false,
	}),
}))

vi.mock('@/hooks/queries/useAccountsQuery', () => ({
	useGetAccounts: () => ({
		data: [],
		isLoading: false,
	}),
}))

// Mock Subcomponents
vi.mock('@/components/transactions/TransactionItem', () => ({
	default: ({ transaction, category, onOpenDetails }: any) => (
		<div data-testid='transaction-item'>
			{transaction.name} - {category?.name}
			<button type='button' onClick={() => onOpenDetails?.(transaction)}>
				open-{transaction.id}
			</button>
		</div>
	),
}))

vi.mock('@/components/transactions/TransactionSummaryCard', () => ({
	default: ({ transactions }: any) => <div data-testid='summary-card'>Summary: {transactions.length}</div>,
}))

vi.mock('@/components/common/animated-tabs', () => ({
	AnimatedTabs: ({ tabs }: any) => (
		<div>
			{tabs.map((t: any) => (
				<div key={t.value}>{t.label}</div>
			))}
		</div>
	),
}))

vi.mock('@/components/transactions/TransactionSort', () => ({
	TransactionSort: () => <div>Sort</div>,
}))

describe('TransactionsList', () => {
	afterEach(() => {
		listState.transactions = null
		listState.error = null
	})

	it('shows an empty state whose action opens the create modal', async () => {
		listState.transactions = []
		const user = userEvent.setup()
		render(<TransactionsList />)

		expect(screen.getByRole('heading', { name: 'noTransactions' })).toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'addTransaction' }))
		expect(listState.setModalOpen).toHaveBeenCalledWith(true)
	})

	it('shows an error state with retry when the first load fails', async () => {
		listState.transactions = []
		listState.error = 'Network error'
		const user = userEvent.setup()
		render(<TransactionsList />)

		expect(screen.getByRole('alert')).toBeInTheDocument()
		expect(screen.queryByText('Network error')).not.toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'retry' }))
		expect(listState.reloadCurrentView).toHaveBeenCalled()
	})

	it('renders list of transactions', () => {
		render(<TransactionsList />)
		expect(screen.getByTestId('summary-card')).toBeInTheDocument()
		expect(screen.getAllByTestId('transaction-item')).toHaveLength(2)
		expect(screen.getByText('Salary - Work')).toBeInTheDocument()
		expect(screen.getByText('Rent - Housing')).toBeInTheDocument()
	})

	it('shows a signed, formatted amount and a translated type in the details modal', async () => {
		const user = userEvent.setup()
		render(<TransactionsList />)

		await user.click(screen.getByRole('button', { name: 'open-t2' }))
		const dialog = await screen.findByRole('dialog')
		// Expense: negative sign, RD$ (default currency), 2 decimals; never "+$"
		expect(within(dialog).getByText('-RD$1,000.00')).toHaveClass('text-destructive')
		// Raw value "bill" is mapped to the i18n key transactions.types.bill
		expect(within(dialog).getByText('types.bill')).toBeInTheDocument()
		expect(within(dialog).queryByText('bill')).not.toBeInTheDocument()
	})

	it('keeps the details modal within the viewport and scrollable', async () => {
		const user = userEvent.setup()
		render(<TransactionsList />)

		await user.click(screen.getByRole('button', { name: 'open-t2' }))
		const dialog = await screen.findByRole('dialog')
		expect(dialog).toHaveClass('max-h-[90dvh]', 'overflow-y-auto')
	})

	it('shows income with a plus sign', async () => {
		const user = userEvent.setup()
		render(<TransactionsList />)

		await user.click(screen.getByRole('button', { name: 'open-t1' }))
		const dialog = await screen.findByRole('dialog')
		expect(within(dialog).getByText('+RD$5,000.00')).toHaveClass('text-success')
		expect(within(dialog).getByText('types.income')).toBeInTheDocument()
	})

	it('shows the description, or a muted placeholder when there is none', async () => {
		const user = userEvent.setup()
		render(<TransactionsList />)

		await user.click(screen.getByRole('button', { name: 'open-t1' }))
		let dialog = await screen.findByRole('dialog')
		expect(within(dialog).getByText('noDescription')).toHaveClass('italic')
		expect(within(dialog).queryByText('description')).not.toBeInTheDocument()

		await user.keyboard('{Escape}')
		await user.click(screen.getByRole('button', { name: 'open-t2' }))
		dialog = await screen.findByRole('dialog')
		expect(within(dialog).getByText('January rent')).not.toHaveClass('italic')
	})
})
