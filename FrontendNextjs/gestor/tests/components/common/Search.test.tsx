import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Search } from '@/components/common/search'
import { renderWithIntl } from '@/tests/utils/intl'

// Mock hooks and router
const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/hooks/queries/useSearchQuery', () => ({
	useSearchQuery: (query: string) => ({
		data: query
			? {
					transactions: [{ id: 't1', name: 'Test Transaction', amount: 100, type_transation: 'bill' }],
					categories: [{ id: 'c1', name: 'Food', icon: '🍔' }],
					accounts: [{ id: 'a1', name: 'Bank', bank: 'Chase' }],
					budgets: [],
				}
			: null,
		isLoading: false,
	}),
}))

describe('Search', () => {
	it('renders search input in Spanish', () => {
		renderWithIntl(<Search />, { locale: 'es' })
		expect(screen.getByPlaceholderText('Buscar...')).toBeInTheDocument()
	})

	it('renders search input in English', () => {
		renderWithIntl(<Search />)
		expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
	})

	it('shows results when typing', async () => {
		const user = userEvent.setup()
		renderWithIntl(<Search />)

		const input = screen.getByPlaceholderText('Search...')
		await user.type(input, 'test')

		// Wait for debounce and results
		await vi.waitFor(
			() => {
				expect(screen.getByText('Test Transaction')).toBeInTheDocument()
				expect(screen.getByText('Transactions')).toBeInTheDocument()
			},
			{ timeout: 1000 },
		)
	})

	it('exposes the input as a labelled combobox', () => {
		renderWithIntl(<Search />)
		expect(screen.getAllByRole('combobox', { name: 'Search transactions, accounts and more' }).length).toBeGreaterThan(
			0,
		)
	})

	it('moves through the results with the arrow keys and opens one with Enter', async () => {
		mockPush.mockClear()
		const user = userEvent.setup()
		renderWithIntl(<Search />)

		const input = screen.getByPlaceholderText('Search...')
		await user.type(input, 'test')
		await vi.waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument(), { timeout: 1000 })

		await user.keyboard('{ArrowDown}')
		const first = screen.getByRole('option', { name: /Test Transaction/ })
		expect(first).toHaveAttribute('aria-selected', 'true')
		expect(input).toHaveAttribute('aria-activedescendant', first.id)

		await user.keyboard('{ArrowDown}')
		expect(screen.getByRole('option', { name: /Bank/ })).toHaveAttribute('aria-selected', 'true')

		await user.keyboard('{Enter}')
		expect(mockPush).toHaveBeenCalledWith('/app/accounts/a1')
	})

	it('closes the results with Escape', async () => {
		const user = userEvent.setup()
		renderWithIntl(<Search />)

		await user.type(screen.getByPlaceholderText('Search...'), 'test')
		await vi.waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument(), { timeout: 1000 })

		await user.keyboard('{Escape}')
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
	})
})
