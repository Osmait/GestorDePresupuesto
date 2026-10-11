import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MonthlyPlanFlowCard } from '@/components/monthly/MonthlyPlanFlowCard'
import { buildFlowChartGeometry } from '@/components/monthly/MonthlyPlanFlowChart'
import { projectMonthFlow } from '@/lib/monthlyPlanUtils'
import { renderWithIntl } from '@/tests/utils/intl'
import { MonthlyPlanItem } from '@/types/monthlyPlan'

function makeItem(overrides: Partial<MonthlyPlanItem> = {}): MonthlyPlanItem {
	return {
		id: 'id-1',
		user_id: 'u1',
		name: 'Item',
		description: '',
		amount: 1000,
		amount_dop: 1000,
		currency: 'DOP',
		type: 'bill',
		is_active: true,
		created_at: '2026-07-01T00:00:00Z',
		...overrides,
	}
}

const TODAY = { year: 2026, month: 9, day: 11 }

const ITEMS = [
	makeItem({ id: 'light', name: 'Electricity', amount_dop: 4800, day_of_month: 12 }),
	makeItem({ id: 'netflix', name: 'Netflix', amount_dop: 1000, day_of_month: 14 }),
	makeItem({ id: 'salary', name: 'Salary', type: 'income', amount_dop: 88000, day_of_month: 15 }),
	makeItem({ id: 'water', name: 'Water', amount_dop: 650, day_of_month: 15 }),
	makeItem({ id: 'phone', name: 'Phone', amount_dop: 1850, day_of_month: 16 }),
	makeItem({ id: 'internet', name: 'Internet', amount_dop: 2900, day_of_month: 17 }),
	makeItem({ id: 'rent', name: 'Rent', amount_dop: 38000, day_of_month: 1 }),
	makeItem({ id: 'groceries', name: 'Groceries', amount_dop: 22000 }),
]

describe('MonthlyPlanFlowCard', () => {
	it('starts from the balance of today and projects the close of the month', () => {
		renderWithIntl(<MonthlyPlanFlowCard items={ITEMS} today={TODAY} startBalance={85000} />)

		expect(screen.getByText("October 11 to 31, from today's balance")).toBeInTheDocument()
		expect(screen.getByTestId('flow-start')).toHaveTextContent('RD$85,000.00')
		// 85,000 − 4,800 − 1,000 + 88,000 − 650 − 1,850 − 2,900 − 22,000 (undated); rent on the 1st already happened.
		expect(screen.getByTestId('flow-end')).toHaveTextContent('RD$139,800.00')
	})

	it('describes the chart for screen readers', () => {
		renderWithIntl(<MonthlyPlanFlowCard items={ITEMS} today={TODAY} startBalance={85000} />)

		expect(
			screen.getByRole('img', {
				name: 'Projected balance from day 11 to day 31: starts at RD$85,000.00, drops to RD$79,200.00 on day 14 and closes at RD$139,800.00.',
			}),
		).toBeInTheDocument()
	})

	it('names the lowest point, the next income and the undated items', () => {
		renderWithIntl(<MonthlyPlanFlowCard items={ITEMS} today={TODAY} startBalance={85000} />)

		expect(screen.getByTestId('flow-insight')).toHaveTextContent(
			'Your lowest balance will be RD$79,200.00 on October 14. The next income arrives on October 15 (Salary). Items without a fixed day (-RD$22,000.00) are applied at month end.',
		)
	})

	it('warns when the balance goes negative', () => {
		renderWithIntl(<MonthlyPlanFlowCard items={ITEMS} today={TODAY} startBalance={1000} />)

		expect(screen.getByTestId('flow-insight')).toHaveTextContent(
			'Your balance goes negative on October 12 and reaches -RD$4,800.00 on October 14.',
		)
	})

	it('lists the next 7 days with their totals, 4 at a time on mobile', async () => {
		const user = userEvent.setup()
		renderWithIntl(<MonthlyPlanFlowCard items={ITEMS} today={TODAY} startBalance={85000} />)

		const list = screen.getByTestId('flow-upcoming')
		const rows = within(list).getAllByRole('listitem')
		expect(rows.map((row) => row.textContent)).toEqual([
			'Oct 12Electricity-RD$4,800.00',
			'Oct 14Netflix-RD$1,000.00',
			'Oct 15Salary+RD$88,000.00',
			'Oct 15Water-RD$650.00',
			'Oct 16Phone-RD$1,850.00',
			'Oct 17Internet-RD$2,900.00',
		])
		expect(rows[4]).toHaveClass('hidden')
		expect(
			screen.getByText('RD$11,200.00 goes out and RD$88,000.00 comes in from Oct 12 to Oct 18.'),
		).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: 'See the next 7 days' }))
		expect(rows[4]).not.toHaveClass('hidden')
	})

	it('shows a skeleton while the balance loads and an error with retry when it fails', async () => {
		const user = userEvent.setup()
		const onRetry = vi.fn()
		const { unmount } = renderWithIntl(<MonthlyPlanFlowCard items={ITEMS} today={TODAY} startBalance={null} loading />)
		expect(screen.queryByTestId('flow-start')).not.toBeInTheDocument()
		unmount()

		renderWithIntl(<MonthlyPlanFlowCard items={ITEMS} today={TODAY} startBalance={null} error onRetry={onRetry} />)
		expect(screen.getByText("Couldn't project the month")).toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'Try again' }))
		expect(onRetry).toHaveBeenCalled()
	})
})

describe('buildFlowChartGeometry', () => {
	it('draws a step line from today to the last day with income dots and the low marker', () => {
		const flow = projectMonthFlow(ITEMS, 85000, TODAY)
		const geometry = buildFlowChartGeometry(flow)

		expect(geometry.line.startsWith('M0 ')).toBe(true)
		expect(geometry.line).toContain('H300')
		expect(geometry.incomeDots.map((dot) => dot.day)).toEqual([15])
		expect(geometry.low.x).toBe(45) // day 14 of a 20-day span
		expect(geometry.ticks.map((tick) => tick.day)).toEqual([11, 15, 20, 25, 31])
		expect(geometry.zeroY).toBeNull()
	})

	it('adds a zero line when the projection dips below zero', () => {
		const geometry = buildFlowChartGeometry(projectMonthFlow(ITEMS, 1000, TODAY))
		expect(geometry.zeroY).not.toBeNull()
	})
})
