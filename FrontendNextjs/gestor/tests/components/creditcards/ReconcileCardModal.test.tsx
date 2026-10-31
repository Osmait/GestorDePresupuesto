import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReconcileCardModal } from '@/components/creditcards/ReconcileCardModal'
import { renderWithIntl } from '@/tests/utils/intl'
import type { CreditCard } from '@/types/creditcard'

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
	mutateAsync.mockReset()
	toastSuccess.mockReset()
})

beforeAll(() => {
	HTMLElement.prototype.hasPointerCapture = vi.fn()
	HTMLElement.prototype.scrollIntoView = vi.fn()
	global.ResizeObserver = class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof globalThis.ResizeObserver
})

const mutateAsync = vi.fn()
const toastSuccess = vi.fn()

vi.mock('@/hooks/queries/useAccountsQuery', () => ({
	useReconcileAccountMutation: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('sonner', () => ({ toast: { success: (msg: string) => toastSuccess(msg), error: vi.fn() } }))

const card: CreditCard = {
	id: 'card-1',
	name: 'Gastos personales',
	bank: 'Ban Reservas',
	last_four_digits: '0105',
	cut_day: 2,
	due_day: 24,
	balances: [
		{
			id: 'b-dop',
			currency: 'DOP',
			current_balance: -36462.71,
			credit_limit: 10000,
			available_credit: 0,
			utilization_percent: 100,
			created_at: '',
			updated_at: '',
		},
		{
			id: 'b-usd',
			currency: 'USD',
			current_balance: -10,
			credit_limit: 300,
			available_credit: 290,
			utilization_percent: 3,
			created_at: '',
			updated_at: '',
		},
	],
	created_at: '',
	updated_at: '',
}

describe('ReconcileCardModal', () => {
	it('shows the app debt and the adjustment for the debt the bank shows', async () => {
		const user = userEvent.setup()
		renderWithIntl(<ReconcileCardModal open setOpen={vi.fn()} card={card} />)

		expect(screen.getByRole('dialog', { name: 'Reconcile Gastos personales' })).toBeInTheDocument()
		expect(screen.getByText('RD$36,462.71')).toBeInTheDocument()

		// The bank says 8,300: the debt goes down by 28,162.71.
		await user.type(screen.getByLabelText('Debt at the bank'), '8300')
		expect(screen.getByText('+RD$28,162.71')).toHaveClass('text-success')
	})

	it('reconciles the card account to minus the debt, in the chosen currency', async () => {
		const user = userEvent.setup()
		const setOpen = vi.fn()
		mutateAsync.mockResolvedValue({ adjusted: true, difference: 28162.71, reconciliation: {} })
		renderWithIntl(<ReconcileCardModal open setOpen={setOpen} card={card} />)

		await user.type(screen.getByLabelText('Debt at the bank'), '8300')
		await user.click(screen.getByRole('button', { name: 'Reconcile' }))

		await waitFor(() =>
			expect(mutateAsync).toHaveBeenCalledWith({
				id: 'card-1',
				bank_balance: -8300,
				currency: 'DOP',
				notes: undefined,
			}),
		)
		expect(toastSuccess).toHaveBeenCalledWith('Card reconciled: you owe RD$8,300.00')
		expect(setOpen).toHaveBeenCalledWith(false)
	})

	it('requires the debt', async () => {
		const user = userEvent.setup()
		renderWithIntl(<ReconcileCardModal open setOpen={vi.fn()} card={card} />)
		await user.click(screen.getByRole('button', { name: 'Reconcile' }))
		expect(await screen.findByText('Enter the debt the bank shows')).toBeInTheDocument()
		expect(mutateAsync).not.toHaveBeenCalled()
	})
})
