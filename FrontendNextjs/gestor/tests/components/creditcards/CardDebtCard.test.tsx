import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardDebtCard } from '@/components/creditcards/CardDebtCard'
import { renderWithIntl } from '@/tests/utils/intl'

describe('CardDebtCard', () => {
	it('shows the debt as an amount owed with the share of the limit, per currency', () => {
		renderWithIntl(
			<CardDebtCard
				name='Tarjeta Principal'
				bank='Ban Reservas'
				balances={[
					{ currency: 'DOP', current_balance: -5500, credit_limit: 22000 },
					{ currency: 'USD', current_balance: 0, credit_limit: 300 },
				]}
			/>,
		)
		expect(screen.getByRole('link', { name: 'Tarjeta Principal' })).toHaveAttribute('href', '/app/credit-cards')
		expect(screen.getByText('You owe RD$5,500.00')).toHaveClass('text-destructive')
		expect(screen.getByText('25% of the RD$22,000.00 limit')).toBeInTheDocument()
		expect(screen.getByText('No debt')).toHaveClass('text-success')
	})

	it('shows a positive card balance as credit in favour', () => {
		renderWithIntl(
			<CardDebtCard
				name='Qik'
				bank='Banco Qik'
				balances={[{ currency: 'DOP', current_balance: 120, credit_limit: 0 }]}
			/>,
		)
		expect(screen.getByText('In credit RD$120.00')).toBeInTheDocument()
		expect(screen.queryByText(/limit/)).not.toBeInTheDocument()
	})
})
