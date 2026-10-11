import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, vi } from 'vitest'
import { AccountActions } from '@/components/accounts/AccountActions'
import { renderWithIntl } from '@/tests/utils/intl'

const mockCreateAccount = vi.fn()
const mockSetCreateOpen = vi.fn()
let mockIsCreateOpen = false

vi.mock('@/components/accounts/AccountContext', () => ({
	useAccountContext: () => ({
		createAccount: mockCreateAccount,
		isCreateOpen: mockIsCreateOpen,
		setCreateOpen: mockSetCreateOpen,
	}),
}))

// The dialog itself is covered by FormDialog's tests; check the wiring only.
vi.mock('@/components/accounts/AccountFormModal', () => ({
	AccountFormModal: ({ open, createAccount }: any) =>
		open ? (
			<div data-testid='mock-modal'>
				<button type='button' onClick={() => createAccount('New Bank', 'Bank', 1000).catch(() => {})}>
					Create
				</button>
			</div>
		) : null,
}))

describe('AccountActions', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockIsCreateOpen = false
		mockCreateAccount.mockResolvedValue(undefined)
	})

	it('renders the "New account" button with the Plus icon', () => {
		renderWithIntl(<AccountActions />)
		const button = screen.getByRole('button', { name: 'New Account' })
		expect(button.querySelector('svg.lucide-plus')).not.toBeNull()
	})

	it('opens the dialog through the account context', () => {
		renderWithIntl(<AccountActions />)
		expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'New Account' }))
		expect(mockSetCreateOpen).toHaveBeenCalledWith(true)
	})

	it('creates the account and closes the dialog on success', async () => {
		mockIsCreateOpen = true
		renderWithIntl(<AccountActions />)
		fireEvent.click(screen.getByText('Create'))

		expect(mockCreateAccount).toHaveBeenCalledWith('New Bank', 'Bank', 1000)
		await waitFor(() => expect(mockSetCreateOpen).toHaveBeenCalledWith(false))
	})

	it('keeps the dialog open when creating fails', async () => {
		mockIsCreateOpen = true
		mockCreateAccount.mockRejectedValue(new Error('boom'))
		renderWithIntl(<AccountActions />)
		fireEvent.click(screen.getByText('Create'))

		await waitFor(() => expect(mockCreateAccount).toHaveBeenCalled())
		expect(mockSetCreateOpen).not.toHaveBeenCalledWith(false)
	})
})
