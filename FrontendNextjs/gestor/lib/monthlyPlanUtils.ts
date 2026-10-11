import { isFundingAccount } from '@/lib/accounts'
import type { Account } from '@/types/account'
import { MonthlyPlanItem } from '@/types/monthlyPlan'

/** Every plan total is expressed in Dominican pesos (the backend converts USD items). */
export const PLAN_CURRENCY = 'DOP'

/** Sums the DOP amount of the active items only; paused ones never count. */
export function sumActiveDop(items: MonthlyPlanItem[]): number {
	return items.reduce((total, item) => (item.is_active ? total + item.amount_dop : total), 0)
}

/**
 * Share of an item within a total, as a percentage. Returns 0 when there is no
 * total to divide by instead of NaN.
 */
export function shareOfTotal(amount: number, total: number): number {
	if (total <= 0) return 0
	return (amount / total) * 100
}

/** DOP amount with the plan's sign: incomes add, fixed expenses subtract. */
export function signedDop(item: Pick<MonthlyPlanItem, 'type' | 'amount_dop'>): number {
	return item.type === 'income' ? item.amount_dop : -item.amount_dop
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

/** A calendar date in the user's local time zone. `month` is 0-based like `Date`. */
export interface PlanDate {
	year: number
	month: number
	day: number
}

/** Today's date as the browser (the user) sees it. */
export function localToday(now: Date = new Date()): PlanDate {
	return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() }
}

/** Number of days of a month (28–31). `month` is 0-based. */
export function daysInMonth(year: number, month: number): number {
	return new Date(year, month + 1, 0).getDate()
}

/**
 * The day an item actually falls on this month: a "day 31" bill lands on the
 * 30th in a 30-day month (and on the 28th/29th in February). `null` for items
 * without a fixed day.
 */
export function effectiveDay(day: number | null | undefined, monthDays: number): number | null {
	if (!day || day < 1) return null
	return Math.min(day, monthDays)
}

/** Day order inside a group: by (clamped) day, items without a day last, then by name. */
function compareByDay(monthDays: number) {
	return (a: MonthlyPlanItem, b: MonthlyPlanItem) =>
		(effectiveDay(a.day_of_month, monthDays) ?? 99) - (effectiveDay(b.day_of_month, monthDays) ?? 99) ||
		a.name.localeCompare(b.name)
}

// ---------------------------------------------------------------------------
// Ledger: search + grouping
// ---------------------------------------------------------------------------

