import { screen } from '@testing-library/react'
import { BudgetSummaryCard } from '@/components/budgets/BudgetSummaryCard'
import { renderWithIntl } from '@/tests/utils/intl'

function statValue(label: string) {
	const card = screen.getByText(label).closest('.p-5') as HTMLElement
	return card.querySelector('.text-2xl') as HTMLElement
}

describe('BudgetSummaryCard', () => {
	const mockBudgets = [
		{
			id: '1',
			amount: 1000,
			current_amount: 500, // spent 500
			category_id: 'c1',
			user_id: 'u1',
			created_at: '',
			updated_at: '',
		},
		{
			id: '2',
			amount: 2000,
			current_amount: 2100, // spent 2100 (over budget)
			category_id: 'c2',
			user_id: 'u1',
			created_at: '',
			updated_at: '',
		},
	]

	it('calculates totals in StatCards', () => {
		renderWithIntl(<BudgetSummaryCard budgets={mockBudgets} />)

		expect(statValue('Total Budget')).toHaveTextContent('RD$3,000.00')
		expect(statValue('Total Spent')).toHaveTextContent('RD$2,600.00')
		expect(statValue('Total Remaining')).toHaveTextContent('RD$400.00')
		// Budget 2 has current_amount > amount.
		expect(statValue('Exceeded Budgets')).toHaveTextContent('1')
		expect(statValue('Exceeded Budgets')).toHaveClass('text-destructive')
	})

	it('flags a negative remaining total', () => {
		renderWithIntl(<BudgetSummaryCard budgets={[{ ...mockBudgets[1] }]} />)
		expect(statValue('Total Remaining')).toHaveTextContent('-RD$100.00')
		expect(statValue('Total Remaining')).toHaveClass('text-destructive')
	})
})
