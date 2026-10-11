import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AnalysisHero } from '@/components/analysis/AnalysisHero'
import { BudgetPace } from '@/components/analysis/BudgetPace'
import { CategoryBreakdown } from '@/components/analysis/CategoryBreakdown'
import { CategoryChanges } from '@/components/analysis/CategoryChanges'
import { MonthlyTrend } from '@/components/analysis/MonthlyTrend'
import { PlanVsActual } from '@/components/analysis/PlanVsActual'
import { TopExpenses } from '@/components/analysis/TopExpenses'
import type { TopExpense } from '@/components/analysis/useAnalysisReport'
import { TypeTransaction } from '@/types/transaction'
import { renderWithIntl } from '../../utils/intl'
import { makeReport, PREVIOUS, summary } from './fixtures'

describe('AnalysisHero', () => {
	it('compares with the same days of the previous month and explains the change', () => {
		renderWithIntl(<AnalysisHero report={makeReport()} />)

		expect(screen.getByText('October 1–11')).toBeInTheDocument()
		expect(
			screen.getByRole('heading', {
				level: 2,
				name: 'You spent RD$70,100.00, 1.7% more than the same days of September.',
			}),
		).toBeInTheDocument()
		expect(
			screen.getByText(
				"Your plan's fixed payments were the same (RD$45,000.00). You spent more on Food and Services and less on Health and Transport.",
			),
		).toBeInTheDocument()
	})

	it('shows expected income, last complete month savings and variable spend per day', () => {
		renderWithIntl(<AnalysisHero report={makeReport()} />)

		expect(screen.getByText('RD$100,000 expected · next one on day 15')).toBeInTheDocument()
		expect(screen.getByText('Savings in September')).toBeInTheDocument()
		expect(screen.getByText('31.1%')).toBeInTheDocument()
		expect(screen.getByText('5 months average: 23.2%')).toBeInTheDocument()
		expect(screen.getByRole('img', { name: /Savings rate by month: May 20%/ })).toBeInTheDocument()
		expect(screen.getByText('Variable spending per day')).toBeInTheDocument()
		expect(screen.getByText('RD$2,281.82')).toBeInTheDocument()
		expect(screen.getByText('September: RD$2,177.27 · excluding fixed payments')).toBeInTheDocument()
	})

	it('reads in Spanish', () => {
		renderWithIntl(<AnalysisHero report={makeReport()} />, { locale: 'es' })
		expect(screen.getByText('Del 1 al 11 de octubre')).toBeInTheDocument()
		expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
			/^Gastaste RD\$70,100\.00, un 1[.,]7\s?% más que en los mismos días de septiembre\.$/,
		)
	})

	it('says when there is nothing to compare with', () => {
		renderWithIntl(<AnalysisHero report={makeReport({ previous: summary() })} />)
		expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
			'You spent RD$70,100.00. There was no spending in the same days of September to compare with.',
		)
	})

	it('uses plain spend per day and the same period of last year in year mode', () => {
		renderWithIntl(<AnalysisHero report={makeReport({ period: { mode: 'year', year: 2026 } })} />)
		expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('than the same period of 2025.')
		expect(screen.getByText('Spending per day')).toBeInTheDocument()
		expect(screen.getByText('Income this period')).toBeInTheDocument()
	})
})

describe('CategoryChanges', () => {
	it('lists changes biggest first with arrow and sign, plus the unchanged ones', () => {
		renderWithIntl(<CategoryChanges report={makeReport()} />)

		const section = screen.getByRole('region', { name: 'What changed' })
		expect(within(section).getByText('Compared with September 1 – 11')).toBeInTheDocument()
		const rows = within(section).getAllByRole('listitem')
		expect(rows.map((row) => row.textContent)).toEqual([
			expect.stringMatching(/^HealthRD\$0.*▼ -RD\$4,250.*-100%$/),
			expect.stringMatching(/^FoodRD\$12,300.*▲ \+RD\$4,100.*\+50%$/),
			expect.stringMatching(/^TransportRD\$6,800.*▼ -RD\$2,600/),
			expect.stringMatching(/^ServicesRD\$2,800.*▲ \+RD\$2,000/),
			expect.stringMatching(/^EntertainmentRD\$3,200.*▲ \+RD\$1,900/),
		])
		expect(within(section).getByText('No change: Housing.')).toBeInTheDocument()
	})

	it('shows an empty state when nothing changed', () => {
		const same = makeReport({ previous: PREVIOUS, current: PREVIOUS })
		renderWithIntl(<CategoryChanges report={same} />)
		expect(screen.getByText('You spent the same in every category')).toBeInTheDocument()
	})

	it('shows an empty state instead of only "new" rows when there was no spending before', () => {
		renderWithIntl(<CategoryChanges report={makeReport({ previous: summary() })} />)
		expect(screen.getByText('No spending to compare')).toBeInTheDocument()
		expect(screen.queryAllByRole('listitem')).toHaveLength(0)
	})

	it('names the year of the comparison in year mode', () => {
		renderWithIntl(<CategoryChanges report={makeReport({ period: { mode: 'year', year: 2026 } })} />)
		expect(screen.getByText('Compared with January 1 – October 11, 2025')).toBeInTheDocument()
	})
})

