import { screen } from '@testing-library/react'
import { AccountSummaryCard } from '@/components/accounts/AccountSummaryCard'
import { renderWithIntl } from '@/tests/utils/intl'

function statValue(label: string) {
	const card = screen.getByText(label).closest('.p-5') as HTMLElement
	return card.querySelector('.text-2xl') as HTMLElement
}

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

	it('renders one StatCard per KPI with the totals', () => {
		renderWithIntl(<AccountSummaryCard accounts={mockAccounts} />)

		// Current balance: 1000 + (-200) = 800
		expect(statValue('Total Balance')).toHaveTextContent('RD$800.00')
		expect(statValue('Positive Accounts')).toHaveTextContent('1')
		expect(statValue('Total Accounts')).toHaveTextContent('2')
	})

	it('handles an empty accounts list', () => {
		renderWithIntl(<AccountSummaryCard accounts={[]} />)
		expect(statValue('Total Balance')).toHaveTextContent('RD$0.00')
		expect(statValue('Total Accounts')).toHaveTextContent('0')
	})

	it('shows a negative total difference with its sign and the destructive token (no Math.abs)', () => {
		renderWithIntl(
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
		expect(screen.getByText('-RD$299.50')).toHaveClass('text-destructive')
	})

	it('shows a positive difference with an explicit plus sign and the success token', () => {
		renderWithIntl(<AccountSummaryCard accounts={mockAccounts.slice(0, 1)} />)
		expect(screen.getByText('+RD$200.00')).toHaveClass('text-success')
	})

	it('uses the shared currency of the accounts for totals', () => {
		renderWithIntl(<AccountSummaryCard accounts={mockAccounts.map((account) => ({ ...account, currency: 'USD' }))} />)
		expect(statValue('Total Balance')).toHaveTextContent('US$800.00')
	})

	it('has no gradient tiles', () => {
		const { container } = renderWithIntl(<AccountSummaryCard accounts={mockAccounts} />)
		expect(container.innerHTML).not.toMatch(/gradient|purple|violet|cyan/)
	})
})
