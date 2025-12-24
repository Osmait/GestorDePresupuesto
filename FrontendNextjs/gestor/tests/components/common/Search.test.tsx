import { render, screen } from '@testing-library/react'
import { Search } from '@/components/common/search'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

// Mock hooks and router
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn() })
}))

vi.mock('@/hooks/queries/useSearchQuery', () => ({
    useSearchQuery: (query: string) => ({
        data: query ? {
            transactions: [{ id: 't1', name: 'Test Transaction', amount: 100, type_transation: 'bill' }],
            categories: [{ id: 'c1', name: 'Food', icon: '🍔' }],
            accounts: [{ id: 'a1', name: 'Bank', bank: 'Chase' }],
            budgets: []
        } : null,
        isLoading: false
    })
}))

describe('Search', () => {
    it('renders search input', () => {
        render(<Search />)
        expect(screen.getByPlaceholderText('Buscar...')).toBeInTheDocument()
    })

    it('shows results when typing', async () => {
        const user = userEvent.setup()
        render(<Search />)

        const input = screen.getByPlaceholderText('Buscar...')
        await user.type(input, 'test')

        // Wait for debounce and results
        await vi.waitFor(() => {
            expect(screen.getByText('Test Transaction')).toBeInTheDocument()
        }, { timeout: 1000 })
    })
})
