import { describe, expect, it } from 'vitest'
import { buildTimeline, groupByCategory, runningBalance, shareOfTotal, sumActiveDop } from '@/lib/monthlyPlanUtils'
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

describe('sumActiveDop', () => {
	it('sums the DOP amounts of active items', () => {
		const items = [makeItem({ amount_dop: 1000 }), makeItem({ id: '2', amount_dop: 2500 })]
		expect(sumActiveDop(items)).toBe(3500)
	})

	it('excludes paused items so the total matches the backend', () => {
		const items = [makeItem({ amount_dop: 1000 }), makeItem({ id: '2', amount_dop: 9999, is_active: false })]
		expect(sumActiveDop(items)).toBe(1000)
	})

	it('returns 0 for an empty plan', () => {
		expect(sumActiveDop([])).toBe(0)
	})
})

describe('shareOfTotal', () => {
	it('returns the percentage of the total', () => {
		expect(shareOfTotal(25, 100)).toBe(25)
	})

	it('returns 0 instead of NaN when the total is zero', () => {
		expect(shareOfTotal(25, 0)).toBe(0)
	})

	it('returns 0 for a negative total', () => {
		expect(shareOfTotal(25, -100)).toBe(0)
	})
})

describe('groupByCategory', () => {
	const names = new Map([
		['cat-food', 'Comida'],
		['cat-transport', 'Transporte'],
	])

	it('groups active items and sorts them biggest first', () => {
		const items = [
			makeItem({ id: '1', category_id: 'cat-transport', amount_dop: 1000 }),
			makeItem({ id: '2', category_id: 'cat-food', amount_dop: 3000 }),
		]

		const result = groupByCategory(items, names, 'No category')

		expect(result.map((share) => share.label)).toEqual(['Comida', 'Transporte'])
		expect(result[0].percentage).toBe(75)
		expect(result[1].percentage).toBe(25)
	})

	it('merges several items of the same category into one bucket', () => {
		const items = [
			makeItem({ id: '1', category_id: 'cat-food', amount_dop: 1000 }),
			makeItem({ id: '2', category_id: 'cat-food', amount_dop: 3000 }),
		]

		const result = groupByCategory(items, names, 'No category')

		expect(result).toHaveLength(1)
		expect(result[0].amount).toBe(4000)
		expect(result[0].percentage).toBe(100)
	})

	it('labels items without a category', () => {
		const result = groupByCategory([makeItem({ amount_dop: 500 })], names, 'No category')

		expect(result[0].label).toBe('No category')
		expect(result[0].categoryId).toBe('')
	})

	it('falls back to the placeholder when the category id is unknown', () => {
		const result = groupByCategory([makeItem({ category_id: 'deleted-cat' })], names, 'No category')

		expect(result[0].label).toBe('No category')
	})

	it('ignores paused items', () => {
		const items = [
			makeItem({ id: '1', category_id: 'cat-food', amount_dop: 1000 }),
			makeItem({ id: '2', category_id: 'cat-transport', amount_dop: 5000, is_active: false }),
		]

		const result = groupByCategory(items, names, 'No category')

		expect(result).toHaveLength(1)
		expect(result[0].label).toBe('Comida')
	})

	it('returns an empty list for an empty plan', () => {
		expect(groupByCategory([], names, 'No category')).toEqual([])
	})
})

describe('buildTimeline', () => {
	it('buckets items by day and sorts chronologically', () => {
		const items = [
			makeItem({ id: '1', day_of_month: 15, amount_dop: 2200 }),
			makeItem({ id: '2', day_of_month: 1, amount_dop: 25000 }),
			makeItem({ id: '3', day_of_month: 30, type: 'income', amount_dop: 85000 }),
		]

		const timeline = buildTimeline(items)

		expect(timeline.map((entry) => entry.day)).toEqual([1, 15, 30])
		expect(timeline[0].expenseTotal).toBe(25000)
		expect(timeline[2].incomeTotal).toBe(85000)
	})

	it('adds up several items falling on the same day', () => {
		const items = [
			makeItem({ id: '1', day_of_month: 1, amount_dop: 25000 }),
			makeItem({ id: '2', day_of_month: 1, amount_dop: 2000 }),
			makeItem({ id: '3', day_of_month: 1, type: 'income', amount_dop: 50000 }),
		]

		const timeline = buildTimeline(items)

		expect(timeline).toHaveLength(1)
		expect(timeline[0].expenseTotal).toBe(27000)
		expect(timeline[0].incomeTotal).toBe(50000)
		expect(timeline[0].items).toHaveLength(3)
	})

	it('leaves out items with no fixed day', () => {
		const items = [makeItem({ id: '1', day_of_month: 5 }), makeItem({ id: '2' })]

		const timeline = buildTimeline(items)

		expect(timeline).toHaveLength(1)
		expect(timeline[0].day).toBe(5)
	})

	it('leaves out paused items', () => {
		const items = [makeItem({ id: '1', day_of_month: 5, is_active: false })]
		expect(buildTimeline(items)).toEqual([])
	})
})

describe('runningBalance', () => {
	it('accumulates income minus expenses day by day', () => {
		const items = [
			makeItem({ id: '1', day_of_month: 1, type: 'income', amount_dop: 10000 }),
			makeItem({ id: '2', day_of_month: 10, amount_dop: 4000 }),
			makeItem({ id: '3', day_of_month: 20, amount_dop: 1000 }),
		]

		expect(runningBalance(buildTimeline(items))).toEqual([
			{ day: 1, balance: 10000 },
			{ day: 10, balance: 6000 },
			{ day: 20, balance: 5000 },
		])
	})

	// This is the cash-flow gap the timeline exists to surface: the month adds up
	// overall, but rent falls due before the salary lands.
	it('goes negative when an expense falls due before the income that covers it', () => {
		const items = [
			makeItem({ id: 'rent', day_of_month: 1, amount_dop: 25000 }),
			makeItem({ id: 'salary', day_of_month: 30, type: 'income', amount_dop: 85000 }),
		]

		const balances = runningBalance(buildTimeline(items))

		expect(balances[0]).toEqual({ day: 1, balance: -25000 })
		expect(balances[1]).toEqual({ day: 30, balance: 60000 })
	})

	it('returns an empty list for an empty timeline', () => {
		expect(runningBalance([])).toEqual([])
	})
})
