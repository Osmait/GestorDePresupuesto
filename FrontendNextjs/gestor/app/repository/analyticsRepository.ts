import { BaseRepository } from '@/lib/base-repository'
import { AnalyticsQueryFilters, CategoryExpense, DashboardSummary, MonthlySummary } from '@/types/analytics'

export class AnalyticsRepository extends BaseRepository {
	async getCategoryExpenses(): Promise<CategoryExpense[]> {
		try {
			const data = await this.get<CategoryExpense[]>('/analytics/category-expenses')
			return data
		} catch (error) {
			console.error('Error fetching category expenses:', error)
			return []
		}
	}

	async getMonthlySummary(): Promise<MonthlySummary[]> {
		try {
			const data = await this.get<MonthlySummary[]>('/analytics/monthly-summary')
			return data
		} catch (error) {
			console.error('Error fetching monthly summary:', error)
			return []
		}
	}

	/**
	 * Totals, category expenses and monthly summary for the filters. Errors are
	 * thrown (not swallowed into zeros) so callers can show an error state
	 * instead of a report that looks like "you spent nothing".
	 */
	async getDashboardSummary(filters?: AnalyticsQueryFilters): Promise<DashboardSummary> {
		const params = new URLSearchParams()
		if (filters?.date_from) params.set('date_from', filters.date_from)
		if (filters?.date_to) params.set('date_to', filters.date_to)
		if (filters?.account_id && filters.account_id !== 'all') params.set('account_id', filters.account_id)
		if (filters?.category_id && filters.category_id !== 'all') params.set('category_id', filters.category_id)
		if (typeof filters?.min_amount === 'number' && !Number.isNaN(filters.min_amount) && filters.min_amount >= 0) {
			params.set('min_amount', String(filters.min_amount))
		}
		if (typeof filters?.max_amount === 'number' && !Number.isNaN(filters.max_amount) && filters.max_amount >= 0) {
			params.set('max_amount', String(filters.max_amount))
		}
		if (filters?.type === 'income' || filters?.type === 'bill') params.set('type', filters.type)

		const query = params.toString()
		return this.get<DashboardSummary>(query ? `/analytics/dashboard-summary?${query}` : '/analytics/dashboard-summary')
	}
}
