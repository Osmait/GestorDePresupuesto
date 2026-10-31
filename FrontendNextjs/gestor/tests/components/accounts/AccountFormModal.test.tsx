import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountFormModal } from '@/components/accounts/AccountFormModal'
import { renderWithIntl } from '@/tests/utils/intl'

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

beforeAll(() => {
	HTMLElement.prototype.hasPointerCapture = vi.fn()
	HTMLElement.prototype.scrollIntoView = vi.fn()
	global.ResizeObserver = class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof globalThis.ResizeObserver
})

describe('AccountFormModal', () => {
	const createAccount = vi.fn().mockResolvedValue(undefined)

	beforeEach(() => {
		createAccount.mockClear()
	})

	function renderModal() {
		renderWithIntl(
			<AccountFormModal open setOpen={vi.fn()} createAccount={createAccount} isLoading={false} error={null} />,
		)
	}

	async function fillAndSubmit(balance: string) {
		const user = userEvent.setup()
		renderModal()
		await user.type(screen.getByPlaceholderText('Ex: Main Account'), 'Nómina')
		await user.type(screen.getByPlaceholderText('Ex: National Bank'), 'Banco Popular')
		const balanceInput = screen.getByLabelText('Initial Balance')
		await user.clear(balanceInput)
		if (balance) await user.type(balanceInput, balance)
		await user.click(screen.getByRole('button', { name: 'Create Account' }))
		return balanceInput
	}

	it('uses a text field with a decimal keyboard for the balance (not type="number")', () => {
		renderModal()
		const balanceInput = screen.getByLabelText('Initial Balance')
		expect(balanceInput).toHaveAttribute('type', 'text')
		expect(balanceInput).toHaveAttribute('inputmode', 'decimal')
	})

	it.each([
		['1500,50', 1500.5],
		['1,500.50', 1500.5],
		['1.500,50', 1500.5],
		['1500.50', 1500.5],
	])('submits %j as %d', async (typed, expected) => {
		await fillAndSubmit(typed)
		await waitFor(() => expect(createAccount).toHaveBeenCalledWith('Nómina', 'Banco Popular', expected))
	})

	it('shows a field error for an empty balance instead of saving 0', async () => {
		const balanceInput = await fillAndSubmit('')
		expect(await screen.findByText('Enter an amount')).toBeInTheDocument()
		expect(balanceInput).toHaveAttribute('aria-invalid', 'true')
		expect(createAccount).not.toHaveBeenCalled()
	})

	it('shows a field error for text that is not an amount', async () => {
		await fillAndSubmit('12abc')
		expect(await screen.findByText('Enter a valid amount, e.g. 1,500.50')).toBeInTheDocument()
		expect(createAccount).not.toHaveBeenCalled()
	})
})
