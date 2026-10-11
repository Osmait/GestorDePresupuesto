import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { AccountCard } from '@/components/accounts/AccountCard'
import { renderWithIntl } from '@/tests/utils/intl'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

function toneOf(text: string) {
	return screen.getByText(text).closest('[data-tone]')?.getAttribute('data-tone')
}

describe('AccountCard', () => {
	const mockAccount = {
		id: '1',
		name: 'Main Checking',
		bank: 'Chase',
		current_balance: 5000,
		initial_balance: 4000,
		type_account: 'savings',
		currency: 'USD',
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		user_id: 'user1',
	}

	it('renders account details with the balance as a semantic Amount', () => {
		renderWithIntl(<AccountCard account={mockAccount} />)

		expect(screen.getByText('Main Checking')).toBeInTheDocument()
		expect(screen.getByText('Chase')).toBeInTheDocument()
		expect(screen.getByText('Current Balance')).toBeInTheDocument()
		expect(screen.getByText('US$5,000.00')).toHaveClass('tabular-nums')
		expect(toneOf('US$5,000.00')).toBe('positive')
	})

	it('shows the change since the initial balance with its sign and the success token', () => {
		renderWithIntl(<AccountCard account={mockAccount} />)
		expect(screen.getByText('+US$1,000.00')).toHaveClass('text-success')
	})

	it('shows a decrease with its sign and the destructive token', () => {
		renderWithIntl(<AccountCard account={{ ...mockAccount, current_balance: 3500.25 }} />)
		expect(screen.getByText('-US$499.75')).toHaveClass('text-destructive')
	})

	it('is keyboard accessible: the account name is a link to the detail page', () => {
		renderWithIntl(<AccountCard account={mockAccount} />)
		const link = screen.getByRole('link', { name: 'Main Checking' })
		expect(link).toHaveAttribute('href', '/app/accounts/1')
	})

	it('has no action menu when it is read-only', () => {
		renderWithIntl(<AccountCard account={mockAccount} />)
		expect(screen.queryByRole('button')).not.toBeInTheDocument()
	})

	it('calls onAccountEdit from the labelled 40px menu', async () => {
		const user = userEvent.setup()
		const onEdit = vi.fn()
		renderWithIntl(<AccountCard account={mockAccount} onAccountEdit={onEdit} onAccountDeleted={vi.fn()} />)

		const trigger = screen.getByRole('button', { name: 'Actions for Main Checking' })
		expect(trigger).toHaveClass('size-10')
		await user.click(trigger)
		await user.click(await screen.findByRole('menuitem', { name: 'Edit account' }))

		expect(onEdit).toHaveBeenCalledWith(mockAccount)
	})

	it('deletes only after confirming in the alert dialog', async () => {
		const user = userEvent.setup()
		const onDelete = vi.fn().mockResolvedValue(undefined)
		renderWithIntl(<AccountCard account={mockAccount} onAccountEdit={vi.fn()} onAccountDeleted={onDelete} />)

		await user.click(screen.getByRole('button', { name: 'Actions for Main Checking' }))
		await user.click(await screen.findByRole('menuitem', { name: 'Delete account' }))

		const dialog = await screen.findByRole('alertdialog', { name: 'Delete the account "Main Checking"?' })
		expect(onDelete).not.toHaveBeenCalled()
		await user.click(screen.getByRole('button', { name: 'Delete' }))

		expect(onDelete).toHaveBeenCalledTimes(1)
		await waitFor(() => expect(dialog).not.toBeInTheDocument())
	})
})
