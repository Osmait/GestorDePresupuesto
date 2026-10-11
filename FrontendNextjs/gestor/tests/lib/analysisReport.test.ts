import { describe, expect, it } from 'vitest'
import {
	buildMonthlyTrend,
	canStepForward,
	computeCategoryChanges,
	estimateMonthClose,
	fromApiDate,
	matchesPlanItem,
	nextIncomeDay,
	paceStatus,
	parsePeriodParam,
	percentDelta,
	pickTopExpenses,
	planDueDay,
	resolvePeriod,
	roundDeep,
	roundMoney,
	savingsRate,
	savingsSeries,
	serializePeriod,
	splitFixedVariable,
	splitFixedVariableByCategory,
	splitPlanByDay,
	stepPeriod,
	toApiDate,
	trendRange,
} from '@/lib/analysisReport'
import type { CategoryExpense } from '@/types/analytics'
import type { MonthlyPlanItem } from '@/types/monthlyPlan'

const day = (value: string) => fromApiDate(value) as Date
const range = (r: { from: Date; to: Date }) => [toApiDate(r.from), toApiDate(r.to)]

function planItem(overrides: Partial<MonthlyPlanItem> = {}): MonthlyPlanItem {
	return {
		id: 'p1',
		user_id: 'u1',
		name: 'Alquiler',
		description: '',
		amount: 1000,
		amount_dop: 1000,
		currency: 'DOP',
		type: 'bill',
		is_active: true,
		created_at: '2026-01-01T00:00:00Z',
		...overrides,
	}
}

function category(id: string, value: number, label = id): CategoryExpense {
	return { id, label, value, color: '#000', transaction_count: 1, dop_total: value, usd_total: 0 }
}

describe('period param', () => {
	const today = day('2026-10-11')

	it('defaults to the current month', () => {
		expect(parsePeriodParam(null, today)).toEqual({ mode: 'month', year: 2026, month: 10 })
		expect(parsePeriodParam('garbage', today)).toEqual({ mode: 'month', year: 2026, month: 10 })
	})

	it('reads month, year and range', () => {
		expect(parsePeriodParam('2026-09', today)).toEqual({ mode: 'month', year: 2026, month: 9 })
		expect(parsePeriodParam('2025', today)).toEqual({ mode: 'year', year: 2025 })
		expect(parsePeriodParam('2026-01-05..2026-03-10', today)).toEqual({
			mode: 'range',
			from: '2026-01-05',
			to: '2026-03-10',
		})
	})

	it('swaps an inverted range and rejects impossible dates or the future', () => {
		expect(parsePeriodParam('2026-03-10..2026-01-05', today)).toMatchObject({ from: '2026-01-05', to: '2026-03-10' })
		expect(parsePeriodParam('2026-02-30..2026-03-01', today).mode).toBe('month')
		expect(parsePeriodParam('2026-11', today)).toEqual({ mode: 'month', year: 2026, month: 10 })
		expect(parsePeriodParam('2027', today).mode).toBe('month')
		expect(parsePeriodParam('2026-13', today).mode).toBe('month')
	})

	it('round-trips through serializePeriod', () => {
		for (const value of ['2026-09', '2025', '2026-01-05..2026-03-10']) {
			expect(serializePeriod(parsePeriodParam(value, today))).toBe(value)
		}
	})

	it('steps months across the year boundary and never into the future', () => {
		expect(stepPeriod({ mode: 'month', year: 2026, month: 1 }, -1)).toEqual({ mode: 'month', year: 2025, month: 12 })
		expect(stepPeriod({ mode: 'month', year: 2025, month: 12 }, 1)).toEqual({ mode: 'month', year: 2026, month: 1 })
		expect(canStepForward({ mode: 'month', year: 2026, month: 10 }, today)).toBe(false)
		expect(canStepForward({ mode: 'month', year: 2026, month: 9 }, today)).toBe(true)
		expect(canStepForward({ mode: 'year', year: 2026 }, today)).toBe(false)
		expect(canStepForward({ mode: 'year', year: 2025 }, today)).toBe(true)
	})
})

