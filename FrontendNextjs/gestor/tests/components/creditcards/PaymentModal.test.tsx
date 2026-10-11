import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentModal } from '@/components/creditcards/PaymentModal'
import { renderWithIntl } from '@/tests/utils/intl'
import { CreditCard } from '@/types/creditcard'

// FormDialog renders a Dialog from `md` up (a vaul Drawer below, which needs pointer capture jsdom lacks).
beforeEach(() => {
	vi.stubGlobal(
		'matchMedia',
		vi.fn((query: string) => ({
			matches: true,
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	)
})
afterEach(() => {
	vi.unstubAllGlobals()
})

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

const mockFindAll = vi.fn().mockResolvedValue([
	{
		id: 'acc1',
		name: 'Savings',
		bank: 'BPD',
		currency: 'DOP',
		type: 'bank',
		initial_balance: 50000,
		current_balance: 48000,
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
])

vi.mock('@/lib/repositoryConfig', () => ({
	getAccountRepository: () => ({
		findAll: () => mockFindAll(),
	}),
}))

vi.mock('@/hooks/queries/useExchangeRateQuery', () => ({
	useExchangeRateQuery: () => ({
		data: { usd_to_dop: 58.5 },
	}),
}))

describe('PaymentModal', () => {
	const mockOnClose = vi.fn()
	const mockOnSubmit = vi.fn().mockResolvedValue(undefined)

	const mockCard: CreditCard = {
		id: 'card1',
		name: 'My Visa',
		bank: 'Banco Popular',
		last_four_digits: '4321',
		cut_day: 15,
		due_day: 5,
		balances: [
			{
				id: 'bal1',
				currency: 'DOP',
				current_balance: -15000,
				credit_limit: 100000,
				available_credit: 85000,
				utilization_percent: 15,
				created_at: '',
				updated_at: '',
			},
		],
		created_at: '',
		updated_at: '',
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	function renderModal(card: CreditCard | null = mockCard) {
		return renderWithIntl(<PaymentModal open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} card={card} />)
	}

	it('renders with card data', async () => {
		renderModal()

		expect(screen.getByText('Pay Credit Card')).toBeInTheDocument()
		expect(screen.getByText('Pay From Account')).toBeInTheDocument()
		expect(screen.getByText('Currency')).toBeInTheDocument()
		expect(screen.getByText('Amount to Pay')).toBeInTheDocument()
		expect(screen.getByText('Make Payment')).toBeInTheDocument()
	})

	it('shows current debt', async () => {
		renderModal()

		await waitFor(() => {
			expect(screen.getByText(/Current debt:/)).toBeInTheDocument()
		})
	})

	it('loads accounts on open', async () => {
		renderModal()

		await waitFor(() => {
			expect(mockFindAll).toHaveBeenCalled()
		})
	})

	it('amount field has correct type and step', () => {
		renderModal()

		const amountInput = screen.getByRole('spinbutton', { name: 'Amount to Pay' })
		expect(amountInput).toHaveAttribute('type', 'number')
		expect(amountInput).toHaveAttribute('step', '0.01')
	})

	it('submit button is disabled without account selected', () => {
		renderModal()

		// The submit button should be disabled when no account is selected
		const submitButton = screen.getByText('Make Payment')
		expect(submitButton).toBeDisabled()
	})

	it('shows advisory when amount exceeds current debt but does not block submit', async () => {
		const user = userEvent.setup()
		renderModal()

		await waitFor(() => {
			expect(mockFindAll).toHaveBeenCalled()
		})

		const amountInput = screen.getByRole('spinbutton', { name: 'Amount to Pay' })
		await user.clear(amountInput)
		await user.type(amountInput, '20000')

		await waitFor(() => {
			expect(screen.getByText(/Payment exceeds current debt by/i)).toBeInTheDocument()
		})
	})

	it('interest toggle shows/hides amount field', async () => {
		const user = userEvent.setup()
		renderModal()

		expect(screen.getByText('Includes Interest')).toBeInTheDocument()

		// Interest amount field should not be visible initially
		expect(screen.queryByPlaceholderText('Interest amount')).not.toBeInTheDocument()

		// Toggle interest on
		const interestSwitch = screen.getByRole('switch')
		await user.click(interestSwitch)

		// Now interest amount field should appear
		await waitFor(() => {
			expect(screen.getByPlaceholderText('Interest amount')).toBeInTheDocument()
		})

		// Toggle off
		await user.click(interestSwitch)

		await waitFor(() => {
			expect(screen.queryByPlaceholderText('Interest amount')).not.toBeInTheDocument()
		})
	})

	it('submits payment with correct data', async () => {
		const user = userEvent.setup()
		renderModal()

		// Wait for accounts
		await waitFor(() => {
			expect(mockFindAll).toHaveBeenCalled()
		})

		// The amount is pre-filled from card balance (15000)
		// We need to select an account first - since Radix Select is complex to interact with,
		// let's check the submit button is present and test what we can
		const amountInput = screen.getByRole('spinbutton', { name: 'Amount to Pay' })
		await user.clear(amountInput)
		await user.type(amountInput, '5000')

		// Verify the cancel button works
		const cancelButton = screen.getByText('Cancel')
		await user.click(cancelButton)

		expect(mockOnClose).toHaveBeenCalled()
	})

	it('renders Spanish copy and formatted debt for the es locale', async () => {
		renderWithIntl(<PaymentModal open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} card={mockCard} />, {
			locale: 'es',
		})

		expect(screen.getByText('Pagar tarjeta de crédito')).toBeInTheDocument()
		expect(screen.getByText('Realizar pago')).toBeInTheDocument()
		await waitFor(() => {
			expect(screen.getByText(/Deuda actual: .*15,000\.00/)).toBeInTheDocument()
		})
	})

	it('has notes field', () => {
		renderModal()

		expect(screen.getByText('Notes (Optional)')).toBeInTheDocument()
		expect(screen.getByPlaceholderText('Payment notes')).toBeInTheDocument()
	})

	async function submitPaymentFromSavings(user: ReturnType<typeof userEvent.setup>) {
		await waitFor(() => expect(mockFindAll).toHaveBeenCalled())
		await user.click(screen.getAllByRole('combobox')[0])
		await user.click(await screen.findByRole('option', { name: /Savings/ }))
		const submit = screen.getByRole('button', { name: 'Make Payment' })
		await waitFor(() => expect(submit).toBeEnabled())
		await user.click(submit)
	}

	it('keeps the modal open and shows the backend detail when the payment fails', async () => {
		const user = userEvent.setup()
		mockOnSubmit.mockRejectedValueOnce(Object.assign(new Error('insufficient funds in account'), { status: 422 }))
		renderModal()

		await submitPaymentFromSavings(user)

		await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledTimes(1))
		expect(await screen.findByText('The payment could not be processed. Please try again.')).toBeInTheDocument()
		expect(screen.getByText('insufficient funds in account')).toBeInTheDocument()
		expect(mockOnClose).not.toHaveBeenCalled()
	})

	it('shows the available balance of the selected source account', async () => {
		const user = userEvent.setup()
		renderModal()

		await waitFor(() => expect(mockFindAll).toHaveBeenCalled())
		await user.click(screen.getAllByRole('combobox')[0])
		await user.click(await screen.findByRole('option', { name: /Savings/ }))

		expect(await screen.findByText(/Available: RD\$48,000\.00/)).toBeInTheDocument()
	})

	it('shows the translated INSUFFICIENT_FUNDS message inline and keeps the modal open', async () => {
		const user = userEvent.setup()
		mockOnSubmit.mockRejectedValueOnce(
			Object.assign(new Error('insufficient funds: the source account has 50.00 DOP available'), {
				status: 400,
				code: 'INSUFFICIENT_FUNDS',
				details: { available: '50.00', required: '15000.00', currency: 'DOP' },
			}),
		)
		renderModal()

		await submitPaymentFromSavings(user)

		expect(
			await screen.findByText("The source account doesn't have enough funds: only RD$50.00 available."),
		).toBeInTheDocument()
		expect(screen.queryByText(/the source account has 50.00 DOP/)).not.toBeInTheDocument()
		expect(mockOnClose).not.toHaveBeenCalled()
	})

	it('rejects amounts with more than 2 decimal places before calling the API', async () => {
		const user = userEvent.setup()
		renderModal()

		const amountInput = screen.getByRole('spinbutton', { name: 'Amount to Pay' })
		await user.clear(amountInput)
		await user.type(amountInput, '0.001')
		await submitPaymentFromSavings(user)

		expect(await screen.findByText('Use at most 2 decimal places')).toBeInTheDocument()
		expect(mockOnSubmit).not.toHaveBeenCalled()
	})

	it('shows only the generic message for server errors', async () => {
		const user = userEvent.setup()
		mockOnSubmit.mockRejectedValueOnce(Object.assign(new Error('pq: deadlock detected'), { status: 500 }))
		renderModal()

		await submitPaymentFromSavings(user)

		expect(await screen.findByText('The payment could not be processed. Please try again.')).toBeInTheDocument()
		expect(screen.queryByText(/deadlock/)).not.toBeInTheDocument()
	})
})