describe('BudgetPace', () => {
	it('shows today, status and the estimated close per budget, riskiest first', () => {
		renderWithIntl(<BudgetPace report={makeReport()} />)

		const section = screen.getByRole('region', { name: 'Budget pace' })
		expect(within(section).getByText('Day 11 of 31 · 35% of the month gone')).toBeInTheDocument()
		const rows = within(section).getAllByRole('listitem')
		expect(rows[0]).toHaveTextContent('Entertainment')
		expect(rows[0]).toHaveTextContent('Too fast')
		expect(rows[0]).toHaveTextContent("At this pace you'll close at RD$9,018, RD$4,018 over.")
		expect(rows[1]).toHaveTextContent('At the limit')
		expect(rows[1]).toHaveTextContent('Estimated close RD$34,664: just within.')
		expect(rows[2]).toHaveTextContent('Comfortable')
		expect(rows[2]).toHaveTextContent('Power, Water, and Phone from the plan still to come: estimated close RD$12,691.')
		expect(within(section).getAllByRole('progressbar')).toHaveLength(3)
		expect(within(section).getByRole('link', { name: 'View budgets' })).toHaveAttribute('href', '/app/budget')
	})

	it('is not shown outside month mode (a monthly budget is never compared with a year)', () => {
		const { container } = renderWithIntl(<BudgetPace report={makeReport({ period: { mode: 'year', year: 2026 } })} />)
		expect(container).toBeEmptyDOMElement()
	})

	it('invites to create a budget when there are none', () => {
		renderWithIntl(<BudgetPace report={makeReport({ budgets: [] })} />)
		expect(screen.getByText('No budgets yet')).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Create budget' })).toHaveAttribute('href', '/app/budget?create=1')
	})
})

describe('PlanVsActual', () => {
	it('shows plan bills due vs remaining, the next ones and the fixed/variable split', () => {
		renderWithIntl(<PlanVsActual report={makeReport()} />)

		const section = screen.getByRole('region', { name: 'Your plan vs reality' })
		expect(section).toHaveTextContent('1 of 4 fixed payments already due, for RD$45,000.00. 3 left, for RD$4,800.00.')
		expect(
			within(section).getByText('Next: Power on day 12, Water on day 15, and Phone on day 20.'),
		).toBeInTheDocument()
		expect(within(section).getByRole('img', { name: 'Fixed spending 64%, variable 36%' })).toBeInTheDocument()
		expect(within(section).getByText('Fixed RD$45,000 · 64%')).toBeInTheDocument()
		expect(within(section).getByText('Variable RD$25,100 · 36%')).toBeInTheDocument()
		expect(within(section).getByRole('link', { name: 'Open Monthly Plan' })).toHaveAttribute('href', '/app/monthly')
	})

	it('shows an empty state without plan bills', () => {
		renderWithIntl(<PlanVsActual report={makeReport({ plan: [] })} />)
		expect(screen.getByText('No fixed payments in your plan yet')).toBeInTheDocument()
	})
})

describe('TopExpenses', () => {
	const base = {
		description: '',
		type_transation: TypeTransaction.BILL,
		account_id: 'a1',
		created_at: '2026-10-01T00:00:00Z',
	}
	const expenses: TopExpense[] = [
		{
			...base,
			id: 't1',
			name: 'Rent',
			amount: 45000,
			amountDop: 45000,
			category_id: 'rent',
			fromPlan: true,
			categoryName: 'Housing',
			currency: 'DOP',
		},
		{
			...base,
			id: 't2',
			name: 'Supermarket',
			amount: 6450,
			amountDop: 6450,
			category_id: 'food',
			fromPlan: false,
			categoryName: 'Food',
			currency: 'DOP',
		},
	]

	it('lists the biggest expenses and marks plan payments', () => {
		renderWithIntl(
			<TopExpenses
				expenses={expenses}
				filters={{ date_from: '2026-10-01', date_to: '2026-10-11', account_id: 'a1' }}
			/>,
		)
		const rows = screen.getAllByRole('listitem')
		expect(rows[0]).toHaveTextContent('Rent')
		expect(rows[0]).toHaveTextContent('Housing · from the plan')
		expect(rows[0]).toHaveTextContent('-RD$45,000.00')
		expect(rows[1]).not.toHaveTextContent('from the plan')
		expect(screen.getByRole('link', { name: 'View transactions' })).toHaveAttribute(
			'href',
			'/app/transactions?type=BILL&sortBy=amount&sortOrder=desc&dateFrom=2026-10-01&dateTo=2026-10-11&account=a1',
		)
	})

	it('shows an empty state', () => {
		renderWithIntl(<TopExpenses expenses={[]} filters={{}} />)
		expect(screen.getByText('No expenses in this period')).toBeInTheDocument()
	})
})

describe('MonthlyTrend', () => {
	it('labels months by name, shows savings rates and the month in progress', () => {
		const report = makeReport()
		renderWithIntl(<MonthlyTrend months={report.trend} />)

		const chart = screen.getByRole('img', { name: /Income and expenses by month\. May: income RD\$100,000/ })
		expect(within(chart).getByText('Sep')).toBeInTheDocument()
		expect(within(chart).getByText('31%')).toBeInTheDocument()
		expect(within(chart).getByText('in progress')).toBeInTheDocument()
		expect(screen.queryByText('2026-09')).not.toBeInTheDocument()
		expect(screen.getByText('Under each month, the savings rate. October is in progress.')).toBeInTheDocument()
	})
})

describe('CategoryBreakdown', () => {
	it('is one sorted breakdown with shares', () => {
		const report = makeReport()
		renderWithIntl(<CategoryBreakdown categories={report.categories} current />)

		expect(screen.getByRole('heading', { name: "Where this month's money went" })).toBeInTheDocument()
		const bars = screen.getAllByRole('progressbar')
		expect(bars.map((bar) => bar.getAttribute('aria-label'))).toEqual([
			'Housing: RD$45,000, 64% of spending',
			'Food: RD$12,300, 18% of spending',
			'Transport: RD$6,800, 10% of spending',
			'Entertainment: RD$3,200, 5% of spending',
			'Services: RD$2,800, 4% of spending',
		])
	})
})