/** Lowercase without accents, so "educacion" finds "Educación". */
export function normalizeSearch(value: string): string {
	return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Whether an item's name contains the (normalized) query. An empty query matches everything. */
export function matchesSearch(item: Pick<MonthlyPlanItem, 'name'>, query: string): boolean {
	const needle = normalizeSearch(query)
	if (!needle) return true
	return normalizeSearch(item.name).includes(needle)
}

export type LedgerGroupBy = 'category' | 'week' | 'none'

export const LEDGER_GROUP_BY: readonly LedgerGroupBy[] = ['category', 'week', 'none']

export interface WeekRange {
	/** 1-based week of the month. */
	index: number
	from: number
	to: number
}

/** The four fixed "weeks" of the plan: 1–7, 8–15, 16–23 and 24 to the end of the month. */
export function weekRanges(monthDays: number): WeekRange[] {
	return [
		{ index: 1, from: 1, to: 7 },
		{ index: 2, from: 8, to: 15 },
		{ index: 3, from: 16, to: 23 },
		{ index: 4, from: 24, to: monthDays },
	]
}

/** Week (1–4) a day of the month belongs to. */
export function weekOfDay(day: number): number {
	if (day <= 7) return 1
	if (day <= 15) return 2
	if (day <= 23) return 3
	return 4
}

export type LedgerGroupKind = 'income' | 'category' | 'week' | 'noDay' | 'all'

export interface LedgerGroup {
	/** Stable key, also used to remember whether the group is collapsed. */
	key: string
	kind: LedgerGroupKind
	/** Category groups only; '' for the "no category" bucket. */
	categoryId?: string
	/** Week groups only. */
	week?: WeekRange
	/** Sorted by day, items without a day last. */
	items: MonthlyPlanItem[]
	/** Signed DOP sum of the active items (incomes +, expenses −). */
	subtotal: number
	/** Share of all active fixed expenses taken by this group's active expenses, in percent. */
	expenseShare: number
}

interface GroupOptions {
	/** Days of the current month, to clamp days and close the last week. */
	monthDays: number
	/** Total of the active fixed expenses of the whole plan (the share's denominator). */
	totalExpenses: number
}

function makeGroup(
	key: string,
	kind: LedgerGroupKind,
	items: MonthlyPlanItem[],
	{ monthDays, totalExpenses }: GroupOptions,
	extra: Partial<LedgerGroup> = {},
): LedgerGroup {
	const active = items.filter((item) => item.is_active)
	const expenses = active.filter((item) => item.type === 'bill').reduce((sum, item) => sum + item.amount_dop, 0)
	return {
		key,
		kind,
		items: [...items].sort(compareByDay(monthDays)),
		subtotal: active.reduce((sum, item) => sum + signedDop(item), 0),
		expenseShare: shareOfTotal(expenses, totalExpenses),
		...extra,
	}
}

/**
 * Splits the (already searched/filtered) items into the ledger's groups.
 *
 * - `category`: expected income first, then one group per expense category,
 *   biggest active total first ("no category" is just another bucket).
 * - `week`: the four weeks of the month that have items, then "no fixed day".
 * - `none`: a single group with everything.
 *
 * Empty groups are never returned.
 */
export function groupPlanItems(items: MonthlyPlanItem[], groupBy: LedgerGroupBy, options: GroupOptions): LedgerGroup[] {
	if (items.length === 0) return []

	if (groupBy === 'none') return [makeGroup('all', 'all', items, options)]

	if (groupBy === 'week') {
		const groups: LedgerGroup[] = []
		for (const week of weekRanges(options.monthDays)) {
			const inWeek = items.filter((item) => {
				const day = effectiveDay(item.day_of_month, options.monthDays)
				return day !== null && day >= week.from && day <= week.to
			})
			if (inWeek.length) groups.push(makeGroup(`week-${week.index}`, 'week', inWeek, options, { week }))
		}
		const noDay = items.filter((item) => effectiveDay(item.day_of_month, options.monthDays) === null)
		if (noDay.length) groups.push(makeGroup('week-none', 'noDay', noDay, options))
		return groups
	}

	const groups: LedgerGroup[] = []
	const incomes = items.filter((item) => item.type === 'income')
	if (incomes.length) groups.push(makeGroup('income', 'income', incomes, options))

	const buckets = new Map<string, MonthlyPlanItem[]>()
	for (const item of items) {
		if (item.type !== 'bill') continue
		const categoryId = item.category_id || ''
		const bucket = buckets.get(categoryId)
		if (bucket) bucket.push(item)
		else buckets.set(categoryId, [item])
	}
	const categoryGroups = Array.from(buckets.entries()).map(([categoryId, bucket]) =>
		makeGroup(`category:${categoryId || 'none'}`, 'category', bucket, options, { categoryId }),
	)
	// Biggest share of the money first (expense subtotals are negative).
	categoryGroups.sort((a, b) => a.subtotal - b.subtotal)
	return [...groups, ...categoryGroups]
}

// ---------------------------------------------------------------------------
// Flow of the month
// ---------------------------------------------------------------------------

/** Projected balance at the end of a day of the month. */
export interface FlowPoint {
	day: number
	balance: number
}

/** One plan item that still has to happen this month. */
export interface FlowEvent {
	/** Clamped day of the month it falls on. */
	day: number
	item: MonthlyPlanItem
	/** Signed DOP amount. */
	amount: number
}

export interface MonthFlow {
	today: number
	monthDays: number
	/** Balance today (the starting point). */
	start: number
	/** Projected balance at the end of the month. */
	end: number
	/** One point per day from today to the last day of the month (today first). */
	points: FlowPoint[]
	/** Dated events after today, in day order. */
	events: FlowEvent[]
	/** Signed sum of the active items without a fixed day, applied on the last day. */
	noDayTotal: number
	/** Lowest balance (the earliest one on ties). */
	low: FlowPoint
	/** First day the balance goes below zero, if it does. */
	firstNegative: FlowPoint | null
	/** First income after the lowest point. */
	nextIncome: FlowEvent | null
	/** Events in the next 7 days (capped at the end of the month). */
	upcoming: FlowEvent[]
	/** Last day covered by `upcoming`. */
	upcomingTo: number
	/** Income and outflow (both positive numbers) of `upcoming`. */
	upcomingIn: number
	upcomingOut: number
}

const UPCOMING_DAYS = 7

/** Rounds to cents so float noise never flips a sign. */
function cents(value: number): number {
	return Math.round(value * 100) / 100
}

/**
 * Projects the rest of the month from the money the user has today.
 *
 * Starts at `startBalance` (the accounts' balance today, which already reflects
 * everything that happened up to today) and applies only the active items that
 * are still to come: those whose (clamped) day is after today. Items without a
 * fixed day are assumed to happen by the end of the month and are applied on
 * the last day.
 */
export function projectMonthFlow(items: MonthlyPlanItem[], startBalance: number, today: PlanDate): MonthFlow {
	const monthDays = daysInMonth(today.year, today.month)
	const todayDay = Math.min(Math.max(today.day, 1), monthDays)
	const active = items.filter((item) => item.is_active)

	const events: FlowEvent[] = active
		.map((item) => ({ day: effectiveDay(item.day_of_month, monthDays), item, amount: signedDop(item) }))
		.filter((event): event is FlowEvent => event.day !== null && event.day > todayDay)
		.sort((a, b) => a.day - b.day || a.item.name.localeCompare(b.item.name))

	const noDayTotal = cents(
		active
			.filter((item) => effectiveDay(item.day_of_month, monthDays) === null)
			.reduce((sum, item) => sum + signedDop(item), 0),
	)

	const byDay = new Map<number, number>()
	for (const event of events) byDay.set(event.day, (byDay.get(event.day) ?? 0) + event.amount)

	const points: FlowPoint[] = [{ day: todayDay, balance: cents(startBalance) }]
	let balance = startBalance
	for (let day = todayDay + 1; day <= monthDays; day++) {
		balance += byDay.get(day) ?? 0
		if (day === monthDays) balance += noDayTotal
		points.push({ day, balance: cents(balance) })
	}
	// On the last day of the month the undated items still have to happen.
	if (todayDay === monthDays && noDayTotal !== 0) points.push({ day: monthDays, balance: cents(balance + noDayTotal) })

	const low = points.reduce((min, point) => (point.balance < min.balance ? point : min), points[0])
	const firstNegative = points.find((point) => point.balance < 0) ?? null
	const nextIncome = events.find((event) => event.item.type === 'income' && event.day > low.day) ?? null

	const upcomingTo = Math.min(todayDay + UPCOMING_DAYS, monthDays)
	const upcoming = events.filter((event) => event.day <= upcomingTo)

	return {
		today: todayDay,
		monthDays,
		start: points[0].balance,
		end: points[points.length - 1].balance,
		points,
		events,
		noDayTotal,
		low,
		firstNegative,
		nextIncome,
		upcoming,
		upcomingTo,
		upcomingIn: cents(upcoming.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0)),
		upcomingOut: cents(upcoming.filter((e) => e.amount < 0).reduce((sum, e) => sum - e.amount, 0)),
	}
}

/**
 * The money the user has today, in DOP: the current balance of every account
 * that holds money (credit cards are debt and stay out, like the dashboard's
 * "Balance total"). USD accounts are converted with the plan's rate.
 */
export function startingBalanceDop(accounts: Account[], usdToDop: number): number {
	return cents(
		accounts.filter(isFundingAccount).reduce((sum, account) => {
			const balance = account.current_balance ?? account.initial_balance ?? 0
			const rate = account.currency === 'USD' && usdToDop > 0 ? usdToDop : 1
			return sum + balance * rate
		}, 0),
	)
}