describe('resolvePeriod (fair comparison)', () => {
	it('current month: 1..today vs 1..today of the previous month', () => {
		const r = resolvePeriod({ mode: 'month', year: 2026, month: 10 }, day('2026-10-11'))
		expect(r.inProgress).toBe(true)
		expect(range(r.range)).toEqual(['2026-10-01', '2026-10-11'])
		expect(range(r.comparison)).toEqual(['2026-09-01', '2026-09-11'])
		expect(r.elapsedDays).toBe(11)
		expect(r.comparisonDays).toBe(11)
	})

	it('clamps to the shorter previous month (Mar 31 → Feb 28, leap Feb 29)', () => {
		const r = resolvePeriod({ mode: 'month', year: 2026, month: 3 }, day('2026-03-31'))
		expect(range(r.comparison)).toEqual(['2026-02-01', '2026-02-28'])
		const leap = resolvePeriod({ mode: 'month', year: 2028, month: 3 }, day('2028-03-30'))
		expect(range(leap.comparison)).toEqual(['2028-02-01', '2028-02-29'])
	})

	it('January compares with December of the previous year', () => {
		const r = resolvePeriod({ mode: 'month', year: 2026, month: 1 }, day('2026-01-15'))
		expect(range(r.comparison)).toEqual(['2025-12-01', '2025-12-15'])
		const past = resolvePeriod({ mode: 'month', year: 2026, month: 1 }, day('2026-10-11'))
		expect(range(past.comparison)).toEqual(['2025-12-01', '2025-12-31'])
	})

	it('past month: full month vs full previous month', () => {
		const r = resolvePeriod({ mode: 'month', year: 2024, month: 3 }, day('2026-10-11'))
		expect(r.inProgress).toBe(false)
		expect(range(r.range)).toEqual(['2024-03-01', '2024-03-31'])
		expect(range(r.comparison)).toEqual(['2024-02-01', '2024-02-29'])
		expect(r.elapsedDays).toBe(31)
		expect(r.comparisonDays).toBe(29)
	})

	it('year in progress: Jan 1..today vs the same dates a year earlier (Feb 29 → Feb 28)', () => {
		const r = resolvePeriod({ mode: 'year', year: 2028 }, day('2028-02-29'))
		expect(range(r.range)).toEqual(['2028-01-01', '2028-02-29'])
		expect(range(r.comparison)).toEqual(['2027-01-01', '2027-02-28'])
		const past = resolvePeriod({ mode: 'year', year: 2025 }, day('2026-10-11'))
		expect(range(past.comparison)).toEqual(['2024-01-01', '2024-12-31'])
	})

	it('range: cut at today and compared with the same number of days before', () => {
		const r = resolvePeriod({ mode: 'range', from: '2026-10-01', to: '2026-10-31' }, day('2026-10-11'))
		expect(range(r.range)).toEqual(['2026-10-01', '2026-10-11'])
		expect(range(r.comparison)).toEqual(['2026-09-20', '2026-09-30'])
		const past = resolvePeriod({ mode: 'range', from: '2026-03-01', to: '2026-03-10' }, day('2026-10-11'))
		expect(range(past.comparison)).toEqual(['2026-02-19', '2026-02-28'])
	})

	it('trend covers the six months ending with the period', () => {
		const r = resolvePeriod({ mode: 'month', year: 2026, month: 2 }, day('2026-10-11'))
		expect(range(trendRange(r))).toEqual(['2025-09-01', '2026-02-28'])
	})
})

describe('ratios', () => {
	it('percentDelta is null without a previous value', () => {
		expect(percentDelta(110, 100)).toBeCloseTo(10)
		expect(percentDelta(50, 100)).toBeCloseTo(-50)
		expect(percentDelta(10, 0)).toBeNull()
	})

	it('savingsRate is null without income', () => {
		expect(savingsRate(1000, 750)).toBe(25)
		expect(savingsRate(0, 100)).toBeNull()
	})

	it('roundMoney / roundDeep remove float noise', () => {
		expect(roundMoney(0.1 + 0.2)).toBe(0.3)
		expect(Object.is(roundMoney(-0.001), 0)).toBe(true)
		expect(roundDeep({ a: 1234.5600000000002, b: [0.1 + 0.2], c: 'x', d: null })).toEqual({
			a: 1234.56,
			b: [0.3],
			c: 'x',
			d: null,
		})
	})
})

