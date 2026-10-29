import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReconcileAccountModal } from '@/components/accounts/ReconcileAccountModal'
import { renderWithIntl } from '@/tests/utils/intl'
import type { Account } from '@/types/account'

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

const account: Account = {
	id: 'acc1',
	name: 'Principal',
	bank: 'Ban Reservas',
	initial_balance: 1000,
	current_balance: 749.5,
	currency: 'DOP',
	type: 'bank',
	user_id: 'u1',
	created_at: '',
}

describe('ReconcileAccountModal', () => {
	it('shows the app balance and the live adjustment for the typed bank balance', async () => {
		const user = userEvent.setup()
		renderWithIntl(<ReconcileAccountModal open setOpen={vi.fn()} account={account} />)

		expect(screen.getByRole('dialog', { name: 'Reconcile Principal' })).toBeInTheDocument()
		expect(screen.getByText('RD$749.50')).toBeInTheDocument()

		await user.type(screen.getByLabelText('Balance at the bank'), '800')
		expect(screen.getByText('+RD$50.50')).toHaveClass('text-success')

		await user.clear(screen.getByLabelText('Balance at the bank'))
		await user.type(screen.getByLabelText('Balance at the bank'), '749.5')
		expect(screen.getByText('Matches: no adjustment needed')).toBeInTheDocument()
	})

	it('sends the bank balance and closes with a toast naming the adjustment', async () => {
		const user = userEvent.setup()
		const setOpen = vi.fn()
		mutateAsync.mockResolvedValue({ adjusted: true, difference: -49.5, reconciliation: {} })
		renderWithIntl(<ReconcileAccountModal open setOpen={setOpen} account={account} />)

		await user.type(screen.getByLabelText('Balance at the bank'), '700')
		await user.type(screen.getByLabelText('Note (optional)'), 'bank app')
		await user.click(screen.getByRole('button', { name: 'Reconcile' }))

		await waitFor(() =>
			expect(mutateAsync).toHaveBeenCalledWith({ id: 'acc1', bank_balance: 700, currency: 'DOP', notes: 'bank app' }),
		)
		expect(toastSuccess).toHaveBeenCalledWith('Account reconciled with an adjustment of -RD$49.50')
		expect(setOpen).toHaveBeenCalledWith(false)
	})

	it('accepts a negative (overdrawn) balance', async () => {
		const user = userEvent.setup()
		mutateAsync.mockResolvedValue({ adjusted: true, difference: -799.5, reconciliation: {} })
		renderWithIntl(<ReconcileAccountModal open setOpen={vi.fn()} account={account} />)

		await user.type(screen.getByLabelText('Balance at the bank'), '-50')
		await user.click(screen.getByRole('button', { name: 'Reconcile' }))

		await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ bank_balance: -50 })))
	})

	it('requires the bank balance', async () => {
		const user = userEvent.setup()
		renderWithIntl(<ReconcileAccountModal open setOpen={vi.fn()} account={account} />)

		await user.click(screen.getByRole('button', { name: 'Reconcile' }))

		expect(await screen.findByText('Enter the balance the bank shows')).toBeInTheDocument()
		expect(mutateAsync).not.toHaveBeenCalled()
	})

	it('keeps the dialog open with an error when the request fails', async () => {
		const user = userEvent.setup()
		const setOpen = vi.fn()
		mutateAsync.mockRejectedValue(new Error('boom'))
		renderWithIntl(<ReconcileAccountModal open setOpen={setOpen} account={account} />)

		await user.type(screen.getByLabelText('Balance at the bank'), '10')
		await user.click(screen.getByRole('button', { name: 'Reconcile' }))

		expect(await screen.findByText('Could not reconcile the account')).toBeInTheDocument()
		expect(setOpen).not.toHaveBeenCalledWith(false)
	})
})
