import { BaseRepository } from "@/lib/base-repository";
import { AnalyticsQueryFilters, CategoryExpense, DashboardSummary, MonthlySummary } from "@/types/analytics";

export class AnalyticsRepository extends BaseRepository {
	async getCategoryExpenses(): Promise<CategoryExpense[]> {
		return this.get<CategoryExpense[]>("/analytics/category-expenses")
	}

	async getMonthlySummary(): Promise<MonthlySummary[]> {
		return this.get<MonthlySummary[]>("/analytics/monthly-summary")
	}

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
		if (filters?.type && filters.type !== 'income' && filters.type !== 'bill') {
			// noop, guard invalid values
		} else if (filters?.type) {
			params.set('type', filters.type)
		}

		const endpoint = params.toString()
			? `/analytics/dashboard-summary?${params.toString()}`
			: '/analytics/dashboard-summary'

		return this.get<DashboardSummary>(endpoint)
	}
}
