import { render, screen } from '@testing-library/react'
import { AnalysisDashboard } from '@/components/analysis/AnalysisDashboard'
import { vi } from 'vitest'

// Mock all Nivo charts
vi.mock('@nivo/line', () => ({
    ResponsiveLine: () => <div data-testid="nivo-line">Line Chart</div>
}))
vi.mock('@nivo/bar', () => ({
    ResponsiveBar: () => <div data-testid="nivo-bar">Bar Chart</div>
}))
vi.mock('@nivo/radar', () => ({
    ResponsiveRadar: () => <div data-testid="nivo-radar">Radar Chart</div>
}))
vi.mock('@nivo/heatmap', () => ({
    ResponsiveHeatMap: () => <div data-testid="nivo-heatmap">Heatmap</div>
}))
vi.mock('@nivo/pie', () => ({
    ResponsivePie: () => <div data-testid="nivo-pie">Pie Chart</div>
}))

// Mock theme
vi.mock('next-themes', () => ({
    useTheme: () => ({ theme: 'light' })
}))

// Mock translations
vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key
}))

// Mock context
vi.mock('@/components/analysis/AnalysisContext', () => ({
    useAnalysisContext: () => ({
        filters: {}
    })
}))

// Mock all data hooks
vi.mock('@/hooks/queries/useAccountsQuery', () => ({
    useGetAccounts: () => ({ data: [], isLoading: false })
}))
vi.mock('@/hooks/queries/useCategoriesQuery', () => ({
    useGetCategories: () => ({ data: [], isLoading: false })
}))
vi.mock('@/hooks/queries/useTransactionsQuery', () => ({
    useGetAllTransactions: () => ({ data: [], isLoading: false })
}))
vi.mock('@/hooks/queries/useAnalyticsQuery', () => ({
    useGetCategoryExpenses: () => ({
        data: [{ id: 'cat1', label: 'Food', value: 500, color: '#f00' }],
        isLoading: false
    }),
    useGetMonthlySummary: () => ({
        data: [{ month: 'Jan', Ingresos: 1000, Gastos: -500 }],
        isLoading: false
    })
}))

describe('AnalysisDashboard', () => {
    it('renders all chart components when data is loaded', () => {
        render(<AnalysisDashboard />)

        // Verify all chart titles are present
        expect(screen.getByText('incomeExpensesByMonth')).toBeInTheDocument()
        expect(screen.getByText('expensesByCategory')).toBeInTheDocument()
        expect(screen.getByText('categoryDistribution')).toBeInTheDocument()
        expect(screen.getByText('categoryRadar')).toBeInTheDocument()
        expect(screen.getByText('weeklyHeatmap')).toBeInTheDocument()

        // Verify all charts are rendered
        expect(screen.getByTestId('nivo-line')).toBeInTheDocument()
        expect(screen.getByTestId('nivo-bar')).toBeInTheDocument()
        expect(screen.getByTestId('nivo-pie')).toBeInTheDocument()
        expect(screen.getByTestId('nivo-radar')).toBeInTheDocument()
        expect(screen.getByTestId('nivo-heatmap')).toBeInTheDocument()
    })
})