describe('fixed vs variable', () => {
	const bills = [
		planItem({ id: 'a', name: 'Alquiler', amount_dop: 38000, day_of_month: 1 }),
		planItem({ id: 'b', name: 'Luz', amount_dop: 3000, day_of_month: 12 }),
		planItem({ id: 'c', name: 'Netflix', amount_dop: 500, day_of_month: 31 }),
		planItem({ id: 'd', name: 'Seguro', amount_dop: 7000 }),
	]

	it('clamps due days to the month and treats a missing day as the last one', () => {
		expect(planDueDay({ day_of_month: 31 }, 2026, 2)).toBe(28)
		expect(planDueDay({ day_of_month: 31 }, 2028, 2)).toBe(29)
		expect(planDueDay({}, 2026, 9)).toBe(30)
	})

	it('splits the plan by day', () => {
		const split = splitPlanByDay(bills, 2026, 10, 11)
		expect(split.due.map((item) => item.id)).toEqual(['a'])
		expect(split.remaining.map((item) => item.id)).toEqual(['b', 'c', 'd'])
		expect(split.dueAmount).toBe(38000)
		expect(split.remainingAmount).toBe(10500)
		expect(splitPlanByDay(bills, 2026, 2, 28).due).toHaveLength(4)
	})

	it('fixed never exceeds what was spent', () => {
		expect(splitFixedVariable(50000, 38000)).toEqual({ fixed: 38000, variable: 12000 })
		expect(splitFixedVariable(20000, 38000)).toEqual({ fixed: 20000, variable: 0 })
		expect(splitFixedVariable(0, 0)).toEqual({ fixed: 0, variable: 0 })
	})

	it('caps the fixed part per category, so an unpaid bill does not hide variable spending', () => {
		const due = [
			planItem({ id: 'rent', amount_dop: 38000, category_id: 'home' }),
			planItem({ id: 'power', amount_dop: 4800, category_id: 'services' }),
			planItem({ id: 'misc', amount_dop: 1000 }),
		]
		const spent = [
			{ id: 'home', value: 38000 },
			{ id: 'food', value: -9000 },
			{ id: 'services', value: 1200 },
		]
		// home 38000 + services capped at 1200 + uncategorized 1000 out of what is left; food stays variable.
		expect(splitFixedVariableByCategory(48200, spent, due)).toEqual({ fixed: 40200, variable: 8000 })
		// Nothing recorded in the bills' categories: everything is variable.
		expect(splitFixedVariableByCategory(9000, [{ id: 'food', value: 9000 }], due.slice(0, 2))).toEqual({
			fixed: 0,
			variable: 9000,
		})
		expect(splitFixedVariableByCategory(0, [], due)).toEqual({ fixed: 0, variable: 0 })
	})

	it('finds the next income day after today', () => {
		const income = [planItem({ type: 'income', day_of_month: 15 }), planItem({ type: 'income', day_of_month: 30 })]
		expect(nextIncomeDay(income, 2026, 10, 11)).toBe(15)
		expect(nextIncomeDay(income, 2026, 10, 15)).toBe(30)
		expect(nextIncomeDay(income, 2026, 10, 30)).toBeNull()
	})
})

describe('budget pace', () => {
	it('adds remaining plan bills and the variable pace', () => {
		// 3,200 spent by day 11 of 31, no plan bills: 3,200 / 11 × 20 more days.
		expect(estimateMonthClose({ spent: 3200, day: 11, daysInMonth: 31, planDue: 0, planRemaining: 0 })).toBeCloseTo(
			3200 + (3200 / 11) * 20,
			2,
		)
		// 2,900 spent, all of it the plan bill already due; 22,300 of plan bills still to come.
		expect(estimateMonthClose({ spent: 2900, day: 11, daysInMonth: 31, planDue: 2900, planRemaining: 22300 })).toBe(
			25200,
		)
	})

	it('a finished month closes at what was spent', () => {
		expect(estimateMonthClose({ spent: 5000, day: 30, daysInMonth: 30, planDue: 0, planRemaining: 999 })).toBe(5000)
	})

	it('classifies the pace', () => {
		expect(paceStatus(6000, 9000, 5000)).toBe('over')
		expect(paceStatus(3200, 9018, 5000)).toBe('fast')
		expect(paceStatus(12300, 34663, 35000)).toBe('tight')
		expect(paceStatus(2900, 25200, 30000)).toBe('ok')
		expect(paceStatus(0, 0, 0)).toBe('ok')
	})
})

