import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoansPage from '@/app/app/loans/page'
import { renderWithIntl } from '@/tests/utils/intl'

const mockCreate = vi.fn()

vi.mock('@/lib/repositoryConfig', () => ({
	getLoanRepository: () => ({
		findAll: () => Promise.resolve([]),
		getSummary: () => Promise.resolve(null),
		create: (...args: unknown[]) => mockCreate(...args),
	}),
}))

vi.mock('@/hooks/useFeatureFlags', () => ({
	useFeatureFlags: () => ({ isEnabled: () => true, isLoading: false }),
}))

vi.mock('@/hooks/queries/useAccountsQuery', () => ({
	ACCOUNT_KEYS: { lists: () => ['accounts', 'list'] },
	useGetAccounts: () => ({
		data: [
			{
				id: 'acc1',
				name: 'Savings',
				bank: 'BPD',
				currency: 'DOP',
				type: 'bank',
				initial_balance: 100,
				current_balance: 75.5,
				user_id: 'u1',
				created_at: '',
			},
		],
	}),
}))

async function openCreateDialog(user: ReturnType<typeof userEvent.setup>) {
	renderWithIntl(
		<QueryClientProvider client={new QueryClient()}>
			<LoansPage />
		</QueryClientProvider>,
	)
	await user.click(await screen.findByRole('button', { name: /New loan/ }))
	const dialog = await screen.findByRole('dialog')
	const [borrower] = Array.from(dialog.querySelectorAll('input'))
	await user.type(borrower, 'Ana')
	const [principal] = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="number"]'))
	return { dialog, principal }
}

describe('LoansPage create dialog', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('shows the available balance of the source account', async () => {
		const user = userEvent.setup()
		await openCreateDialog(user)

		expect(screen.getByText('Available: RD$75.50')).toBeInTheDocument()
	})

	it('shows the translated INSUFFICIENT_FUNDS message inside the dialog', async () => {
		const user = userEvent.setup()
		mockCreate.mockRejectedValueOnce(
			Object.assign(new Error('insufficient funds'), {
				status: 400,
				code: 'INSUFFICIENT_FUNDS',
				details: { available: '75.50', required: '500.00', currency: 'DOP' },
			}),
		)
		const { principal } = await openCreateDialog(user)
		await user.clear(principal)
		await user.type(principal, '500')
		await user.click(screen.getByRole('button', { name: 'Create' }))

		expect(await screen.findByRole('alert')).toHaveTextContent(
			"The source account doesn't have enough funds: only RD$75.50 available.",
		)
		expect(screen.getByRole('dialog')).toBeInTheDocument()
	})

	it('rejects a principal with more than 2 decimal places before calling the API', async () => {
		const user = userEvent.setup()
		const { dialog, principal } = await openCreateDialog(user)
		// The controlled input stores Number(value): set the whole value at once.
		fireEvent.change(principal, { target: { value: '10.005' } })
		// Submit the form directly: the browser's own step="0.01" check is not under test here.
		const form = dialog.querySelector('form')
		if (!form) throw new Error('create form not found')
		fireEvent.submit(form)

		await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Use at most 2 decimal places'))
		expect(mockCreate).not.toHaveBeenCalled()
	})
})
