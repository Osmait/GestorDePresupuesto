import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import TransactionSummaryCard from '@/components/transactions/TransactionSummaryCard'
import { TypeTransaction } from '@/types/transaction'

// Mock dependencies
vi.mock('next-intl', () => ({
	useLocale: () => 'es',
	useTranslations: () => (key: string) => {
		const translations: Record<string, string> = {
			summary: 'Summary',
			totalIncome: 'Total Income',
			totalExpenses: 'Total Expenses',
			totalTransactions: 'Total Transactions',
		}
		return translations[key] || key
	},
}))

vi.mock('@/components/common/AnimatedFlashNumber', () => ({
	AnimatedFlashNumber: ({
		value,
		prefix = '',
		formattingFn,
	}: {
		value: number
		prefix?: string
		formattingFn?: (_n: number) => string
	}) => <span>{formattingFn ? formattingFn(value) : `${prefix}${value}`}</span>,
}))

describe('TransactionSummaryCard', () => {
	const mockTransactions = [
		{
			id: 't1',
			name: 'Salary',
			amount: 5000,
			type_transation: TypeTransaction.INCOME,
			// ... minimal props
			user_id: 'u1',
			account_id: 'a1',
			category_id: 'c1',
			created_at: '',
			description: '',
		},
		{
			id: 't2',
			name: 'Rent',
			amount: 1500,
			type_transation: TypeTransaction.BILL,
			user_id: 'u1',
			account_id: 'a1',
			category_id: 'c1',
			created_at: '',
			description: '',
		},
	]

	it('calculates and displays totals correctly', () => {
		render(
			<TransactionSummaryCard
				transactions={mockTransactions}
				summary={{
					total_income: 5000,
					total_expenses: 1500,
					net_amount: 3500,
					income_dop: 5000,
					income_usd: 0,
					expenses_dop: 1500,
					expenses_usd: 0,
					usd_to_dop_rate: 60,
					income_count: 1,
					expense_count: 1,
				}}
			/>,
		)

		// Income
		expect(screen.getByText('Total Income')).toBeInTheDocument()
		expect(screen.getAllByText('RD$5,000.00').length).toBeGreaterThan(0)

		// Expenses (Bill)
		expect(screen.getByText('Total Expenses')).toBeInTheDocument()
		expect(screen.getAllByText('RD$1,500.00').length).toBeGreaterThan(0)

		// Count
		expect(screen.getByText('Total Transactions')).toBeInTheDocument()
		expect(screen.getByText('2')).toBeInTheDocument()
	})

	it('handles empty transactions list', () => {
		render(<TransactionSummaryCard transactions={[]} summary={null} />)
		// Should verify counts are 0
		expect(screen.getAllByText('RD$0.00').length).toBeGreaterThan(0)
	})
})
