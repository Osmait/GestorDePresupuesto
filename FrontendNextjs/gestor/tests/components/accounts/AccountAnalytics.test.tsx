import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AccountAnalytics } from '@/components/accounts/AccountAnalytics'
import { renderWithIntl } from '@/tests/utils/intl'
import { type Transaction, TypeTransaction } from '@/types/transaction'

vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/components/charts/chart-theme', () => ({
	useChartTheme: () => ({
		colors: { series: ['#1', '#2', '#3'], positive: '#0f0', negative: '#f00', mutedText: '#999' },
	}),
}))

function tx(overrides: Partial<Transaction>): Transaction {
	return {
		id: Math.random().toString(36),
		name: 'Compra',
		description: '',
		amount: 0,
		type_transation: TypeTransaction.BILL,
		account_id: 'card-1',
		category_id: '',
		budget_id: '',
		currency: 'DOP',
		created_at: '2026-10-20T15:00:00Z',
		...overrides,
	} as Transaction
}

// A credit card with DOP and USD movements: the totals are per currency, never added together.
const transactions = [
	tx({ amount: 1000, type_transation: TypeTransaction.BILL, currency: 'DOP' }),
	tx({ amount: 250, type_transation: TypeTransaction.INCOME, currency: 'DOP' }),
	tx({ amount: 40, type_transation: TypeTransaction.BILL, currency: 'USD' }),
]

function statValue(label: string) {
	const term = screen.getByText(label, { selector: 'dt div' })
	return term.closest('dt')?.parentElement?.textContent ?? ''
}

describe('AccountAnalytics', () => {
	it('shows the account currency only, without mixing in the other one', () => {
		renderWithIntl(
			<AccountAnalytics transactions={transactions} categories={[]} currentBalance={-750} currency='DOP' />,
		)
		expect(statValue('Total Expenses')).toContain('1,000.00')
		expect(statValue('Total Expenses')).not.toContain('1,040')
		expect(statValue('Total Income')).toContain('250.00')
		expect(screen.getByRole('button', { name: 'USD', pressed: false })).toBeInTheDocument()
	})

	it('switches to the other currency with its own balance', () => {
		renderWithIntl(
			<AccountAnalytics
				transactions={transactions}
				categories={[]}
				currentBalance={-750}
				currency='DOP'
				balancesByCurrency={{ DOP: -750, USD: -40 }}
			/>,
		)
		fireEvent.click(screen.getByRole('button', { name: 'USD' }))
		expect(screen.getByRole('button', { name: 'USD', pressed: true })).toBeInTheDocument()
		expect(statValue('Total Expenses')).toContain('40.00')
		expect(statValue('Total Expenses')).toContain('US$')
		expect(statValue('Balance')).toContain('40.00')
	})

	it('says the balance is unavailable instead of inventing one', () => {
		renderWithIntl(
			<AccountAnalytics transactions={transactions} categories={[]} currentBalance={-750} currency='DOP' />,
		)
		fireEvent.click(screen.getByRole('button', { name: 'USD' }))
		expect(screen.getAllByText('USD balance unavailable').length).toBeGreaterThan(0)
	})

	it('has no currency switcher for a single-currency account', () => {
		renderWithIntl(
			<AccountAnalytics transactions={transactions.slice(0, 2)} categories={[]} currentBalance={100} currency='DOP' />,
		)
		expect(screen.queryByRole('button', { name: 'DOP' })).not.toBeInTheDocument()
	})
})
