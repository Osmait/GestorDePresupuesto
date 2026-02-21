import { BaseRepository } from "@/lib/base-repository";
import { AnalyticsQueryFilters, CategoryExpense, DashboardSummary, MonthlySummary } from "@/types/analytics";

export class AnalyticsRepository extends BaseRepository {
	async getCategoryExpenses(): Promise<CategoryExpense[]> {
		try {
			const data = await this.get<CategoryExpense[]>("/analytics/category-expenses");
			return data;
		} catch (error) {
			console.error("Error fetching category expenses:", error);
			return [];
		}
	}

	async getMonthlySummary(): Promise<MonthlySummary[]> {
		try {
			const data = await this.get<MonthlySummary[]>("/analytics/monthly-summary");
			return data;
		} catch (error) {
			console.error("Error fetching monthly summary:", error);
			return [];
		}
	}

	async getDashboardSummary(filters?: AnalyticsQueryFilters): Promise<DashboardSummary> {
		try {
			const params = new URLSearchParams();
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

			const data = await this.get<DashboardSummary>(endpoint);
			return data;
		} catch (error) {
			console.error("Error fetching dashboard summary:", error);
			return {
				total_income: 0,
				total_expenses: 0,
				net_amount: 0,
				usd_to_dop_rate: 60,
				accounts_total: 0,
				investments_total: 0,
				certificates_total: 0,
				accounts_count: 0,
				investments_count: 0,
				certificates_count: 0,
				category_expenses: [],
				monthly_summary: [],
			};
		}
	}
}
