import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { BudgetSummaryCard } from '@/components/budgets/BudgetSummaryCard'

vi.mock('next-intl', () => ({
	useTranslations: () => (key: string) => {
		const translations: Record<string, string> = {
			summary: 'Summary',
			totalBudget: 'Total Budget',
			totalSpent: 'Total Spent',
			totalRemaining: 'Total Remaining',
			exceededBudgets: 'Exceeded Budgets',
		}
		return translations[key] || key
	},
}))

// Render the final value synchronously, formatted like the real component.
vi.mock('@/components/ui/animated-counter', async () => {
	const { formatCurrency } = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils')
	return {
		AnimatedCounter: ({
			value,
			prefix = '',
			currency,
			signDisplay,
		}: {
			value: number
			prefix?: string
			currency?: string
			signDisplay?: 'exceptZero'
		}) => <span>{currency ? formatCurrency(value, currency, { signDisplay }) : `${prefix}${value}`}</span>,
	}
})

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

	it('calculates totals correctly', () => {
		render(<BudgetSummaryCard budgets={mockBudgets} />)

		// Total Budget: 1000 + 2000 = 3000
		expect(screen.getByText('Total Budget')).toBeInTheDocument()
		expect(screen.getByText('RD$3,000.00')).toBeInTheDocument()

		// Total Spent: 500 + 2100 = 2600
		expect(screen.getByText('Total Spent')).toBeInTheDocument()
		expect(screen.getByText('RD$2,600.00')).toBeInTheDocument()

		// Total Remaining: 3000 - 2600 = 400
		expect(screen.getByText('Total Remaining')).toBeInTheDocument()
		expect(screen.getByText('RD$400.00')).toBeInTheDocument()

		// Exceeded: 1 (budget 2 has current_amount > amount)
		expect(screen.getByText('Exceeded Budgets')).toBeInTheDocument()
		expect(screen.getByText('1')).toBeInTheDocument()
	})
})
