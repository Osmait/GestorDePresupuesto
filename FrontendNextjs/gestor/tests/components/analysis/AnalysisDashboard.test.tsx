import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { AnalysisDashboard, hasPlottableValues } from '@/components/analysis/AnalysisDashboard'

// Mock next/dynamic
vi.mock('next/dynamic', () => ({
	default: vi.fn((_loader: any) => {
		const MockComponent = (props: any) => {
			// Identify chart by specific props passed in AnalysisDashboard.tsx
			let testId = 'dynamic-chart'
			if (props.t?.income && props.t?.month && !props.t?.day) testId = 'nivo-line'
			if (props.t?.category) testId = 'nivo-bar'
			if (props.nivoTheme && !props.t) testId = 'nivo-pie'
			if (props.t?.expenses && !props.t?.month && !props.t?.day) testId = 'nivo-radar'
			if (props.t?.day) testId = 'nivo-heatmap'

			// Filter out non-DOM props to avoid React warnings
			const { nivoTheme, t, theme, ...domProps } = props
			return (
				<div {...domProps} data-testid={testId}>
					{testId}
				</div>
			)
		}
		return MockComponent
	}),
}))

// Mock theme
vi.mock('next-themes', () => ({
	useTheme: () => ({ theme: 'light' }),
}))

vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn() }),
}))

// Mock all Nivo charts
vi.mock('@nivo/line', () => ({
	ResponsiveLine: () => <div data-testid='nivo-line'>Line Chart</div>,
}))
vi.mock('@nivo/bar', () => ({
	ResponsiveBar: () => <div data-testid='nivo-bar'>Bar Chart</div>,
}))
vi.mock('@nivo/radar', () => ({
	ResponsiveRadar: () => <div data-testid='nivo-radar'>Radar Chart</div>,
}))
vi.mock('@nivo/heatmap', () => ({
	ResponsiveHeatMap: () => <div data-testid='nivo-heatmap'>Heatmap</div>,
}))
vi.mock('@nivo/pie', () => ({
	ResponsivePie: () => <div data-testid='nivo-pie'>Pie Chart</div>,
}))

// Mock theme
vi.mock('next-themes', () => ({
	useTheme: () => ({ theme: 'light' }),
}))

// Mock translations
vi.mock('next-intl', () => ({
	useTranslations: () => (key: string) => key,
}))

// Mock context
vi.mock('@/components/analysis/AnalysisContext', () => ({
	useAnalysisContext: () => ({
		filters: {
			filterMode: 'month',
			month: 'all',
			year: '2026',
			dateRange: { from: undefined, to: undefined },
			account: 'all',
			category: 'all',
			type: 'all',
			minAmount: '',
			maxAmount: '',
			search: '',
		},
	}),
}))

// Mock all data hooks
vi.mock('@/hooks/queries/useAccountsQuery', () => ({
	useGetAccounts: () => ({ data: [], isLoading: false }),
}))
vi.mock('@/hooks/queries/useCategoriesQuery', () => ({
	useGetCategories: () => ({ data: [], isLoading: false }),
}))
vi.mock('@/hooks/queries/useBudgetsQuery', () => ({
	useGetBudgets: () => ({ data: [], isLoading: false }),
}))
vi.mock('@/hooks/queries/useTransactionsQuery', () => ({
	useGetAllTransactions: () => ({ data: [], isLoading: false }),
}))
const summaryState = vi.hoisted(() => ({ data: null as any }))

vi.mock('@/hooks/queries/useAnalyticsQuery', () => ({
	useGetDashboardSummary: () => ({ data: summaryState.data, isLoading: false }),
}))

const fullSummary = {
	total_income: 1000,
	total_expenses: 500,
	net_amount: 500,
	usd_to_dop_rate: 60,
	accounts_total: 0,
	investments_total: 0,
	certificates_total: 0,
	accounts_count: 0,
	investments_count: 0,
	certificates_count: 0,
	category_expenses: [
		{ id: 'cat1', label: 'Food', value: 300, color: '#f00', transaction_count: 3, dop_total: 300, usd_total: 0 },
		{ id: 'cat2', label: 'Rent', value: 150, color: '#0f0', transaction_count: 1, dop_total: 150, usd_total: 0 },
		{ id: 'cat3', label: 'Fun', value: 50, color: '#00f', transaction_count: 2, dop_total: 50, usd_total: 0 },
	],
	monthly_summary: [{ month: 'Jan', Ingresos: 1000, Gastos: 500 }],
}

const emptySummary = {
	...fullSummary,
	total_income: 0,
	total_expenses: 0,
	net_amount: 0,
	category_expenses: [],
	monthly_summary: [],
}

describe('AnalysisDashboard', () => {
	beforeEach(() => {
		summaryState.data = fullSummary
	})

	it('renders all chart components when data is loaded', async () => {
		render(<AnalysisDashboard />)

		// Verify all chart titles are present
		expect(screen.getByText('incomeExpensesByMonth')).toBeInTheDocument()
		expect(screen.getByText('expensesByCategory')).toBeInTheDocument()
		expect(screen.getByText('categoryDistribution')).toBeInTheDocument()
		expect(screen.getByText('categoryRadar')).toBeInTheDocument()
		expect(screen.getByText('weeklyHeatmap')).toBeInTheDocument()

		// Verify all charts are rendered (use findBy since they are loaded dynamically)
		expect(await screen.findByTestId('nivo-line')).toBeInTheDocument()
		expect(await screen.findByTestId('nivo-bar')).toBeInTheDocument()
		expect(await screen.findByTestId('nivo-pie')).toBeInTheDocument()
		expect(await screen.findByTestId('nivo-radar')).toBeInTheDocument()
		expect(await screen.findByTestId('nivo-heatmap')).toBeInTheDocument()
	})

	it('shows an empty state instead of charts and a fake "low savings" insight when there is no data', () => {
		summaryState.data = emptySummary
		render(<AnalysisDashboard />)

		expect(screen.getByText('emptyTitle')).toBeInTheDocument()
		expect(screen.queryByText('insightSavingsLowTitle')).not.toBeInTheDocument()
		expect(screen.queryByText('insightBalancedTitle')).not.toBeInTheDocument()
		// Charts with empty data are not rendered (nivo would emit d="null" paths)
		expect(screen.queryByTestId('nivo-line')).not.toBeInTheDocument()
		expect(screen.queryByTestId('nivo-bar')).not.toBeInTheDocument()
		expect(screen.queryByTestId('nivo-pie')).not.toBeInTheDocument()
		expect(screen.queryByTestId('nivo-radar')).not.toBeInTheDocument()
		expect(screen.getAllByText('noData').length).toBe(4)
	})
})

describe('hasPlottableValues', () => {
	it('requires at least one finite non-zero value', () => {
		expect(hasPlottableValues([])).toBe(false)
		expect(hasPlottableValues([0, 0])).toBe(false)
		expect(hasPlottableValues([Number.NaN, undefined, null])).toBe(false)
		expect(hasPlottableValues([0, 12.5])).toBe(true)
	})
})
