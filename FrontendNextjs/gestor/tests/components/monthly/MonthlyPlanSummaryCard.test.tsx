import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MonthlyPlanSummaryCard } from '@/components/monthly/MonthlyPlanSummaryCard'
import { MonthlyPlanSummary } from '@/types/monthlyPlan'

vi.mock('next-intl', () => ({
	useTranslations: () => (key: string, values?: Record<string, unknown>) => {
		const translations: Record<string, string> = {
			summaryTitle: 'Plan summary',
			totalIncome: 'Fixed income',
			totalExpenses: 'Fixed expenses',
			available: 'Available',
			committed: 'Committed',
			overcommitted: 'Your fixed expenses exceed your income',
		}
		if (key === 'itemsCount') return `${values?.count} items`
		if (key === 'rateNote') return `rate ${values?.rate}`
		return translations[key] || key
	},
}))

vi.mock('@/components/ui/animated-counter', () => ({
	AnimatedCounter: ({
		value,
		prefix = '',
		suffix = '',
		currency,
	}: {
		value: number
		prefix?: string
		suffix?: string
		currency?: string
	}) => (
		<span>
			{currency ? `${currency} ` : prefix}
			{value}
			{suffix}
		</span>
	),
}))

function makeSummary(overrides: Partial<MonthlyPlanSummary> = {}): MonthlyPlanSummary {
	return {
		total_income: 97000,
		total_expenses: 27790,
		available: 69210,
		committed_percentage: 28.6,
		usd_to_dop_rate: 62.5,
		income_count: 2,
		expenses_count: 3,
		...overrides,
	}
}

describe('MonthlyPlanSummaryCard', () => {
	it('renders the four totals coming from the backend', () => {
		render(<MonthlyPlanSummaryCard summary={makeSummary()} />)

		expect(screen.getByText('DOP 97000')).toBeInTheDocument()
		expect(screen.getByText('DOP 27790')).toBeInTheDocument()
		expect(screen.getByText('DOP 69210')).toBeInTheDocument()
		expect(screen.getByText('28.6%')).toBeInTheDocument()
	})

	it('shows how many items make up each side', () => {
		render(<MonthlyPlanSummaryCard summary={makeSummary()} />)

		expect(screen.getByText('2 items')).toBeInTheDocument()
		expect(screen.getByText('3 items')).toBeInTheDocument()
	})

	it('warns when the plan does not add up', () => {
		render(<MonthlyPlanSummaryCard summary={makeSummary({ available: -5000, committed_percentage: 125 })} />)

		expect(screen.getByText('Your fixed expenses exceed your income')).toBeInTheDocument()
	})

	it('does not warn when there is money left', () => {
		render(<MonthlyPlanSummaryCard summary={makeSummary()} />)

		expect(screen.queryByText('Your fixed expenses exceed your income')).not.toBeInTheDocument()
	})

	// The bar is capped so it cannot overflow its container, but the printed
	// percentage must still show the real number.
	it('caps the progress bar at 100% while printing the true percentage', () => {
		render(<MonthlyPlanSummaryCard summary={makeSummary({ committed_percentage: 125 })} />)

		expect(screen.getByText('125%')).toBeInTheDocument()
		expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
	})

	function indicator() {
		return screen.getByRole('progressbar').firstElementChild as HTMLElement
	}

	it('turns the bar red when overcommitted', () => {
		render(<MonthlyPlanSummaryCard summary={makeSummary({ committed_percentage: 125 })} />)

		expect(indicator().className).toContain('bg-destructive')
	})

	it('turns the bar amber when close to the limit', () => {
		render(<MonthlyPlanSummaryCard summary={makeSummary({ committed_percentage: 90 })} />)

		expect(indicator().className).toContain('bg-warning')
	})

	it('keeps the bar neutral with room to spare', () => {
		render(<MonthlyPlanSummaryCard summary={makeSummary({ committed_percentage: 28.6 })} />)

		expect(indicator().className).toContain('bg-primary')
	})

	it('labels the progress bar', () => {
		render(<MonthlyPlanSummaryCard summary={makeSummary()} />)

		expect(screen.getByRole('progressbar', { name: 'committedBar' })).toBeInTheDocument()
	})

	it('shows the exchange rate used for USD items', () => {
		render(<MonthlyPlanSummaryCard summary={makeSummary()} />)

		expect(screen.getByText('rate 62.50')).toBeInTheDocument()
	})

	it('hides the rate note when no rate is available', () => {
		render(<MonthlyPlanSummaryCard summary={makeSummary({ usd_to_dop_rate: 0 })} />)

		expect(screen.queryByText(/^rate /)).not.toBeInTheDocument()
	})

	it('renders an empty plan as zeros without crashing', () => {
		render(
			<MonthlyPlanSummaryCard
				summary={makeSummary({
					total_income: 0,
					total_expenses: 0,
					available: 0,
					committed_percentage: 0,
					usd_to_dop_rate: 0,
					income_count: 0,
					expenses_count: 0,
				})}
			/>,
		)

		expect(screen.getByText('0%')).toBeInTheDocument()
	})
})
