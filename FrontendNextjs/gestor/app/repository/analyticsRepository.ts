import { BaseRepository } from "@/lib/base-repository";
import { CategoryExpense, MonthlySummary } from "@/types/analytics";

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
}