import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { InvestmentFundingModal } from '@/components/investments/InvestmentFundingModal'

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
			{ id: 'acc1', name: 'Savings', bank: 'BPD', currency: 'DOP', type: 'bank', initial_balance: 50000, user_id: 'u1', created_at: '' },
			{ id: 'acc2', name: 'USD Account', bank: 'BPD', currency: 'USD', type: 'bank', initial_balance: 1000, user_id: 'u1', created_at: '' },
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
		return render(
			<QueryClientProvider client={queryClient}>
				<InvestmentFundingModal isOpen={true} onClose={mockOnClose} />
			</QueryClientProvider>
		)
	}

	it('renders with wallet balances', () => {
		renderModal()

		expect(screen.getByText('Fund broker balance')).toBeInTheDocument()
		expect(screen.getByText('Current wallet balances')).toBeInTheDocument()
		expect(screen.getByText('USD: 5000.00')).toBeInTheDocument()
		expect(screen.getByText('DOP: 100000.00')).toBeInTheDocument()
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
		expect(screen.getByText(/0\.00 DOP/)).toBeInTheDocument()
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
})
