import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { InvestmentFundingModal } from '@/components/investments/InvestmentFundingModal'
import { renderWithIntl } from '@/tests/utils/intl'

// Polyfill for Radix UI
beforeAll(() => {
	HTMLElement.prototype.hasPointerCapture = vi.fn()
	HTMLElement.prototype.scrollIntoView = vi.fn()
	global.ResizeObserver = class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof globalThis.ResizeObserver
})

const mockFundMutateAsync = vi.fn().mockResolvedValue({})

vi.mock('@/hooks/queries/useAccountsQuery', () => ({
	useGetAccounts: () => ({
		data: [
			// Listed first on purpose: it must be neither offered nor auto-selected.
			{
				id: 'card1',
				name: 'Visa Gold',
				bank: 'BPD',
				currency: 'DOP',
				type: 'credit_card',
				initial_balance: 0,
				user_id: 'u1',
				created_at: '',
			},
			{
				id: 'acc1',
				name: 'Savings',
				bank: 'BPD',
				currency: 'DOP',
				type: 'bank',
				initial_balance: 50000,
				current_balance: 42000.5,
				user_id: 'u1',
				created_at: '',
			},
			{
				id: 'acc2',
				name: 'USD Account',
				bank: 'BPD',
				currency: 'USD',
				type: 'bank',
				initial_balance: 1000,
				user_id: 'u1',
				created_at: '',
			},
		],
	}),
}))

vi.mock('@/hooks/queries/useInvestmentsQuery', () => ({
	useGetInvestmentFundingBalances: () => ({
		data: [
			{ currency: 'USD', available: 5000 },
			{ currency: 'DOP', available: 100000 },
		],
	}),
	useFundBrokerMutation: () => ({
		mutateAsync: mockFundMutateAsync,
		isPending: false,
	}),
}))

describe('InvestmentFundingModal', () => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})

	const mockOnClose = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	function renderModal() {
		return renderWithIntl(
			<QueryClientProvider client={queryClient}>
				<InvestmentFundingModal isOpen={true} onClose={mockOnClose} />
			</QueryClientProvider>,
		)
	}

	it('renders with wallet balances', () => {
		renderModal()

		expect(screen.getByText('Fund broker balance')).toBeInTheDocument()
		expect(screen.getByText('Current wallet balances')).toBeInTheDocument()
		expect(screen.getByText('USD: US$5,000.00')).toBeInTheDocument()
		expect(screen.getByText('DOP: RD$100,000.00')).toBeInTheDocument()
	})

	it('renders form fields', () => {
		renderModal()

		expect(screen.getByText('Source account')).toBeInTheDocument()
		expect(screen.getByText('Target wallet currency')).toBeInTheDocument()
		expect(screen.getByText('Estimated credit')).toBeInTheDocument()
		expect(screen.getByText('Fund broker')).toBeInTheDocument()
	})

	it('shows exchange rate field', () => {
		renderModal()

		// Exchange rate field is always visible (but disabled when same currency)
		expect(screen.getByText(/Exchange rate/)).toBeInTheDocument()
	})

	it('shows estimated credit section', () => {
		renderModal()

		expect(screen.getByText('Estimated credit')).toBeInTheDocument()
		// Default amount is 0
		expect(screen.getByText('RD$0.00')).toBeInTheDocument()
	})

	it('submit button is present and form has correct structure', () => {
		renderModal()

		const submitButton = screen.getByText('Fund broker')
		expect(submitButton).toBeInTheDocument()
		expect(submitButton.closest('form')).toBeTruthy()

		// Source amount input exists
		const amountInput = screen.getByRole('spinbutton', { name: /Amount from account/ })
		expect(amountInput).toBeInTheDocument()
		expect(amountInput).toHaveValue(0)
	})

	it('notes field accepts input', async () => {
		const user = userEvent.setup()
		renderModal()

		const notesInput = screen.getByPlaceholderText('Transfer to broker account')
		await user.type(notesInput, 'My test note')

		expect(notesInput).toHaveValue('My test note')
	})

	it('never offers a credit card as the funding source', async () => {
		const user = userEvent.setup()
		renderModal()

		const sourceSelect = screen.getAllByRole('combobox')[0]
		expect(sourceSelect).toHaveTextContent('Savings (DOP)')
		await user.click(sourceSelect)

		expect(await screen.findByRole('option', { name: 'USD Account (USD)' })).toBeInTheDocument()
		expect(screen.queryByRole('option', { name: /Visa Gold/ })).not.toBeInTheDocument()
	})

	it('shows a translated error with the backend detail when funding fails', async () => {
		const user = userEvent.setup()
		mockFundMutateAsync.mockRejectedValueOnce(
			Object.assign(new Error('insufficient funds in source account'), { status: 422 }),
		)
		renderModal()

		const amountInput = screen.getByRole('spinbutton', { name: /Amount from account/ })
		await user.clear(amountInput)
		await user.type(amountInput, '1000')
		const rateInput = screen.getByRole('spinbutton', { name: /Exchange rate/ })
		await user.clear(rateInput)
		await user.type(rateInput, '58')
		await user.click(screen.getByRole('button', { name: 'Fund broker' }))

		await waitFor(() => expect(mockFundMutateAsync).toHaveBeenCalledTimes(1))
		expect(await screen.findByText('Failed to fund broker balance')).toBeInTheDocument()
		expect(screen.getByText('insufficient funds in source account')).toBeInTheDocument()
		expect(mockOnClose).not.toHaveBeenCalled()
	})

	it('shows the available balance of the selected source account', () => {
		renderModal()

		expect(screen.getByText('Available: RD$42,000.50')).toBeInTheDocument()
	})

	it('shows the translated INSUFFICIENT_FUNDS message when the account cannot cover the transfer', async () => {
		const user = userEvent.setup()
		mockFundMutateAsync.mockRejectedValueOnce(
			Object.assign(new Error('insufficient funds: the source account has 100.00 DOP available'), {
				status: 400,
				code: 'INSUFFICIENT_FUNDS',
				details: { available: '100.00', required: '1000.00', currency: 'DOP' },
			}),
		)
		renderModal()

		const amountInput = screen.getByRole('spinbutton', { name: /Amount from account/ })
		await user.clear(amountInput)
		await user.type(amountInput, '1000')
		const rateInput = screen.getByRole('spinbutton', { name: /Exchange rate/ })
		await user.clear(rateInput)
		await user.type(rateInput, '58')
		await user.click(screen.getByRole('button', { name: 'Fund broker' }))

		expect(
			await screen.findByText("The source account doesn't have enough funds: only RD$100.00 available."),
		).toBeInTheDocument()
		expect(mockOnClose).not.toHaveBeenCalled()
	})
})
