import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { InvestmentFormModal } from '@/components/investments/InvestmentFormModal'
import { InvestmentType, Investment } from '@/types/investment'

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

const mockCreateMutateAsync = vi.fn().mockResolvedValue({})
const mockUpdateMutateAsync = vi.fn().mockResolvedValue({})
const mockGetQuote = vi.fn()

vi.mock('@/hooks/queries/useInvestmentsQuery', () => ({
	useCreateInvestmentMutation: () => ({
		mutateAsync: mockCreateMutateAsync,
		isPending: false,
	}),
	useUpdateInvestmentMutation: () => ({
		mutateAsync: mockUpdateMutateAsync,
		isPending: false,
	}),
	useGetInvestmentFundingBalances: () => ({
		data: [{ currency: 'USD', available: 10000 }],
	}),
}))

vi.mock('@/lib/repositoryConfig', () => ({
	investmentRepository: {
		getQuote: (...args: unknown[]) => mockGetQuote(...args),
	},
}))

describe('InvestmentFormModal', () => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})

	const mockOnClose = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	function renderModal(investmentToEdit?: Investment | null) {
		return render(
			<QueryClientProvider client={queryClient}>
				<InvestmentFormModal
					isOpen={true}
					onClose={mockOnClose}
					investmentToEdit={investmentToEdit}
				/>
			</QueryClientProvider>
		)
	}

	it('renders create mode correctly', () => {
		renderModal()

		expect(screen.getByText('Add investment')).toBeInTheDocument()
		expect(screen.getByText('Use your broker funding balance to add a new investment.')).toBeInTheDocument()
		expect(screen.getByText('Name')).toBeInTheDocument()
		expect(screen.getByText('Symbol')).toBeInTheDocument()
		expect(screen.getByText('Create')).toBeInTheDocument()
	})

	it('renders edit mode with investment data', () => {
		const investment: Investment = {
			id: 'inv1',
			name: 'Apple Inc.',
			symbol: 'AAPL',
			type: InvestmentType.STOCK,
			quantity: 10,
			purchase_price: 150,
			current_price: 180,
			settlement_currency: 'USD',
			user_id: 'u1',
			created_at: '',
		}

		renderModal(investment)

		expect(screen.getByText('Edit investment')).toBeInTheDocument()
		expect(screen.getByText('Update')).toBeInTheDocument()
		expect(screen.getByDisplayValue('Apple Inc.')).toBeInTheDocument()
		expect(screen.getByDisplayValue('AAPL')).toBeInTheDocument()
	})

	it('shows validation error for empty name', async () => {
		const user = userEvent.setup()
		renderModal()

		const submitButton = screen.getByText('Create')
		await user.click(submitButton)

		await waitFor(() => {
			expect(screen.getByText('Name is required')).toBeInTheDocument()
		})
	})

	it('shows validation error for empty symbol', async () => {
		const user = userEvent.setup()
		renderModal()

		// Fill name but leave symbol empty
		const nameInput = screen.getByRole('textbox', { name: 'Name' })
		await user.type(nameInput, 'Test Investment')

		const submitButton = screen.getByText('Create')
		await user.click(submitButton)

		await waitFor(() => {
			expect(screen.getByText('Symbol is required')).toBeInTheDocument()
		})
	})

	it('symbol auto-uppercases', async () => {
		const user = userEvent.setup()
		renderModal()

		const symbolInput = screen.getByPlaceholderText('e.g. AAPL, BTC-USD')
		await user.type(symbolInput, 'aapl')

		expect(symbolInput).toHaveValue('AAPL')
	})

	it('fetch price button calls API', async () => {
		const user = userEvent.setup()
		mockGetQuote.mockResolvedValue({
			regular_market_price: 195.5,
			name: 'Apple Inc.',
		})

		renderModal()

		const symbolInput = screen.getByPlaceholderText('e.g. AAPL, BTC-USD')
		await user.type(symbolInput, 'AAPL')

		// Click the search/fetch button (the icon button next to symbol)
		const fetchButton = screen.getByRole('button', { name: '' })
		await user.click(fetchButton)

		await waitFor(() => {
			expect(mockGetQuote).toHaveBeenCalledWith('AAPL')
		})
	})

	it('shows insufficient balance error', async () => {
		const user = userEvent.setup()
		renderModal()

		const nameInput = screen.getByRole('textbox', { name: 'Name' })
		await user.type(nameInput, 'Expensive Stock')

		const symbolInput = screen.getByPlaceholderText('e.g. AAPL, BTC-USD')
		await user.type(symbolInput, 'EXPENSIVE')

		const quantityInput = screen.getByRole('spinbutton', { name: 'Quantity' })
		await user.clear(quantityInput)
		await user.type(quantityInput, '1000')

		const purchaseInput = screen.getByRole('spinbutton', { name: 'Purchase price' })
		await user.clear(purchaseInput)
		await user.type(purchaseInput, '100')

		const currentInput = screen.getByRole('spinbutton', { name: 'Current price' })
		await user.clear(currentInput)
		await user.type(currentInput, '100')

		const submitButton = screen.getByText('Create')
		await user.click(submitButton)

		await waitFor(() => {
			expect(screen.getByText(/Insufficient broker balance/)).toBeInTheDocument()
		})
	})

	it('submits create mutation with correct data', async () => {
		const user = userEvent.setup()
		renderModal()

		const nameInput = screen.getByRole('textbox', { name: 'Name' })
		await user.type(nameInput, 'Apple Inc.')

		const symbolInput = screen.getByPlaceholderText('e.g. AAPL, BTC-USD')
		await user.type(symbolInput, 'AAPL')

		const quantityInput = screen.getByRole('spinbutton', { name: 'Quantity' })
		await user.clear(quantityInput)
		await user.type(quantityInput, '5')

		const purchaseInput = screen.getByRole('spinbutton', { name: 'Purchase price' })
		await user.clear(purchaseInput)
		await user.type(purchaseInput, '150')

		const currentInput = screen.getByRole('spinbutton', { name: 'Current price' })
		await user.clear(currentInput)
		await user.type(currentInput, '180')

		const submitButton = screen.getByText('Create')
		await user.click(submitButton)

		await waitFor(() => {
			expect(mockCreateMutateAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'Apple Inc.',
					symbol: 'AAPL',
					quantity: 5,
					purchase_price: 150,
					current_price: 180,
				})
			)
		})
	})

	it('submits update mutation when editing', async () => {
		const user = userEvent.setup()
		const investment: Investment = {
			id: 'inv1',
			name: 'Apple Inc.',
			symbol: 'AAPL',
			type: InvestmentType.STOCK,
			quantity: 10,
			purchase_price: 150,
			current_price: 180,
			settlement_currency: 'USD',
			user_id: 'u1',
			created_at: '',
		}

		renderModal(investment)

		const nameInput = screen.getByDisplayValue('Apple Inc.')
		await user.clear(nameInput)
		await user.type(nameInput, 'Apple Updated')

		const submitButton = screen.getByText('Update')
		await user.click(submitButton)

		await waitFor(() => {
			expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 'inv1',
					name: 'Apple Updated',
				})
			)
		})
	})
})
