import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoansPage from '@/app/app/loans/page'
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

const mockCreate = vi.fn()
const mockFindAll = vi.fn()
const mockFindById = vi.fn()
const mockRegisterPayment = vi.fn()
let searchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
	usePathname: () => '/app/loans',
	useSearchParams: () => searchParams,
}))

vi.mock('@/lib/repositoryConfig', () => ({
	getLoanRepository: () => ({
		findAll: () => mockFindAll(),
		getSummary: () => Promise.resolve(null),
		findById: (...args: unknown[]) => mockFindById(...args),
		create: (...args: unknown[]) => mockCreate(...args),
		registerPayment: (...args: unknown[]) => mockRegisterPayment(...args),
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

function renderPage() {
	return renderWithIntl(
		<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
			<LoansPage />
		</QueryClientProvider>,
	)
}

async function openCreateDialog(user: ReturnType<typeof userEvent.setup>) {
	renderPage()
	// The header's "New loan" (the empty state repeats it).
	const [headerButton] = await screen.findAllByRole('button', { name: /New loan/ })
	await user.click(headerButton)
	const dialog = await screen.findByRole('dialog')
	const [borrower] = Array.from(dialog.querySelectorAll('input'))
	await user.type(borrower, 'Ana')
	// The first amount field (money fields are text inputs with a decimal keyboard).
	const [principal] = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]'))
	return { dialog, principal }
}

describe('LoansPage', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		searchParams = new URLSearchParams()
		mockFindAll.mockResolvedValue([])
	})

	it('shows the empty state with a create action when there are no loans', async () => {
		renderPage()

		expect(await screen.findByRole('heading', { level: 2, name: 'No loans yet' })).toBeInTheDocument()
		expect(screen.getByRole('heading', { level: 1, name: 'Loans' })).toBeInTheDocument()
	})

	it('shows an error state with retry when the loans cannot be loaded', async () => {
		const user = userEvent.setup()
		mockFindAll.mockRejectedValueOnce(new Error('boom'))
		renderPage()

		expect(await screen.findByRole('alert')).toHaveTextContent('Could not load loans')
		await user.click(screen.getByRole('button', { name: 'Try again' }))
		expect(await screen.findByRole('heading', { level: 2, name: 'No loans yet' })).toBeInTheDocument()
		expect(mockFindAll).toHaveBeenCalledTimes(2)
	})
})

describe('LoansPage create dialog', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		searchParams = new URLSearchParams()
		mockFindAll.mockResolvedValue([])
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
		// Set the whole value at once (typing would go through intermediate values).
		fireEvent.change(principal, { target: { value: '10.005' } })
		// Submit the form directly (as a keyboard Enter would).
		const form = dialog.querySelector('form')
		if (!form) throw new Error('create form not found')
		fireEvent.submit(form)

		expect(await screen.findByText('Use at most 2 decimal places')).toBeInTheDocument()
		expect(principal).toHaveAttribute('aria-invalid', 'true')
		expect(mockCreate).not.toHaveBeenCalled()
	})
})

const loan = {
	id: 'l1',
	borrower_name: 'Ana',
	borrower_contact: '',
	principal_amount: 1000,
	currency: 'DOP',
	interest_mode: 'none',
	annual_rate: 0,
	term_months: 2,
	start_date: '2026-10-01',
	source_account_id: 'acc1',
	notes: '',
	total_interest: 0,
	total_amount: 1000,
	paid_principal: 100,
	paid_interest: 0,
	pending_amount: 900,
	status: 'active',
	created_at: '',
	updated_at: '',
}

function payment(id: string, amount: number) {
	return {
		id,
		destination_account_id: 'acc1',
		amount,
		principal_component: amount,
		interest_component: 0,
		payment_date: '2026-10-15',
		notes: '',
		created_at: '',
	}
}

describe('LoansPage details', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		searchParams = new URLSearchParams('selected=l1&open=details')
		mockFindAll.mockResolvedValue([loan])
	})

	it('lists each payment once after registering one with the details loaded', async () => {
		// GET /loan/:id returns every payment, the new one included.
		mockFindById
			.mockResolvedValueOnce({ loan, installments: [], payments: [payment('p1', 100)] })
			.mockResolvedValue({ loan, installments: [], payments: [payment('p2', 250), payment('p1', 100)] })
		mockRegisterPayment.mockResolvedValue(payment('p2', 250))
		// The row action sits behind the open details dialog.
		const user = userEvent.setup({ pointerEventsCheck: 0 })
		renderPage()

		const details = await screen.findByRole('dialog', { name: 'Loan details' })
		const paymentsTable = () => within(details).getAllByRole('table').at(-1) as HTMLElement
		expect(within(paymentsTable()).getAllByRole('row')).toHaveLength(2) // header + p1

		const [registerButton] = screen.getAllByRole('button', { name: 'Register payment', hidden: true })
		await user.click(registerButton)
		const paymentDialog = await screen.findByRole('dialog', { name: 'Register payment' })
		const amount = paymentDialog.querySelector<HTMLInputElement>('input[inputmode="decimal"]')
		if (!amount) throw new Error('amount field not found')
		await user.type(amount, '250')
		await user.click(within(paymentDialog).getByRole('button', { name: 'Confirm payment' }))

		await waitFor(() =>
			expect(mockRegisterPayment).toHaveBeenCalledWith('l1', expect.objectContaining({ amount: 250 })),
		)
		await waitFor(() => expect(within(paymentsTable()).getAllByRole('row')).toHaveLength(3)) // header + p2 + p1
	})
})
