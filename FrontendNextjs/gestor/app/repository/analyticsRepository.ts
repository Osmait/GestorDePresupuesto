import { BaseRepository } from "@/lib/base-repository";
import { CategoryExpense, DashboardSummary, MonthlySummary } from "@/types/analytics";

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

	async getDashboardSummary(): Promise<DashboardSummary> {
		try {
			const data = await this.get<DashboardSummary>("/analytics/dashboard-summary");
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
