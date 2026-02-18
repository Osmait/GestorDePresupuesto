import { render, screen } from '@testing-library/react'
import { TransactionActions } from '@/components/transactions/TransactionActions'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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

vi.mock('@/hooks/queries/useAIQuery', () => ({
    useExtractFromFile: () => ({
        extract: vi.fn(),
        isExtracting: false,
        extractData: null,
        reset: vi.fn()
    }),
    useAnalyzeSpendingMutation: () => ({
        mutateAsync: vi.fn(),
        isPending: false
    })
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

vi.mock('@/components/ai/AIExtractionModal', () => ({
    AIExtractionModal: () => <div data-testid="ai-extraction-modal">AI Modal</div>
}))

vi.mock('@/components/ai/SpendingInsightsModal', () => ({
    SpendingInsightsModal: () => <div data-testid="spending-insights-modal">Insights Modal</div>
}))

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
}

describe('TransactionActions', () => {
    it('renders action buttons', () => {
        render(<TransactionActions />, { wrapper: createWrapper() })

        expect(screen.getByText('addTransaction')).toBeInTheDocument()
        expect(screen.getByText('filters')).toBeInTheDocument()
    })

    it('opens filter drawer on click', async () => {
        const user = userEvent.setup()
        render(<TransactionActions />, { wrapper: createWrapper() })

        await user.click(screen.getByText('filters'))

        expect(await screen.findByText('filterTransactions')).toBeInTheDocument()
    })
})
