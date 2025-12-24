import { render, screen } from '@testing-library/react'
import { TransactionActions } from '@/components/transactions/TransactionActions'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

// Mock hooks
vi.mock('@/components/transactions/TransactionContext', () => ({
    useTransactionContext: () => ({
        openModal: vi.fn(),
        setOpenModal: vi.fn(),
        filters: {},
        setFilters: vi.fn()
    })
}))

vi.mock('@/hooks/queries/useAccountsQuery', () => ({
    useGetAccounts: () => ({ data: [{ id: 'a1', name: 'Account 1' }], isLoading: false })
}))

vi.mock('@/hooks/queries/useCategoriesQuery', () => ({
    useGetCategories: () => ({ data: [{ id: 'c1', name: 'Category 1' }], isLoading: false })
}))

vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key
}))

// Mock child components
vi.mock('@/components/transactions/TransactionFormModal', () => ({
    default: () => <div data-testid="transaction-form-modal">Form</div>
}))

vi.mock('@/components/transactions/TransactionSort', () => ({
    TransactionSort: () => <div data-testid="transaction-sort">Sort</div>
}))

describe('TransactionActions', () => {
    it('renders action buttons', () => {
        render(<TransactionActions />)

        // Check for add and filter buttons (translations return keys)
        expect(screen.getByText('addTransaction')).toBeInTheDocument()
        expect(screen.getByText('filters')).toBeInTheDocument()
    })

    it('opens filter drawer on click', async () => {
        const user = userEvent.setup()
        render(<TransactionActions />)

        await user.click(screen.getByText('filters'))

        // Drawer should open
        expect(await screen.findByText('filterTransactions')).toBeInTheDocument()
    })
})
