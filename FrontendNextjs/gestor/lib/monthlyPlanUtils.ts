import { MonthlyPlanItem } from '@/types/monthlyPlan'

/** Formats an amount as Dominican pesos, the currency every total is expressed in. */
export function formatDop(amount: number): string {
	return new Intl.NumberFormat('es-DO', {
		style: 'currency',
		currency: 'DOP',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount)
}

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

export interface CategoryShare {
	categoryId: string
	label: string
	amount: number
	percentage: number
}

/**
 * Groups active items by category and returns each group's share of the total,
 * biggest first. This is the "where does my money actually go" view.
 */
export function groupByCategory(
	items: MonthlyPlanItem[],
	categoryNames: Map<string, string>,
	uncategorizedLabel: string,
): CategoryShare[] {
	const activeItems = items.filter((item) => item.is_active)
	const total = activeItems.reduce((sum, item) => sum + item.amount_dop, 0)

	const buckets = new Map<string, number>()
	for (const item of activeItems) {
		const key = item.category_id || ''
		buckets.set(key, (buckets.get(key) ?? 0) + item.amount_dop)
	}

	return Array.from(buckets.entries())
		.map(([categoryId, amount]) => ({
			categoryId,
			label: categoryId ? (categoryNames.get(categoryId) ?? uncategorizedLabel) : uncategorizedLabel,
			amount,
			percentage: shareOfTotal(amount, total),
		}))
		.sort((a, b) => b.amount - a.amount)
}

export interface TimelineEntry {
	day: number
	incomeTotal: number
	expenseTotal: number
	items: MonthlyPlanItem[]
}

/**
 * Buckets active items by the day of the month they fall on, so the user can see
 * cash-flow gaps: rent due on the 1st while the salary only lands on the 30th.
 * Items with no fixed day are left out — they have no place on a timeline.
 */
export function buildTimeline(items: MonthlyPlanItem[]): TimelineEntry[] {
	const byDay = new Map<number, TimelineEntry>()

	for (const item of items) {
		if (!item.is_active || !item.day_of_month) continue

		const entry = byDay.get(item.day_of_month) ?? {
			day: item.day_of_month,
			incomeTotal: 0,
			expenseTotal: 0,
			items: [],
		}

		if (item.type === 'income') {
			entry.incomeTotal += item.amount_dop
		} else {
			entry.expenseTotal += item.amount_dop
		}
		entry.items.push(item)
		byDay.set(item.day_of_month, entry)
	}

	return Array.from(byDay.values()).sort((a, b) => a.day - b.day)
}

/**
 * Running balance across the timeline. A negative value on any day means the
 * plan runs out of cash before the next income arrives, even if the month as a
 * whole adds up.
 */
export function runningBalance(timeline: TimelineEntry[]): { day: number; balance: number }[] {
	let balance = 0
	return timeline.map((entry) => {
		balance += entry.incomeTotal - entry.expenseTotal
		return { day: entry.day, balance }
	})
}
