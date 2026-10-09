import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Search } from '@/components/common/search'
import { renderWithIntl } from '@/tests/utils/intl'

// Mock hooks and router
vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn() }),
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
})
