import { roundDeep, toApiDate } from '@/lib/analysisReport'
import type { AnalysisReportData } from './useAnalysisReport'

/**
 * JSON snapshot of the report as shown (every amount in DOP, rounded to
 * cents so the file has no float noise such as 1234.5600000000002).
 */
export function buildExportSnapshot(report: AnalysisReportData, accountId: string | undefined, now = new Date()) {
	const { resolved } = report
	return roundDeep({
		generated_at: now.toISOString(),
		currency: 'DOP',
		period: {
			mode: resolved.period.mode,
			from: toApiDate(resolved.range.from),
			to: toApiDate(resolved.range.to),
			in_progress: resolved.inProgress,
			comparison_from: toApiDate(resolved.comparison.from),
			comparison_to: toApiDate(resolved.comparison.to),
		},
		account_id: accountId ?? null,
		totals: {
			income: report.income,
			expenses: report.expenses,
			net: report.income - report.expenses,
			previous_income: report.previousIncome,
			previous_expenses: report.previousExpenses,
			expense_change_percent: report.expenseDelta,
		},
		fixed_variable: report.plan ? { fixed: report.plan.split.fixed, variable: report.plan.split.variable } : null,
		categories: report.categories.map((category) => ({
			id: category.id,
			label: category.label,
			amount: category.value,
			transactions: category.transaction_count,
		})),
		changes: report.changes.changed.map((change) => ({
			label: change.label,
			current: change.current,
			previous: change.previous,
			delta: change.delta,
		})),
		budgets:
			report.budgets?.map((row) => ({
				category: row.label,
				spent: row.spent,
				budget: row.budget,
				estimated_close: row.estimatedClose,
				status: row.status,
			})) ?? null,
		monthly_trend: report.trend.map((month) => ({
			month: month.key,
			income: month.income,
			expenses: month.expenses,
			savings_rate_percent: month.savingsRate,
			in_progress: month.inProgress,
		})),
	})
}
