import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MonthlyPlanSummaryCard } from '@/components/monthly/MonthlyPlanSummaryCard'
import { renderWithIntl } from '@/tests/utils/intl'
import { MonthlyPlanSummary } from '@/types/monthlyPlan'

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

function indicator() {
	return screen.getByRole('progressbar').firstElementChild as HTMLElement
}

describe('MonthlyPlanSummaryCard', () => {
	it('renders the four figures in one labelled strip', () => {
		renderWithIntl(<MonthlyPlanSummaryCard summary={makeSummary()} />)

		expect(screen.getByRole('region', { name: 'Plan summary' })).toBeInTheDocument()
		expect(screen.getByTestId('summary-income')).toHaveTextContent('RD$97,000.00')
		expect(screen.getByTestId('summary-expenses')).toHaveTextContent('RD$27,790.00')
		expect(screen.getByTestId('summary-available')).toHaveTextContent('RD$69,210.00')
		expect(screen.getByTestId('summary-committed')).toHaveTextContent('28.6%')
	})

	it('counts the incomes and the active and paused expenses', () => {
		renderWithIntl(<MonthlyPlanSummaryCard summary={makeSummary()} pausedExpenses={2} />)

		expect(screen.getByText('2 income items')).toBeInTheDocument()
		expect(screen.getByText('3 active · 2 paused')).toBeInTheDocument()
	})

	it('leaves the paused count out when nothing is paused', () => {
		renderWithIntl(<MonthlyPlanSummaryCard summary={makeSummary()} />)

		expect(screen.getByText('3 active')).toBeInTheDocument()
	})

	it('warns when the plan does not add up', () => {
		renderWithIntl(<MonthlyPlanSummaryCard summary={makeSummary({ available: -5000, committed_percentage: 125 })} />)

		expect(screen.getByText('Your fixed expenses exceed your income')).toBeInTheDocument()
		expect(screen.queryByText('after fixed items')).not.toBeInTheDocument()
	})

	// The bar is capped so it cannot overflow, but the printed percentage tells the truth.
	it('caps the bar at 100% while printing the true percentage, in red', () => {
		renderWithIntl(<MonthlyPlanSummaryCard summary={makeSummary({ committed_percentage: 125 })} />)

		expect(screen.getByText('125%')).toBeInTheDocument()
		expect(screen.getByRole('progressbar', { name: 'Share of income already committed' })).toHaveAttribute(
			'aria-valuenow',
			'100',
		)
		expect(indicator().className).toContain('bg-destructive')
	})

	it('turns the bar amber close to the limit and keeps it neutral with room to spare', () => {
		const { unmount } = renderWithIntl(<MonthlyPlanSummaryCard summary={makeSummary({ committed_percentage: 90 })} />)
		expect(indicator().className).toContain('bg-warning')
		unmount()

		renderWithIntl(<MonthlyPlanSummaryCard summary={makeSummary()} />)
		expect(indicator().className).toContain('bg-primary')
	})

	it('shows the exchange rate used for USD items, and hides it without a rate', () => {
		const { unmount } = renderWithIntl(<MonthlyPlanSummaryCard summary={makeSummary()} />)
		expect(screen.getByText('USD amounts converted at RD$62.50 per dollar.')).toBeInTheDocument()
		unmount()

		renderWithIntl(<MonthlyPlanSummaryCard summary={makeSummary({ usd_to_dop_rate: 0 })} />)
		expect(screen.queryByText(/per dollar/)).not.toBeInTheDocument()
	})
})
