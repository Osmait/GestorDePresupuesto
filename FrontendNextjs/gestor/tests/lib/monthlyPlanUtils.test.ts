import { describe, expect, it } from 'vitest'
import {
	daysInMonth,
	effectiveDay,
	groupPlanItems,
	localToday,
	matchesSearch,
	projectMonthFlow,
	shareOfTotal,
	signedDop,
	startingBalanceDop,
	sumActiveDop,
	weekOfDay,
	weekRanges,
} from '@/lib/monthlyPlanUtils'
import type { Account } from '@/types/account'
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

function makeAccount(overrides: Partial<Account> = {}): Account {
	return {
		id: 'a1',
		name: 'Main',
		bank: 'Bank',
		initial_balance: 0,
		user_id: 'u1',
		created_at: '',
		...overrides,
	}
}

// October 2026 (31 days) and the 11th, like the design.
const OCT_11 = { year: 2026, month: 9, day: 11 }

describe('sumActiveDop / shareOfTotal / signedDop', () => {
	it('sums only active items', () => {
		const items = [makeItem({ amount_dop: 1000 }), makeItem({ id: '2', amount_dop: 9999, is_active: false })]
		expect(sumActiveDop(items)).toBe(1000)
		expect(sumActiveDop([])).toBe(0)
	})

	it('returns 0 instead of NaN for an empty total', () => {
		expect(shareOfTotal(25, 100)).toBe(25)
		expect(shareOfTotal(25, 0)).toBe(0)
		expect(shareOfTotal(25, -1)).toBe(0)
	})

	it('signs incomes positive and expenses negative', () => {
		expect(signedDop(makeItem({ type: 'income', amount_dop: 50 }))).toBe(50)
		expect(signedDop(makeItem({ amount_dop: 50 }))).toBe(-50)
	})
})

describe('calendar helpers', () => {
	it('knows the length of every month', () => {
		expect(daysInMonth(2026, 9)).toBe(31)
		expect(daysInMonth(2026, 10)).toBe(30)
		expect(daysInMonth(2026, 1)).toBe(28)
		expect(daysInMonth(2028, 1)).toBe(29)
	})

	it('clamps day 31 to the last day of a shorter month', () => {
		expect(effectiveDay(31, 30)).toBe(30)
		expect(effectiveDay(30, 28)).toBe(28)
		expect(effectiveDay(15, 30)).toBe(15)
		expect(effectiveDay(undefined, 30)).toBeNull()
		expect(effectiveDay(0, 30)).toBeNull()
	})

	it('reads today from the local date', () => {
		expect(localToday(new Date(2026, 9, 11, 23, 59))).toEqual(OCT_11)
	})

	it('splits the month into 1–7, 8–15, 16–23 and 24–end', () => {
		expect(weekRanges(30).map((week) => [week.from, week.to])).toEqual([
			[1, 7],
			[8, 15],
			[16, 23],
			[24, 30],
		])
		expect([1, 7, 8, 15, 16, 23, 24, 31].map(weekOfDay)).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
	})
})

describe('matchesSearch', () => {
	it('matches by name, ignoring case and accents', () => {
		expect(matchesSearch({ name: 'Colegio de Educación' }, 'educacion')).toBe(true)
		expect(matchesSearch({ name: 'Netflix' }, 'NET')).toBe(true)
		expect(matchesSearch({ name: 'Netflix' }, 'spotify')).toBe(false)
		expect(matchesSearch({ name: 'Netflix' }, '   ')).toBe(true)
	})
})

describe('groupPlanItems', () => {
	const items = [
		makeItem({ id: 'salary', name: 'Salario', type: 'income', amount_dop: 100000, day_of_month: 30 }),
		makeItem({ id: 'rent', name: 'Alquiler', category_id: 'home', amount_dop: 30000, day_of_month: 1 }),
		makeItem({ id: 'condo', name: 'Condominio', category_id: 'home', amount_dop: 5000, day_of_month: 5 }),
		makeItem({ id: 'gas', name: 'Gasolina', category_id: 'car', amount_dop: 9000 }),
		makeItem({ id: 'netflix', name: 'Netflix', amount_dop: 1000, day_of_month: 31 }),
		makeItem({ id: 'gym', name: 'Gym', category_id: 'car', amount_dop: 50000, day_of_month: 10, is_active: false }),
	]
	const options = { monthDays: 30, totalExpenses: 45000 }

	it('groups by category: income first, then expense categories by active total', () => {
		const groups = groupPlanItems(items, 'category', options)

		expect(groups.map((group) => group.key)).toEqual(['income', 'category:home', 'category:car', 'category:none'])
		expect(groups[1].items.map((item) => item.id)).toEqual(['rent', 'condo'])
		expect(groups[1].subtotal).toBe(-35000)
		expect(groups[1].expenseShare).toBeCloseTo((35000 / 45000) * 100)
		// The paused gym is listed but neither counts in the subtotal nor in the share.
		expect(groups[2].items.map((item) => item.id)).toEqual(['gym', 'gas'])
		expect(groups[2].subtotal).toBe(-9000)
		expect(groups[0].subtotal).toBe(100000)
	})

	it('groups by week, clamping day 31 into the last week of a 30-day month', () => {
		const groups = groupPlanItems(items, 'week', options)

		expect(groups.map((group) => group.key)).toEqual(['week-1', 'week-2', 'week-4', 'week-none'])
		expect(groups[2].week).toEqual({ index: 4, from: 24, to: 30 })
		expect(groups[2].items.map((item) => item.id)).toEqual(['netflix', 'salary'])
		expect(groups[3].items.map((item) => item.id)).toEqual(['gas'])
		expect(groups[3].kind).toBe('noDay')
	})

	it('keeps everything in one group sorted by day, undated last', () => {
		const groups = groupPlanItems(items, 'none', options)

		expect(groups).toHaveLength(1)
		expect(groups[0].items.map((item) => item.id)).toEqual(['rent', 'condo', 'gym', 'netflix', 'salary', 'gas'])
		expect(groups[0].subtotal).toBe(100000 - 45000)
	})

	it('returns no groups for no items', () => {
		expect(groupPlanItems([], 'category', options)).toEqual([])
	})
})

