import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { BudgetCard } from '@/components/budgets/BudgetCard'
import { renderWithIntl } from '@/tests/utils/intl'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

describe('BudgetCard', () => {
	const mockBudget = {
		id: 'b1',
		amount: 1000,
		current_amount: 800, // Spent 800 (positive = spent in the component)
		category_id: 'c1',
		user_id: 'u1',
		created_at: '',
		updated_at: '',
	}

	const mockCategory = {
		id: 'c1',
		name: 'Groceries',
		icon: '🛒',
		color: 'blue',
		user_id: 'u1',
		created_at: '',
		updated_at: '',
	}

	function renderCard(props: Partial<Parameters<typeof BudgetCard>[0]> = {}) {
		return renderWithIntl(
			<BudgetCard
				budget={mockBudget}
				category={mockCategory}
				transactionCount={3}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				{...props}
			/>,
		)
	}

	it('renders the budget as a link to its transactions with the amounts', () => {
		renderCard()

		const link = screen.getByRole('link', { name: 'Budget for Groceries' })
		expect(link).toHaveAttribute('href', '/app/transactions?budget=b1')
		expect(screen.getByText('RD$1,000.00')).toBeInTheDocument()
		expect(screen.getByText('RD$800.00')).toBeInTheDocument()
		expect(screen.getByText('RD$200.00')).toBeInTheDocument()
		expect(screen.getByText((content) => content.startsWith('3 '))).toBeInTheDocument()
	})

	it('uses the shared progress bar with an accessible name and a tone', () => {
		renderCard({ budget: { ...mockBudget, current_amount: 900 } })
		const bar = screen.getByRole('progressbar', { name: 'Budget used for Groceries' })
		expect(bar).toHaveAttribute('aria-valuenow', '90')
		expect(bar.firstElementChild).toHaveClass('bg-warning')
		expect(screen.getByText('Critical')).toBeInTheDocument()
	})

	it('marks an overspent budget as exceeded in the destructive tone', () => {
		renderCard({ budget: { ...mockBudget, current_amount: 1300 } })
		expect(screen.getByText('Exceeded')).toBeInTheDocument()
		expect(screen.getByText('-RD$300.00')).toHaveClass('text-destructive')
		expect(screen.getByRole('progressbar').firstElementChild).toHaveClass('bg-destructive')
	})

	it('triggers the edit action from the labelled menu', async () => {
		const user = userEvent.setup()
		const onEdit = vi.fn()
		renderCard({ onEdit })

		await user.click(screen.getByRole('button', { name: 'Actions for Groceries' }))
		await user.click(await screen.findByRole('menuitem', { name: 'Edit budget' }))

		expect(onEdit).toHaveBeenCalledWith(mockBudget)
	})

	it('deletes after confirming', async () => {
		const user = userEvent.setup()
		const onDelete = vi.fn().mockResolvedValue(undefined)
		renderCard({ onDelete })

		await user.click(screen.getByRole('button', { name: 'Actions for Groceries' }))
		await user.click(await screen.findByRole('menuitem', { name: 'Delete budget' }))
		const dialog = await screen.findByRole('alertdialog', { name: 'Delete the budget for "Groceries"?' })
		await user.click(screen.getByRole('button', { name: 'Delete' }))

		expect(onDelete).toHaveBeenCalledWith('b1')
		await waitFor(() => expect(dialog).not.toBeInTheDocument())
	})

	it('compact read-only variant has no menu, hint or transaction count', () => {
		renderWithIntl(<BudgetCard budget={mockBudget} category={mockCategory} compact />)
		expect(screen.queryByRole('button')).not.toBeInTheDocument()
		expect(screen.queryByText('Transactions')).not.toBeInTheDocument()
	})
})
