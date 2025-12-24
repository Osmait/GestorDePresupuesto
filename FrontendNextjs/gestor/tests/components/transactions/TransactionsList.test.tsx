import { render, screen } from '@testing-library/react'
import TransactionsList from '@/components/transactions/TransactionsList'
import { vi } from 'vitest'
import { TypeTransaction } from '@/types/transaction'

// Mock Hooks
vi.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}))

// Mock Contexts
vi.mock('@/components/transactions/TransactionContext', () => ({
    useTransactionContext: () => ({
        transactions: [
            {
                id: 't1',
                name: 'Salary',
                amount: 5000,
                type_transation: TypeTransaction.INCOME,
                category_id: 'c1'
            },
            {
                id: 't2',
                name: 'Rent',
                amount: 1000,
                type_transation: TypeTransaction.BILL,
                category_id: 'c2'
            }
        ],
        pagination: { total_records: 2, current_page: 1, total_pages: 1 },
        isLoading: false,
        deleteTransaction: vi.fn(),
        clearFilters: vi.fn(),
        reloadCurrentView: vi.fn()
    })
}))

vi.mock('@/hooks/queries/useCategoriesQuery', () => ({
    useGetCategories: () => ({
        data: [{ id: 'c1', name: 'Work' }, { id: 'c2', name: 'Housing' }],
        isLoading: false
    })
}))

vi.mock('@/hooks/queries/useAccountsQuery', () => ({
    useGetAccounts: () => ({
        data: [],
        isLoading: false
    })
}))

// Mock Subcomponents
vi.mock('@/components/transactions/TransactionItem', () => ({
    default: ({ transaction, category }: any) => (
        <div data-testid="transaction-item">
            {transaction.name} - {category?.name}
        </div>
    )
}))

vi.mock('@/components/transactions/TransactionSummaryCard', () => ({
    default: ({ transactions }: any) => (
        <div data-testid="summary-card">Summary: {transactions.length}</div>
    )
}))

vi.mock('@/components/common/animated-tabs', () => ({
    AnimatedTabs: ({ tabs }: any) => (
        <div>
            {tabs.map((t: any) => <div key={t.value}>{t.label}</div>)}
        </div>
    )
}))

vi.mock('@/components/transactions/TransactionSort', () => ({
    TransactionSort: () => <div>Sort</div>
}))

describe('TransactionsList', () => {
    it('renders list of transactions', () => {
        render(<TransactionsList />)
        expect(screen.getByTestId('summary-card')).toBeInTheDocument()
        expect(screen.getAllByTestId('transaction-item')).toHaveLength(2)
        expect(screen.getByText('Salary - Work')).toBeInTheDocument()
        expect(screen.getByText('Rent - Housing')).toBeInTheDocument()
    })
})