describe('projectMonthFlow', () => {
	it('starts from the balance of today, not from zero', () => {
		const flow = projectMonthFlow([makeItem({ day_of_month: 20, amount_dop: 5000 })], 85000, OCT_11)

		expect(flow.start).toBe(85000)
		expect(flow.points[0]).toEqual({ day: 11, balance: 85000 })
		expect(flow.end).toBe(80000)
		expect(flow.points).toHaveLength(31 - 11 + 1)
	})

	it('applies only active items still to come (after today)', () => {
		const items = [
			makeItem({ id: 'past', day_of_month: 5, amount_dop: 1000 }),
			makeItem({ id: 'today', day_of_month: 11, amount_dop: 1000 }),
			makeItem({ id: 'paused', day_of_month: 15, amount_dop: 1000, is_active: false }),
			makeItem({ id: 'future', day_of_month: 12, amount_dop: 1000 }),
		]

		const flow = projectMonthFlow(items, 10000, OCT_11)

		expect(flow.events.map((event) => event.item.id)).toEqual(['future'])
		expect(flow.end).toBe(9000)
	})

	it('clamps day 31 to the 30th in a 30-day month', () => {
		const flow = projectMonthFlow(
			[makeItem({ day_of_month: 31, amount_dop: 2000 })],
			10000,
			{ year: 2026, month: 10, day: 20 }, // November
		)

		expect(flow.monthDays).toBe(30)
		expect(flow.events[0].day).toBe(30)
		expect(flow.points.at(-1)).toEqual({ day: 30, balance: 8000 })
	})

	it('subtracts items without a fixed day at the end of the month', () => {
		const flow = projectMonthFlow([makeItem({ amount_dop: 22000 })], 50000, OCT_11)

		expect(flow.noDayTotal).toBe(-22000)
		expect(flow.points.find((point) => point.day === 30)?.balance).toBe(50000)
		expect(flow.end).toBe(28000)
	})

	it('still applies undated items when today is the last day', () => {
		const flow = projectMonthFlow([makeItem({ amount_dop: 1000 })], 5000, { year: 2026, month: 9, day: 31 })

		expect(flow.start).toBe(5000)
		expect(flow.end).toBe(4000)
	})

	it('finds the lowest point and the next income after it', () => {
		const items = [
			makeItem({ id: 'light', name: 'Luz', day_of_month: 12, amount_dop: 4800 }),
			makeItem({ id: 'netflix', name: 'Netflix', day_of_month: 14, amount_dop: 938 }),
			makeItem({ id: 'salary', name: 'Salario', type: 'income', day_of_month: 15, amount_dop: 88000 }),
			makeItem({ id: 'freelance', name: 'Freelance', type: 'income', day_of_month: 20, amount_dop: 50000 }),
		]

		const flow = projectMonthFlow(items, 85000, OCT_11)

		expect(flow.low).toEqual({ day: 14, balance: 85000 - 4800 - 938 })
		expect(flow.nextIncome?.item.id).toBe('salary')
		expect(flow.firstNegative).toBeNull()
	})

	it('flags the first day the balance goes negative', () => {
		const items = [
			makeItem({ day_of_month: 13, amount_dop: 15000 }),
			makeItem({ id: 'salary', type: 'income', day_of_month: 25, amount_dop: 40000 }),
		]

		const flow = projectMonthFlow(items, 10000, OCT_11)

		expect(flow.firstNegative).toEqual({ day: 13, balance: -5000 })
		expect(flow.low.balance).toBe(-5000)
		expect(flow.nextIncome?.day).toBe(25)
	})

	it('keeps the low point at today (earliest) when nothing goes out', () => {
		const flow = projectMonthFlow([makeItem({ type: 'income', day_of_month: 20 })], 1000, OCT_11)

		expect(flow.low.day).toBe(11)
	})

	it('lists the next 7 days with their totals', () => {
		const items = [
			makeItem({ id: 'a', day_of_month: 12, amount_dop: 100 }),
			makeItem({ id: 'b', type: 'income', day_of_month: 18, amount_dop: 500 }),
			makeItem({ id: 'c', day_of_month: 19, amount_dop: 999 }),
		]

		const flow = projectMonthFlow(items, 0, OCT_11)

		expect(flow.upcomingTo).toBe(18)
		expect(flow.upcoming.map((event) => event.item.id)).toEqual(['a', 'b'])
		expect(flow.upcomingIn).toBe(500)
		expect(flow.upcomingOut).toBe(100)
	})
})

describe('startingBalanceDop', () => {
	it('sums the current balance of money accounts, leaving credit cards out', () => {
		const accounts = [
			makeAccount({ current_balance: 50000 }),
			makeAccount({ id: 'a2', current_balance: 35000 }),
			makeAccount({ id: 'card', type: 'credit_card', current_balance: -12000 }),
		]
		expect(startingBalanceDop(accounts, 60)).toBe(85000)
	})

	it('converts USD accounts and falls back to the initial balance', () => {
		const accounts = [makeAccount({ currency: 'USD', current_balance: 100 }), makeAccount({ initial_balance: 500 })]
		expect(startingBalanceDop(accounts, 60)).toBe(6500)
	})
})
