import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AnalysisDashboard } from '@/components/analysis/AnalysisDashboard'
import type { useAnalysisReport } from '@/components/analysis/useAnalysisReport'
import { renderWithIntl } from '../../utils/intl'
import { makeReport, summary, TODAY } from './fixtures'

type ReportState = ReturnType<typeof useAnalysisReport>

const reportState = vi.hoisted(() => ({ current: null as unknown }))

vi.mock('@/components/analysis/useAnalysisUrlState', () => ({
	useAnalysisUrlState: () => ({
		today: TODAY,
		period: { mode: 'month', year: 2026, month: 10 },
		accountId: undefined,
		setPeriod: vi.fn(),
		setAccount: vi.fn(),
	}),
}))

vi.mock('@/components/analysis/useAnalysisReport', async (importOriginal) => ({
	...(await importOriginal<object>()),
	useAnalysisReport: () => reportState.current,
}))

vi.mock('@/hooks/queries/useAccountsQuery', () => ({
	useGetAccounts: () => ({ data: [] }),
}))

function state(overrides: Partial<ReportState> = {}): ReportState {
	const report = makeReport()
	return {
		resolved: report.resolved,
		filters: { date_from: '2026-10-01', date_to: '2026-10-11' },
		report,
		isLoading: false,
		isError: false,
		refetch: vi.fn(),
		planLoading: false,
		budgetsLoading: false,
		budgetsError: false,
		refetchBudgets: vi.fn(),
		topExpenses: [],
		topLoading: false,
		...overrides,
	} as ReportState
}

describe('AnalysisDashboard', () => {
	beforeEach(() => {
		reportState.current = state()
	})

	it('renders every section of the month report', () => {
		renderWithIntl(<AnalysisDashboard />)

		expect(screen.getByRole('heading', { level: 2, name: /You spent RD\$70,100\.00/ })).toBeInTheDocument()
		for (const name of [
			'What changed',
			'Budget pace',
			'Your plan vs reality',
			'Largest expenses',
			'Last 6 months',
			"Where this month's money went",
		]) {
			expect(screen.getByRole('region', { name })).toBeInTheDocument()
		}
		// The old tools and duplicate charts are gone.
		expect(screen.queryByText(/radar/i)).not.toBeInTheDocument()
		expect(screen.queryByText(/What-if/i)).not.toBeInTheDocument()
	})

	it('drops the month-only sections in year mode', () => {
		reportState.current = state({ report: makeReport({ period: { mode: 'year', year: 2026 } }) })
		renderWithIntl(<AnalysisDashboard />)

		expect(screen.queryByRole('region', { name: 'Budget pace' })).not.toBeInTheDocument()
		expect(screen.queryByRole('region', { name: 'Your plan vs reality' })).not.toBeInTheDocument()
		expect(screen.getByRole('region', { name: 'Largest expenses' })).toBeInTheDocument()
		expect(screen.getByRole('region', { name: 'Where the money went' })).toBeInTheDocument()
	})

	it('shows the loading skeleton', () => {
		reportState.current = state({ isLoading: true, report: null })
		const { container } = renderWithIntl(<AnalysisDashboard />)
		expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
	})

	it('shows an error with retry instead of a report full of zeros', () => {
		const refetch = vi.fn()
		reportState.current = state({ isError: true, report: null, refetch })
		renderWithIntl(<AnalysisDashboard />)

		expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load your analytics")
		fireEvent.click(screen.getByRole('button', { name: /try again/i }))
		expect(refetch).toHaveBeenCalled()
	})

	it('shows an empty state for a period without transactions', () => {
		reportState.current = state({ report: makeReport({ current: summary(), previous: summary() }) })
		renderWithIntl(<AnalysisDashboard />)

		expect(screen.getByRole('heading', { name: 'No data for this period' })).toBeInTheDocument()
		expect(screen.queryByRole('region', { name: 'What changed' })).not.toBeInTheDocument()
	})
})
