/**
 * Pure computations behind the Analytics report (app/app/analysis).
 *
 * Everything here is deterministic and takes `today` as an argument, so the
 * period math (fair comparisons, month boundaries, leap years) and the
 * projections can be unit tested without mocking the clock.
 *
 * Conventions: months are 1-12, dates are local calendar days (midnight),
 * API dates are `YYYY-MM-DD`, and every amount is already in DOP unless said
 * otherwise.
 */
import type { CategoryExpense, MonthlySummary } from '@/types/analytics'
import type { MonthlyPlanItem } from '@/types/monthlyPlan'
import type { Transaction } from '@/types/transaction'

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Calendar date as the API expects it (`YYYY-MM-DD`), in local time. */
export function toApiDate(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${date.getFullYear()}-${month}-${day}`
}

const API_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Parses `YYYY-MM-DD` as local midnight; null when it is not a real calendar day. */
export function fromApiDate(value: string): Date | null {
	const match = API_DATE.exec(value)
	if (!match) return null
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
	const date = new Date(year, month - 1, day)
	if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
	return date
}

export function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** Days in `month` (1-12) of `year`. */
export function daysInMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate()
}

/** Inclusive count of calendar days from `from` to `to` (DST-safe; at least 1). */
export function daysInclusive(from: Date, to: Date): number {
	const diff = Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000)
	return Math.max(1, diff + 1)
}

/** `{year, month}` moved by `delta` months (crosses year boundaries). */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
	const date = new Date(year, month - 1 + delta, 1)
	return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

/** `YYYY-MM` key, the format of `/analytics` monthly summaries. */
export function monthKey(year: number, month: number): string {
	return `${year}-${String(month).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Period selection (mirrored in the URL as ?period=…)
// ---------------------------------------------------------------------------

export type AnalysisPeriod =
	| { mode: 'month'; year: number; month: number }
	| { mode: 'year'; year: number }
	| { mode: 'range'; from: string; to: string }

export type PeriodMode = AnalysisPeriod['mode']

export function currentMonthPeriod(today: Date): AnalysisPeriod {
	return { mode: 'month', year: today.getFullYear(), month: today.getMonth() + 1 }
}

const MONTH_PARAM = /^(\d{4})-(\d{2})$/
const YEAR_PARAM = /^(\d{4})$/
const RANGE_PARAM = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/
const MIN_YEAR = 1970

/**
 * Reads `?period=`: `2026-10` (month), `2026` (year) or `2026-01-05..2026-03-10`
 * (range). Anything invalid or in the future falls back to the current month.
 */
export function parsePeriodParam(value: string | null | undefined, today: Date): AnalysisPeriod {
	const fallback = currentMonthPeriod(today)
	if (!value) return fallback
	const thisYear = today.getFullYear()
	const thisMonth = today.getMonth() + 1

	const month = MONTH_PARAM.exec(value)
	if (month) {
		const year = Number(month[1])
		const m = Number(month[2])
		if (m < 1 || m > 12 || year < MIN_YEAR) return fallback
		if (year > thisYear || (year === thisYear && m > thisMonth)) return fallback
		return { mode: 'month', year, month: m }
	}

	const year = YEAR_PARAM.exec(value)
	if (year) {
		const y = Number(year[1])
		if (y < MIN_YEAR || y > thisYear) return fallback
		return { mode: 'year', year: y }
	}

	const range = RANGE_PARAM.exec(value)
	if (range) {
		let from = fromApiDate(range[1])
		let to = fromApiDate(range[2])
		if (!from || !to) return fallback
		if (from > to) [from, to] = [to, from]
		if (from > startOfDay(today)) return fallback
		return { mode: 'range', from: toApiDate(from), to: toApiDate(to) }
	}

	return fallback
}

export function serializePeriod(period: AnalysisPeriod): string {
	switch (period.mode) {
		case 'month':
			return monthKey(period.year, period.month)
		case 'year':
			return String(period.year)
		case 'range':
			return `${period.from}..${period.to}`
	}
}

/** Previous/next month or year. Ranges don't step (they are picked with the calendar). */
export function stepPeriod(period: AnalysisPeriod, delta: number): AnalysisPeriod {
	if (period.mode === 'month') return { mode: 'month', ...shiftMonth(period.year, period.month, delta) }
	if (period.mode === 'year') return { mode: 'year', year: period.year + delta }
	return period
}

/** False for the current month/year: the report never goes into the future. */
export function canStepForward(period: AnalysisPeriod, today: Date): boolean {
	if (period.mode === 'month') {
		const next = shiftMonth(period.year, period.month, 1)
		return new Date(next.year, next.month - 1, 1) <= startOfDay(today)
	}
	if (period.mode === 'year') return period.year < today.getFullYear()
	return false
}

export interface DateRange {
	from: Date
	to: Date
}

export interface ResolvedPeriod {
	period: AnalysisPeriod
	/** What the report measures: the period, cut at today while it is in progress. */
	range: DateRange
	/** Last day of the period as selected (end of month/year/range). */
	nominalTo: Date
	/** The period contains today, so `range.to` is today. */
	inProgress: boolean
	/** The fair comparison: same days of the previous month/year, or the same-length range before. */
	comparison: DateRange
	elapsedDays: number
	comparisonDays: number
}

/**
 * The measured range and its fair comparison.
 *
 * - Month in progress: 1..today vs 1..today of the previous month (clamped to
 *   that month's length, e.g. Mar 1–31 vs Feb 1–28/29). A past month is
 *   compared with the whole previous month.
 * - Year in progress: Jan 1..today vs Jan 1..the same date of the previous
 *   year (Feb 29 → Feb 28). A past year is compared with the whole previous year.
 * - Range: cut at today, compared with the same number of days right before it.
 */
export function resolvePeriod(period: AnalysisPeriod, now: Date): ResolvedPeriod {
	const today = startOfDay(now)
	let from: Date
	let nominalTo: Date
	let comparison: DateRange

	if (period.mode === 'month') {
		from = new Date(period.year, period.month - 1, 1)
		nominalTo = new Date(period.year, period.month - 1, daysInMonth(period.year, period.month))
		const inProgress = today >= from && today <= nominalTo
		const prev = shiftMonth(period.year, period.month, -1)
		const prevLength = daysInMonth(prev.year, prev.month)
		const prevDay = inProgress ? Math.min(today.getDate(), prevLength) : prevLength
		comparison = { from: new Date(prev.year, prev.month - 1, 1), to: new Date(prev.year, prev.month - 1, prevDay) }
	} else if (period.mode === 'year') {
		from = new Date(period.year, 0, 1)
		nominalTo = new Date(period.year, 11, 31)
		const inProgress = today >= from && today <= nominalTo
		const prevYear = period.year - 1
		const prevTo = inProgress
			? new Date(prevYear, today.getMonth(), Math.min(today.getDate(), daysInMonth(prevYear, today.getMonth() + 1)))
			: new Date(prevYear, 11, 31)
		comparison = { from: new Date(prevYear, 0, 1), to: prevTo }
	} else {
		from = fromApiDate(period.from) ?? today
		nominalTo = fromApiDate(period.to) ?? today
		const to = nominalTo > today ? today : nominalTo
		const length = daysInclusive(from, to)
		comparison = { from: addDays(from, -length), to: addDays(from, -1) }
	}

	const inProgress = today >= from && today <= nominalTo
	const to = inProgress ? today : nominalTo
	return {
		period,
		range: { from, to },
		nominalTo,
		inProgress,
		comparison,
		elapsedDays: daysInclusive(from, to),
		comparisonDays: daysInclusive(comparison.from, comparison.to),
	}
}

/** Last month of the measured range, the anchor of the 6-month trend. */
export function endMonthOf(resolved: ResolvedPeriod): { year: number; month: number } {
	return { year: resolved.range.to.getFullYear(), month: resolved.range.to.getMonth() + 1 }
}

/** API range of the `count` months ending with the period's last month (cut at the period's end). */
export function trendRange(resolved: ResolvedPeriod, count = 6): DateRange {
	const end = endMonthOf(resolved)
	const start = shiftMonth(end.year, end.month, -(count - 1))
	return { from: new Date(start.year, start.month - 1, 1), to: resolved.range.to }
}

// ---------------------------------------------------------------------------
// Ratios
// ---------------------------------------------------------------------------

/** Rounds to cents (and never returns -0). */
export function roundMoney(value: number): number {
	if (!Number.isFinite(value)) return 0
	return Math.round(value * 100) / 100 || 0
}

/** Change in percent, or null when there is nothing to compare against. */
export function percentDelta(current: number, previous: number): number | null {
	if (!(previous > 0)) return null
	return ((current - previous) / previous) * 100
}

/** Share of income kept, in percent; null without income. */
export function savingsRate(income: number, expenses: number): number | null {
	if (!(income > 0)) return null
	return ((income - expenses) / income) * 100
}

// ---------------------------------------------------------------------------
// Monthly plan: fixed vs variable
// ---------------------------------------------------------------------------

/** Day an item is due in a given month: its day_of_month clamped to the month (none → last day). */
export function planDueDay(item: Pick<MonthlyPlanItem, 'day_of_month'>, year: number, month: number): number {
	const length = daysInMonth(year, month)
	const day = item.day_of_month
	if (!day || day < 1) return length
	return Math.min(day, length)
}

/** Active plan items of a type, limited to an account when the report is filtered by one. */
export function activePlanItems(
	items: MonthlyPlanItem[],
	type: MonthlyPlanItem['type'],
	accountId?: string,
): MonthlyPlanItem[] {
	return items.filter((item) => item.is_active && item.type === type && (!accountId || item.account_id === accountId))
}

export interface PlanProgress {
	due: MonthlyPlanItem[]
	remaining: MonthlyPlanItem[]
	dueAmount: number
	remainingAmount: number
	totalAmount: number
}

/** Plan items already due by `day` of a month vs those still to come, each sorted by due day. */
export function splitPlanByDay(items: MonthlyPlanItem[], year: number, month: number, day: number): PlanProgress {
	const sorted = [...items].sort((a, b) => planDueDay(a, year, month) - planDueDay(b, year, month))
	const due = sorted.filter((item) => planDueDay(item, year, month) <= day)
	const remaining = sorted.filter((item) => planDueDay(item, year, month) > day)
	const sum = (list: MonthlyPlanItem[]) => roundMoney(list.reduce((total, item) => total + (item.amount_dop || 0), 0))
	return {
		due,
		remaining,
		dueAmount: sum(due),
		remainingAmount: sum(remaining),
		totalAmount: sum(sorted),
	}
}

/**
 * Splits what was spent into fixed (plan bills already due) and variable (the
 * rest). Fixed never exceeds what was actually spent, so a plan bill that was
 * not paid yet can't make the variable part negative.
 */
export function splitFixedVariable(spent: number, fixedDue: number): { fixed: number; variable: number } {
	const total = Math.max(0, spent)
	const fixed = Math.min(Math.max(0, fixedDue), total)
	return { fixed: roundMoney(fixed), variable: roundMoney(total - fixed) }
}

/**
 * Fixed vs variable, category by category: in each category the plan bills
 * already due count as fixed only up to what was actually spent there, so a
 * bill that was not paid (or not recorded) yet never swallows the variable
 * spending of other categories. Bills without a category are capped at the
 * spend that is left.
 */
export function splitFixedVariableByCategory(
	spent: number,
	spentByCategory: Array<Pick<CategoryExpense, 'id' | 'value'>>,
	dueBills: MonthlyPlanItem[],
): { fixed: number; variable: number } {
	const total = Math.max(0, spent)
	const spentById = new Map<string, number>()
	for (const item of spentByCategory) {
		if (item.id) spentById.set(item.id, (spentById.get(item.id) ?? 0) + Math.abs(item.value))
	}
	const dueById = new Map<string, number>()
	for (const bill of dueBills) {
		const key = bill.category_id || ''
		dueById.set(key, (dueById.get(key) ?? 0) + Math.max(0, bill.amount_dop || 0))
	}
	let fixed = 0
	for (const [categoryId, due] of Array.from(dueById)) {
		if (categoryId) fixed += Math.min(due, spentById.get(categoryId) ?? 0)
	}
	fixed += Math.min(dueById.get('') ?? 0, Math.max(0, total - fixed))
	return splitFixedVariable(total, fixed)
}

/** First plan income day still to come this month (after `day`), or null. */
export function nextIncomeDay(incomeItems: MonthlyPlanItem[], year: number, month: number, day: number): number | null {
	const upcoming = incomeItems.map((item) => planDueDay(item, year, month)).filter((due) => due > day)
	return upcoming.length > 0 ? Math.min(...upcoming) : null
}

// ---------------------------------------------------------------------------
// Budget pace
// ---------------------------------------------------------------------------

export interface MonthCloseInput {
	/** Spent so far in the category this month. */
	spent: number
	/** Day of the month the data goes up to (the whole month for a past month). */
	day: number
	daysInMonth: number
	/** Plan bills of the category already due by `day` (part of `spent`, not of the pace). */
	planDue: number
	/** Plan bills of the category still due after `day`. */
	planRemaining: number
}

/**
 * The one projection of the page: what is spent, plus the plan bills still to
 * come, plus the variable spending (spent minus due plan bills) continued at
 * its daily pace for the days left. A finished month closes at what was spent.
 */
export function estimateMonthClose({
	spent,
	day,
	daysInMonth: length,
	planDue,
	planRemaining,
}: MonthCloseInput): number {
	if (day >= length) return roundMoney(spent)
	const variableSpent = Math.max(0, spent - Math.max(0, planDue))
	const perDay = day > 0 ? variableSpent / day : 0
	return roundMoney(spent + Math.max(0, planRemaining) + perDay * (length - day))
}

export type PaceStatus = 'over' | 'fast' | 'tight' | 'ok'

/** Share of the budget from which an on-track estimate is "at the limit". */
export const TIGHT_THRESHOLD = 0.9

/** over: already spent more than the budget; fast: the estimate passes it; tight: ≥90%; ok otherwise. */
export function paceStatus(spent: number, estimatedClose: number, budget: number): PaceStatus {
	if (!(budget > 0)) return spent > 0 ? 'over' : 'ok'
	if (spent > budget) return 'over'
	if (estimatedClose > budget) return 'fast'
	if (estimatedClose >= budget * TIGHT_THRESHOLD) return 'tight'
	return 'ok'
}

// ---------------------------------------------------------------------------
// Category changes
// ---------------------------------------------------------------------------

export interface CategoryChange {
	id: string
	label: string
	color: string
	current: number
	previous: number
	delta: number
	/** Change vs the previous amount, in percent; null when there was no previous spend. */
	percent: number | null
}

/**
 * Per-category spend change between two periods. `changed` is sorted by the
 * size of the change (either direction); `unchanged` holds the categories
 * with the exact same spend in both (typically fixed payments).
 */
export function computeCategoryChanges(
	current: CategoryExpense[],
	previous: CategoryExpense[],
): { changed: CategoryChange[]; unchanged: CategoryChange[] } {
	const keyOf = (item: CategoryExpense) => item.id || item.label
	const merged = new Map<string, CategoryChange>()
	for (const item of previous) {
		merged.set(keyOf(item), {
			id: item.id,
			label: item.label,
			color: item.color,
			current: 0,
			previous: roundMoney(Math.abs(item.value)),
			delta: 0,
			percent: null,
		})
	}
	for (const item of current) {
		const existing = merged.get(keyOf(item))
		merged.set(keyOf(item), {
			id: item.id,
			label: item.label || existing?.label || '',
			color: item.color || existing?.color || '',
			current: roundMoney(Math.abs(item.value)),
			previous: existing?.previous ?? 0,
			delta: 0,
			percent: null,
		})
	}

	const all = Array.from(merged.values()).map((change) => ({
		...change,
		delta: roundMoney(change.current - change.previous),
		percent: percentDelta(change.current, change.previous),
	}))
	const changed = all.filter((change) => change.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
	const unchanged = all
		.filter((change) => change.delta === 0 && change.current > 0)
		.sort((a, b) => b.current - a.current)
	return { changed, unchanged }
}

// ---------------------------------------------------------------------------
// Monthly trend
// ---------------------------------------------------------------------------

export interface TrendMonth {
	key: string
	year: number
	month: number
	income: number
	expenses: number
	savingsRate: number | null
	/** The month contains today: its totals are partial. */
	inProgress: boolean
}

/** `count` consecutive months ending at `end`, filled with zeros where the summary has no row. */
export function buildMonthlyTrend(
	summary: MonthlySummary[],
	end: { year: number; month: number },
	today: Date,
	count = 6,
): TrendMonth[] {
	const byKey = new Map(summary.map((row) => [row.month, row]))
	const currentKey = monthKey(today.getFullYear(), today.getMonth() + 1)
	return Array.from({ length: count }, (_, index) => {
		const { year, month } = shiftMonth(end.year, end.month, index - (count - 1))
		const key = monthKey(year, month)
		const row = byKey.get(key)
		const income = roundMoney(Math.abs(row?.Ingresos ?? 0))
		const expenses = roundMoney(Math.abs(row?.Gastos ?? 0))
		return {
			key,
			year,
			month,
			income,
			expenses,
			savingsRate: savingsRate(income, expenses),
			inProgress: key === currentKey,
		}
	})
}

/**
 * Savings rate of the last complete month of the trend plus the `count`
 * complete months that end with it (for the sparkline) and their average.
 * `averageCount` is how many of those months had income (the ones averaged).
 */
export function savingsSeries(
	trend: TrendMonth[],
	count = 5,
): { last: TrendMonth | null; months: TrendMonth[]; average: number | null; averageCount: number } {
	const complete = trend.filter((month) => !month.inProgress)
	const months = complete.slice(-count)
	const last = months.at(-1) ?? null
	const rates = months.map((month) => month.savingsRate).filter((rate): rate is number => rate !== null)
	const average = rates.length > 0 ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : null
	return { last, months, average, averageCount: rates.length }
}

/** SVG path (`M x y L …`) of a sparkline in a `width`×`height` box; null values are skipped. */
export function sparklinePath(values: Array<number | null>, width: number, height: number, padding = 3): string {
	const points = values
		.map((value, index) => ({ value, index }))
		.filter((point): point is { value: number; index: number } => point.value !== null && Number.isFinite(point.value))
	if (points.length === 0) return ''
	const min = Math.min(...points.map((p) => p.value))
	const max = Math.max(...points.map((p) => p.value))
	const span = max - min || 1
	const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0
	return points
		.map((point, i) => {
			const x = padding + point.index * stepX
			const y = max === min ? height / 2 : height - padding - ((point.value - min) / span) * (height - padding * 2)
			return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
		})
		.join(' ')
}

// ---------------------------------------------------------------------------
// Largest expenses
// ---------------------------------------------------------------------------

export function toDop(amount: number, currency: string | undefined, usdToDop: number): number {
	return currency === 'USD' ? amount * (usdToDop > 0 ? usdToDop : 1) : amount
}

/** Lower case, no accents, single spaces: for comparing names typed by hand. */
export function normalizeName(value: string): string {
	return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * True when a transaction is (very likely) the payment of a plan bill: the
 * same name, or the same category and the same amount (±1%). Nothing fuzzier,
 * so the "from the plan" label is never a guess.
 */
export function matchesPlanItem(
	transaction: Pick<Transaction, 'name' | 'category_id' | 'amount' | 'currency'>,
	bills: MonthlyPlanItem[],
	usdToDop: number,
): boolean {
	const name = normalizeName(transaction.name)
	const amount = toDop(transaction.amount, transaction.currency, usdToDop)
	return bills.some((bill) => {
		if (name && normalizeName(bill.name) === name) return true
		if (!bill.category_id || bill.category_id !== transaction.category_id) return false
		return Math.abs(amount - bill.amount_dop) <= Math.max(1, bill.amount_dop * 0.01)
	})
}

/** The `count` biggest transactions in DOP (the API sorts by raw amount, mixing currencies). */
export function pickTopExpenses<T extends Pick<Transaction, 'amount' | 'currency'>>(
	transactions: T[],
	usdToDop: number,
	count = 5,
): Array<T & { amountDop: number }> {
	return transactions
		.map((transaction) => ({ ...transaction, amountDop: toDop(transaction.amount, transaction.currency, usdToDop) }))
		.sort((a, b) => b.amountDop - a.amountDop)
		.slice(0, count)
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** Deep copy with every number rounded to cents (no float noise like 1234.5600000001). */
export function roundDeep<T>(value: T): T {
	if (typeof value === 'number') return roundMoney(value) as T
	if (Array.isArray(value)) return value.map((item) => roundDeep(item)) as T
	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, roundDeep(child)])) as T
	}
	return value
}
