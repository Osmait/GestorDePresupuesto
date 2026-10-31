import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CreditCardPaymentHistory } from '@/components/creditcards/CreditCardPaymentHistory'
import { renderWithIntl } from '@/tests/utils/intl'
import type { CardPayment, CreditCard } from '@/types/creditcard'

const payment: CardPayment = {
	id: 'p1',
	card_id: 'card1',
	from_account_id: 'acc1',
	currency: 'USD',
	amount: 100,
	source_currency: 'DOP',
	source_amount: 5812.35,
	exchange_rate: 1058.1235,
	includes_interest: false,
	interest_amount: 0,
	payment_date: '2026-10-20T12:00:00Z',
	status: 'completed' as CardPayment['status'],
	notes: '',
	created_at: '2026-10-20T12:00:00Z',
}

vi.mock('@/lib/repositoryConfig', () => ({
	getCreditCardRepository: () => ({ getPayments: () => Promise.resolve([payment]) }),
}))

vi.mock('@/hooks/queries/useAccountsQuery', () => ({
	useGetAccounts: () => ({ data: [{ id: 'acc1', name: 'Checking' }] }),
}))

const card = { id: 'card1', name: 'Visa', bank: 'BHD', last_four_digits: '1234', balances: [] } as unknown as CreditCard

describe('CreditCardPaymentHistory', () => {
	it('labels the currency filter and formats the exchange rate with the locale', async () => {
		renderWithIntl(<CreditCardPaymentHistory open onClose={vi.fn()} card={card} />)

		expect((await screen.findAllByText('1,058.1235')).length).toBeGreaterThan(0)
		expect(screen.getByRole('combobox', { name: 'Filter by currency' })).toBeInTheDocument()
	})
})
