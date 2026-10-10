import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { AccountSummaryCard } from '@/components/accounts/AccountSummaryCard'

// Mock dependencies
vi.mock('next-intl', () => ({
	useTranslations: () => (key: string) => {
		const translations: Record<string, string> = {
			summary: 'Summary',
			currentBalance: 'Current Balance',
			initial: 'Initial',
			positiveAccounts: 'Positive Accounts',
			totalDifference: 'Total Difference',
			totalAccounts: 'Total Accounts',
		}
		return translations[key] || key
	},
}))

// Mock AnimatedCounter to return simple text
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

describe('AccountSummaryCard', () => {
	const mockAccounts = [
		{
			id: '1',
			name: 'Bank A',
			current_balance: 1000,
			initial_balance: 800,
			bank: 'Test',
			user_id: 'u1',
			created_at: '',
			updated_at: '',
		},
		{
			id: '2',
			name: 'Bank B',
			current_balance: -200,
			initial_balance: 0,
			bank: 'Test',
			user_id: 'u1',
			created_at: '',
			updated_at: '',
		},
	]

	it('calculates and displays totals correctly', () => {
		render(<AccountSummaryCard accounts={mockAccounts} />)

		// Current Balance: 1000 + (-200) = 800
		expect(screen.getByText('Current Balance')).toBeInTheDocument()
		expect(screen.getByText('RD$800.00')).toBeInTheDocument()

		// Positive accounts count: 1 (Bank A)
		expect(screen.getByText('Positive Accounts')).toBeInTheDocument()
		expect(screen.getByText('1')).toBeInTheDocument()

		// Total Accounts: 2
		expect(screen.getByText('Total Accounts')).toBeInTheDocument()
		expect(screen.getByText('2')).toBeInTheDocument()
	})

	it('handles empty accounts list', () => {
		render(<AccountSummaryCard accounts={[]} />)
		// Multiple fields will be $0 (Current Balance, Difference)
		const zeroValues = screen.getAllByText('RD$0.00')
		expect(zeroValues.length).toBeGreaterThan(0)
	})

	it('shows a negative total difference with its sign and in red (no Math.abs)', () => {
		render(
			<AccountSummaryCard
				accounts={[
					{
						id: '1',
						name: 'Bank A',
						current_balance: 700.5,
						initial_balance: 1000,
						bank: 'Test',
						user_id: 'u1',
						created_at: '',
					},
				]}
			/>,
		)
		const difference = screen.getByText('-RD$299.50')
		expect(difference.closest('p')).toHaveClass('text-red-600')
	})

	it('shows a positive difference with an explicit plus sign in green', () => {
		render(<AccountSummaryCard accounts={mockAccounts.slice(0, 1)} />)
		const difference = screen.getByText('+RD$200.00')
		expect(difference.closest('p')).toHaveClass('text-green-600')
	})

	it('uses the shared currency of the accounts for totals', () => {
		render(<AccountSummaryCard accounts={mockAccounts.map((account) => ({ ...account, currency: 'USD' }))} />)
		expect(screen.getByText('US$800.00')).toBeInTheDocument()
	})
})
