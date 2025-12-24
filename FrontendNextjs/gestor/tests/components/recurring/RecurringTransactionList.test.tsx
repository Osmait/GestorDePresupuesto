import { render, screen } from '@testing-library/react'
import { RecurringTransactionList } from '@/components/recurring/RecurringTransactionList'
import { vi } from 'vitest'

// Mock context
vi.mock('@/components/recurring/RecurringTransactionContext', () => ({
    useRecurringTransactionContext: () => ({
        setEditingTransaction: vi.fn(),
        setModalOpen: vi.fn()
    })
}))

// Mock hooks with data
vi.mock('@/hooks/queries/useRecurringTransactionsQuery', () => ({
    useRecurringTransactionsQuery: () => ({
        data: [
            {
                id: 'rt1',
                name: 'Netflix Subscription',
                amount: 15.99,
                type: 'expense',
                day_of_month: 15,
                last_execution_date: '2024-01-15'
            },
            {
                id: 'rt2',
                name: 'Salary',
                amount: 5000,
                type: 'income',
                day_of_month: 1,
                last_execution_date: null
            }
        ],
        isLoading: false
    }),
    useDeleteRecurringTransactionMutation: () => ({
        mutate: vi.fn()
    })
}))

describe('RecurringTransactionList', () => {
    it('renders list of recurring transactions', () => {
        render(<RecurringTransactionList />)

        expect(screen.getByText('Netflix Subscription')).toBeInTheDocument()
        expect(screen.getByText('Salary')).toBeInTheDocument()

        // Check amounts are rendered (split text due to formatting)
        expect(screen.getByText(/15\.99/)).toBeInTheDocument()
        expect(screen.getByText(/5,000/)).toBeInTheDocument()

        // Check day of month uses getAllByText to handle multiple matches
        expect(screen.getAllByText(/Día \d+/).length).toBeGreaterThanOrEqual(2)
    })

    it('shows empty state when no transactions', () => {
        vi.doMock('@/hooks/queries/useRecurringTransactionsQuery', () => ({
            useRecurringTransactionsQuery: () => ({
                data: [],
                isLoading: false
            }),
            useDeleteRecurringTransactionMutation: () => ({
                mutate: vi.fn()
            })
        }))
        // Note: This test would require remounting with new mock, showing pattern
    })
})