describe('category changes', () => {
	it('sorts by the size of the change and lists unchanged categories', () => {
		const { changed, unchanged } = computeCategoryChanges(
			[category('food', 12300), category('transport', 6800), category('rent', 45000), category('fun', 3200)],
			[category('food', 8200), category('transport', 9400), category('rent', 45000), category('health', 4250)],
		)
		expect(changed.map((change) => [change.id, change.delta])).toEqual([
			['health', -4250],
			['food', 4100],
			['fun', 3200],
			['transport', -2600],
		])
		expect(changed.find((change) => change.id === 'fun')?.percent).toBeNull()
		expect(changed.find((change) => change.id === 'food')?.percent).toBeCloseTo(50, 0)
		expect(unchanged.map((change) => change.id)).toEqual(['rent'])
	})
})

describe('trend and savings', () => {
	const today = day('2026-10-11')
	const summary = [
		{ month: '2026-05', Ingresos: 1000, Gastos: -800 },
		{ month: '2026-06', Ingresos: 1000, Gastos: 700 },
		{ month: '2026-08', Ingresos: 1000, Gastos: 900 },
		{ month: '2026-09', Ingresos: 2000, Gastos: 1000 },
		{ month: '2026-10', Ingresos: 0, Gastos: 400 },
	]

	it('fills missing months and flags the one in progress', () => {
		const trend = buildMonthlyTrend(summary, { year: 2026, month: 10 }, today)
		expect(trend.map((month) => month.key)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
		expect(trend[0].expenses).toBe(800)
		expect(trend[2]).toMatchObject({ income: 0, expenses: 0, savingsRate: null })
		expect(trend[5].inProgress).toBe(true)
	})

	it('uses the last complete months for the savings rate', () => {
		const trend = buildMonthlyTrend(summary, { year: 2026, month: 10 }, today)
		const series = savingsSeries(trend)
		expect(series.last?.key).toBe('2026-09')
		expect(series.last?.savingsRate).toBe(50)
		expect(series.months.map((month) => month.key)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
		// May 20%, June 30%, Aug 10%, Sep 50% (July has no income).
		expect(series.average).toBeCloseTo(27.5)
		expect(series.averageCount).toBe(4)
	})
})

describe('largest expenses', () => {
	const bills = [planItem({ name: 'Colegio de los niños', amount_dop: 18500, category_id: 'edu' })]

	it('sorts by the DOP value across currencies', () => {
		const top = pickTopExpenses(
			[
				{ amount: 6000, currency: 'DOP' },
				{ amount: 200, currency: 'USD' },
				{ amount: 9000, currency: 'DOP' },
			],
			60,
			2,
		)
		expect(top.map((item) => item.amountDop)).toEqual([12000, 9000])
	})

	it('matches plan items by name (accents/case ignored) or category + amount only', () => {
		const tx = { name: 'colegio de los NIÑOS', category_id: 'other', amount: 1, currency: 'DOP' }
		expect(matchesPlanItem(tx, bills, 60)).toBe(true)
		expect(matchesPlanItem({ name: 'Pago', category_id: 'edu', amount: 18550, currency: 'DOP' }, bills, 60)).toBe(true)
		expect(matchesPlanItem({ name: 'Pago', category_id: 'edu', amount: 5500, currency: 'DOP' }, bills, 60)).toBe(false)
		expect(matchesPlanItem({ name: 'Pago', category_id: 'food', amount: 18500, currency: 'DOP' }, bills, 60)).toBe(
			false,
		)
	})
})
