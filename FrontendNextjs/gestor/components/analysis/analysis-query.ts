import type { AnalyticsQueryFilters } from '@/types/analytics'
import type { AnalysisFiltersState } from './AnalysisContext'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Calendar date as the API expects it (`YYYY-MM-DD`), in local time.
 * (`toISOString()` would shift the day for users east of UTC.)
 */
export function toApiDate(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${date.getFullYear()}-${month}-${day}`
}

/** Parses an API calendar date (`YYYY-MM-DD`) as local midnight. */
export function fromApiDate(value: string): Date {
	return new Date(`${value}T00:00:00`)
}

/** Inclusive number of days between two API dates (at least 1). */
export function daysBetween(from: Date, to: Date): number {
	return Math.max(1, Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1)
}

/** Translates the analysis filter form into the analytics API query. */
export function buildAnalyticsFilters(filters: AnalysisFiltersState): AnalyticsQueryFilters {
	const next: AnalyticsQueryFilters = {}

	if (filters.filterMode === 'month') {
		const selectedYear = Number(filters.year || new Date().getFullYear())
		if (filters.month && filters.month !== 'all') {
			const selectedMonth = Number(filters.month)
			next.date_from = toApiDate(new Date(selectedYear, selectedMonth - 1, 1))
			next.date_to = toApiDate(new Date(selectedYear, selectedMonth, 0))
		} else {
			next.date_from = toApiDate(new Date(selectedYear, 0, 1))
			next.date_to = toApiDate(new Date(selectedYear, 11, 31))
		}
	} else if (filters.dateRange?.from && filters.dateRange?.to) {
		next.date_from = toApiDate(filters.dateRange.from)
		next.date_to = toApiDate(filters.dateRange.to)
	}

	if (filters.account !== 'all') next.account_id = filters.account
	if (filters.category !== 'all') next.category_id = filters.category
	if (filters.type === 'INCOME') next.type = 'income'
	if (filters.type === 'BILL') next.type = 'bill'

	const minAmount = Number(filters.minAmount)
	if (filters.minAmount !== '' && !Number.isNaN(minAmount) && minAmount >= 0) next.min_amount = minAmount

	const maxAmount = Number(filters.maxAmount)
	if (filters.maxAmount !== '' && !Number.isNaN(maxAmount) && maxAmount >= 0) next.max_amount = maxAmount

	return next
}

/** Same-length period right before `filters` (for "vs previous period"), or undefined without dates. */
export function buildPreviousPeriodFilters(filters: AnalyticsQueryFilters): AnalyticsQueryFilters | undefined {
	if (!filters.date_from || !filters.date_to) return undefined
	const from = fromApiDate(filters.date_from)
	const to = fromApiDate(filters.date_to)
	if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return undefined

	const diffMs = to.getTime() - from.getTime()
	const prevTo = new Date(from.getTime() - DAY_MS)
	const prevFrom = new Date(prevTo.getTime() - diffMs)
	return { ...filters, date_from: toApiDate(prevFrom), date_to: toApiDate(prevTo) }
}
