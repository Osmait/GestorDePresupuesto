import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CreditCardFormModal } from '@/components/creditcards/CreditCardFormModal'
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

describe('CreditCardFormModal', () => {
	const mockOnClose = vi.fn()
	const mockOnSubmit = vi.fn().mockResolvedValue(undefined)

	beforeEach(() => {
		vi.clearAllMocks()
	})

	function renderModal(card?: CreditCard | null) {
		return renderWithIntl(<CreditCardFormModal open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} card={card} />)
	}

	it('renders create mode', () => {
		renderModal()

		expect(screen.getByText('Add Credit Card')).toBeInTheDocument()
		expect(screen.getByText('Card Name')).toBeInTheDocument()
		expect(screen.getByText('Bank')).toBeInTheDocument()
		expect(screen.getByText('Last 4 Digits')).toBeInTheDocument()
		expect(screen.getByText('Cut Day (1-28)')).toBeInTheDocument()
		expect(screen.getByText('Due Day (1-28)')).toBeInTheDocument()
		expect(screen.getByText('Create')).toBeInTheDocument()
	})

	it('renders Spanish labels and validation for the es locale', async () => {
		const user = userEvent.setup()
		renderWithIntl(<CreditCardFormModal open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />, {
			locale: 'es',
		})

		expect(screen.getByText('Agregar tarjeta de crédito')).toBeInTheDocument()
		await user.click(screen.getByText('Crear'))
		await waitFor(() => {
			expect(screen.getByText('El nombre de la tarjeta es obligatorio')).toBeInTheDocument()
		})
	})

	it('renders edit mode with card data', () => {
		const card: CreditCard = {
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
					current_balance: -5000,
					credit_limit: 100000,
					available_credit: 95000,
					utilization_percent: 5,
					created_at: '',
					updated_at: '',
				},
			],
			created_at: '',
			updated_at: '',
		}

		renderModal(card)

		expect(screen.getByText('Edit Credit Card')).toBeInTheDocument()
		expect(screen.getByDisplayValue('My Visa')).toBeInTheDocument()
		expect(screen.getByDisplayValue('Banco Popular')).toBeInTheDocument()
		expect(screen.getByDisplayValue('4321')).toBeInTheDocument()
		expect(screen.getByDisplayValue('15')).toBeInTheDocument()
		expect(screen.getByDisplayValue('5')).toBeInTheDocument()
		expect(screen.getByText('Update')).toBeInTheDocument()
	})

	it('validates card name required', async () => {
		const user = userEvent.setup()
		renderModal()

		// Clear the name field and submit
		const submitButton = screen.getByText('Create')
		await user.click(submitButton)

		await waitFor(() => {
			expect(screen.getByText('Card name is required')).toBeInTheDocument()
		})
	})

	it('validates bank required', async () => {
		const user = userEvent.setup()
		renderModal()

		// Fill name but leave bank empty
		const nameInput = screen.getByPlaceholderText('My Credit Card')
		await user.type(nameInput, 'Test Card')

		// Clear bank
		const bankInput = screen.getByPlaceholderText('Banco Popular')
		await user.clear(bankInput)

		const submitButton = screen.getByText('Create')
		await user.click(submitButton)

		await waitFor(() => {
			expect(screen.getByText('Bank is required')).toBeInTheDocument()
		})
	})

	it('last 4 digits only allows numbers', async () => {
		const user = userEvent.setup()
		renderModal()

		const digitsInput = screen.getByPlaceholderText('1234')
		await user.type(digitsInput, 'abcd1234xyz')

		// Only digits should remain, max 4
		expect(digitsInput).toHaveValue('1234')
	})

	it('cut day field has correct constraints', () => {
		renderModal()

		const cutDayInput = screen.getByRole('spinbutton', { name: 'Cut Day (1-28)' })
		expect(cutDayInput).toHaveAttribute('min', '1')
		expect(cutDayInput).toHaveAttribute('max', '28')
		expect(cutDayInput).toHaveAttribute('type', 'number')
		expect(cutDayInput).toHaveValue(20)
	})

	it('due day field has correct constraints', () => {
		renderModal()

		const dueDayInput = screen.getByRole('spinbutton', { name: 'Due Day (1-28)' })
		expect(dueDayInput).toHaveAttribute('min', '1')
		expect(dueDayInput).toHaveAttribute('max', '28')
		expect(dueDayInput).toHaveAttribute('type', 'number')
		expect(dueDayInput).toHaveValue(10)
	})

	it('add balance button adds row', async () => {
		const user = userEvent.setup()
		renderModal()

		// Initially one balance row - look for Credit Limit labels
		const limitLabels = screen.getAllByText('Credit Limit')
		expect(limitLabels).toHaveLength(1)

		// Click add
		const addButton = screen.getByText('Add Currency')
		await user.click(addButton)

		// Now two balance rows
		const limitLabelsAfter = screen.getAllByText('Credit Limit')
		expect(limitLabelsAfter).toHaveLength(2)
	})

	it('remove balance button removes row', async () => {
		const user = userEvent.setup()
		renderModal()

		// Add a second balance row first
		const addButton = screen.getByText('Add Currency')
		await user.click(addButton)

		const limitLabels = screen.getAllByText('Credit Limit')
		expect(limitLabels).toHaveLength(2)

		// Click the first remove button (trash icon)
		const removeButtons = screen
			.getAllByRole('button')
			.filter((btn) => btn.querySelector('svg.lucide-trash-2') !== null)
		expect(removeButtons.length).toBeGreaterThan(0)
		await user.click(removeButtons[0])

		const limitLabelsAfter = screen.getAllByText('Credit Limit')
		expect(limitLabelsAfter).toHaveLength(1)
	})

	it('submits with balances array', async () => {
		const user = userEvent.setup()
		renderModal()

		const nameInput = screen.getByPlaceholderText('My Credit Card')
		await user.type(nameInput, 'Test Card')

		const bankInput = screen.getByPlaceholderText('Banco Popular')
		await user.type(bankInput, 'Test Bank')

		const submitButton = screen.getByText('Create')
		await user.click(submitButton)

		await waitFor(() => {
			expect(mockOnSubmit).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'Test Card',
					bank: 'Test Bank',
					balances: expect.arrayContaining([
						expect.objectContaining({
							currency: 'DOP',
							credit_limit: 100000,
						}),
					]),
				}),
			)
		})
	})

	it('rejects a credit limit with more than 2 decimal places', async () => {
		const user = userEvent.setup()
		renderModal()

		await user.type(screen.getByPlaceholderText('My Credit Card'), 'Test Card')
		await user.type(screen.getByPlaceholderText('Banco Popular'), 'Test Bank')
		const limitInput = screen.getByRole('spinbutton', { name: 'Credit Limit DOP' })
		await user.clear(limitInput)
		await user.type(limitInput, '1000.005')
		await user.click(screen.getByText('Create'))

		expect(await screen.findByText('Use at most 2 decimal places')).toBeInTheDocument()
		expect(mockOnSubmit).not.toHaveBeenCalled()
	})
	it('keeps the dialog open and shows the reason when saving fails', async () => {
		const user = userEvent.setup()
		mockOnSubmit.mockRejectedValueOnce(Object.assign(new Error('Card limit too high'), { status: 400 }))
		renderModal()

		await user.type(screen.getByPlaceholderText('My Credit Card'), 'Test Card')
		await user.type(screen.getByPlaceholderText('Banco Popular'), 'Test Bank')
		await user.click(screen.getByRole('button', { name: 'Create' }))

		const alert = await screen.findByRole('alert')
		expect(alert).toHaveTextContent('The card could not be saved. Please try again.')
		expect(alert).toHaveTextContent('Card limit too high')
		expect(mockOnClose).not.toHaveBeenCalled()
		expect(screen.getByRole('dialog')).toBeInTheDocument()
	})
})
