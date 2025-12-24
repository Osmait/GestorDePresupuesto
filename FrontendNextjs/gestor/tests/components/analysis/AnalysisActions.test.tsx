import { render, screen } from '@testing-library/react'
import { AnalysisActions } from '@/components/analysis/AnalysisActions'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

// Mock translations
vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key
}))

// Mock context
vi.mock('@/components/analysis/AnalysisContext', () => ({
    useAnalysisContext: () => ({
        filters: {
            filterMode: 'month',
            month: '01',
            year: '2024',
            dateRange: { from: undefined, to: undefined },
            account: 'all',
            category: 'all',
            type: 'all',
            minAmount: '',
            maxAmount: '',
            search: ''
        },
        setFilters: vi.fn()
    })
}))

// Mock hooks
vi.mock('@/hooks/queries/useAccountsQuery', () => ({
    useGetAccounts: () => ({ data: [] })
}))
vi.mock('@/hooks/queries/useCategoriesQuery', () => ({
    useGetCategories: () => ({ data: [] })
}))

// Mock filters form
vi.mock('@/components/analysis/AnalysisFilters', () => ({
    AnalysisFiltersForm: () => <div data-testid="filters-form">Filters Form</div>
}))

describe('AnalysisActions', () => {
    it('renders filter button', () => {
        render(<AnalysisActions />)
        expect(screen.getByText('filter')).toBeInTheDocument()
    })

    it('opens drawer when filter button is clicked', async () => {
        const user = userEvent.setup()
        render(<AnalysisActions />)

        await user.click(screen.getByText('filter'))

        expect(await screen.findByText('filterAnalytics')).toBeInTheDocument()
        expect(await screen.findByTestId('filters-form')).toBeInTheDocument()
    })
})
