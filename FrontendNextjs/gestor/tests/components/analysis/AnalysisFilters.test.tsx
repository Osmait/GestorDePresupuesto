import { render, screen } from '@testing-library/react'
import { AnalysisFiltersForm } from '@/components/analysis/AnalysisFilters'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

// Mock translations
vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key
}))

// Mock date range picker
vi.mock('@/components/date-range-picker', () => ({
    CalendarDateRangePicker: () => <div data-testid="date-picker">Date Picker</div>
}))

describe('AnalysisFiltersForm', () => {
    const mockFilters = {
        filterMode: 'month' as const,
        month: '01',
        year: '2024',
        dateRange: { from: undefined, to: undefined },
        account: 'all',
        category: 'all',
        type: 'all',
        minAmount: '',
        maxAmount: '',
        search: ''
    }
    const mockSetFilters = vi.fn()
    const mockAccounts = [{ id: 'a1', name: 'Checking', user_id: 'u1' }] as any[]
    const mockCategories = [{ id: 'c1', name: 'Food', icon: '🍔', color: '#f00' }] as any[]

    beforeEach(() => {
        mockSetFilters.mockClear()
    })

    it('renders filter mode buttons', () => {
        render(
            <AnalysisFiltersForm
                filters={mockFilters}
                setFilters={mockSetFilters}
                accounts={mockAccounts}
                categories={mockCategories}
            />
        )

        expect(screen.getByText('monthYear')).toBeInTheDocument()
        expect(screen.getByText('dateRange')).toBeInTheDocument()
    })

    it('renders all filter fields', () => {
        render(
            <AnalysisFiltersForm
                filters={mockFilters}
                setFilters={mockSetFilters}
                accounts={mockAccounts}
                categories={mockCategories}
            />
        )

        expect(screen.getByLabelText('account')).toBeInTheDocument()
        expect(screen.getByLabelText('category')).toBeInTheDocument()
        expect(screen.getByLabelText('type')).toBeInTheDocument()
        expect(screen.getByLabelText('minAmount')).toBeInTheDocument()
        expect(screen.getByLabelText('maxAmount')).toBeInTheDocument()
        expect(screen.getByLabelText('searchLabel')).toBeInTheDocument()
    })

    it('shows date picker when range mode is selected', () => {
        render(
            <AnalysisFiltersForm
                filters={{ ...mockFilters, filterMode: 'range' }}
                setFilters={mockSetFilters}
                accounts={mockAccounts}
                categories={mockCategories}
            />
        )

        expect(screen.getByTestId('date-picker')).toBeInTheDocument()
    })
})
