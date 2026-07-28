import { BaseRepository } from '@/lib/base-repository'
import { MonthlyPlanItem, MonthlyPlanItemRequest, MonthlyPlanSummary } from '@/types/monthlyPlan'

const EMPTY_SUMMARY: MonthlyPlanSummary = {
	total_income: 0,
	total_expenses: 0,
	available: 0,
	committed_percentage: 0,
	usd_to_dop_rate: 0,
	income_count: 0,
	expenses_count: 0,
}

export class MonthlyPlanRepository extends BaseRepository {
	async findAll(): Promise<MonthlyPlanItem[]> {
		try {
			const response = await this.get<MonthlyPlanItem[]>('/monthly-plan')
			return response ?? []
		} catch (error) {
			console.error('Error fetching monthly plan items:', error)
			return []
		}
	}

	async getSummary(): Promise<MonthlyPlanSummary> {
		try {
			const response = await this.get<MonthlyPlanSummary>('/monthly-plan/summary')
			return response ?? EMPTY_SUMMARY
		} catch (error) {
			console.error('Error fetching monthly plan summary:', error)
			return EMPTY_SUMMARY
		}
	}

	async create(data: MonthlyPlanItemRequest): Promise<void> {
		try {
			await this.post('/monthly-plan', data)
		} catch (error) {
			console.error('Error creating monthly plan item:', error)
			throw error
		}
	}

	async update(id: string, data: MonthlyPlanItemRequest): Promise<void> {
		try {
			await this.put(`/monthly-plan/${id}`, data)
		} catch (error) {
			console.error('Error updating monthly plan item:', error)
			throw error
		}
	}

	async setActive(id: string, isActive: boolean): Promise<void> {
		try {
			await this.patch(`/monthly-plan/${id}/active`, { is_active: isActive })
		} catch (error) {
			console.error('Error toggling monthly plan item:', error)
			throw error
		}
	}

	async delete(id: string): Promise<void> {
		try {
			await this.deleteRequest(`/monthly-plan/${id}`)
		} catch (error) {
			console.error('Error deleting monthly plan item:', error)
			throw error
		}
	}
}
