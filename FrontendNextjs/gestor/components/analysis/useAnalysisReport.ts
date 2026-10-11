'use client'

import { useMemo } from 'react'
import { useGetDashboardSummary } from '@/hooks/queries/useAnalyticsQuery'
import { useGetBudgets } from '@/hooks/queries/useBudgetsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { useMonthlyPlanItems } from '@/hooks/queries/useMonthlyPlanQuery'
import { useGetTransactions } from '@/hooks/queries/useTransactionsQuery'
import {
	type AnalysisPeriod,
	activePlanItems,
	buildMonthlyTrend,
	type CategoryChange,
	computeCategoryChanges,
	daysInMonth,
	endMonthOf,
	estimateMonthClose,
	matchesPlanItem,
	nextIncomeDay,
	type PaceStatus,
	type PlanProgress,
	paceStatus,
	percentDelta,
	pickTopExpenses,
	type ResolvedPeriod,
	resolvePeriod,
	roundMoney,
	savingsSeries,
	splitFixedVariableByCategory,
	splitPlanByDay,
	type TrendMonth,
	toApiDate,
	trendRange,
} from '@/lib/analysisReport'
import type { AnalyticsQueryFilters, CategoryExpense, DashboardSummary } from '@/types/analytics'
import type { Budget } from '@/types/budget'
import type { Category } from '@/types/category'
import type { MonthlyPlanItem } from '@/types/monthlyPlan'
import type { Transaction } from '@/types/transaction'

/** How many transactions are fetched to pick the top 5 (the API sorts by raw amount, mixing currencies). */
const TOP_EXPENSES_FETCH = 10
const TOP_EXPENSES_COUNT = 5
const PACE_STATUS_ORDER: Record<PaceStatus, number> = { over: 0, fast: 1, tight: 2, ok: 3 }

export interface MonthPlanReport {
	year: number
	month: number
	/** Day of the month the data goes up to. */
	day: number
	daysInMonth: number
	bills: PlanProgress
	/** Fixed vs variable of what was spent in the period. */
	split: { fixed: number; variable: number }
	previousSplit: { fixed: number; variable: number }
}

export interface BudgetPaceRow {
	id: string
	categoryId: string
	label: string
	color?: string
	spent: number
	budget: number
	estimatedClose: number
	status: PaceStatus
	/** Plan bills of the category still due this month. */
	remainingPlanNames: string[]
}

export interface TopExpense extends Transaction {
	amountDop: number
	fromPlan: boolean
	categoryName?: string
	categoryColor?: string
}

export interface AnalysisReportData {
	resolved: ResolvedPeriod
	income: number
	expenses: number
	previousIncome: number
	previousExpenses: number
	/** Expense change vs the comparison, in percent (null without previous spend). */
	expenseDelta: number | null
	categories: CategoryExpense[]
	changes: { changed: CategoryChange[]; unchanged: CategoryChange[] }
	/** Month mode only, and only when the plan has bills (for the account filter). */
	plan: MonthPlanReport | null
	hasPlanBills: boolean
	/** Month mode only: income expected from the plan and the next day one is due (current month). */
	incomePlan: { expected: number; nextDay: number | null } | null
	perDay: { current: number; previous: number; variableOnly: boolean }
	trend: TrendMonth[]
	savings: ReturnType<typeof savingsSeries>
	/** Month mode only; null in year/range mode (a monthly budget is not compared with a year). */
	budgets: BudgetPaceRow[] | null
	hasActivity: boolean
}

function toFilters(from: Date, to: Date, accountId?: string): AnalyticsQueryFilters {
	return { date_from: toApiDate(from), date_to: toApiDate(to), ...(accountId ? { account_id: accountId } : {}) }
}

interface BuildInput {
	resolved: ResolvedPeriod
	today: Date
	accountId?: string
	summary: DashboardSummary
	previous: DashboardSummary
	trendSummary?: DashboardSummary
	planItems: MonthlyPlanItem[]
	budgets: Budget[]
	categories: Category[]
}

/** Every number of the report, from the raw API payloads. Pure (exported for tests). */
export function buildAnalysisReport({
	resolved,
	today,
	accountId,
	summary,
	previous,
	trendSummary,
	planItems,
	budgets,
	categories,
}: BuildInput): AnalysisReportData {
	const income = roundMoney(summary.total_income || 0)
	const expenses = roundMoney(summary.total_expenses || 0)
	const previousIncome = roundMoney(previous.total_income || 0)
	const previousExpenses = roundMoney(previous.total_expenses || 0)
	const currentCategories = [...(summary.category_expenses ?? [])].sort((a, b) => b.value - a.value)
	const changes = computeCategoryChanges(currentCategories, previous.category_expenses ?? [])

	const bills = activePlanItems(planItems, 'bill', accountId)
	const incomeItems = activePlanItems(planItems, 'income', accountId)
	const { period } = resolved

	let plan: MonthPlanReport | null = null
	if (period.mode === 'month' && bills.length > 0) {
		const day = resolved.range.to.getDate()
		const progress = splitPlanByDay(bills, period.year, period.month, day)
		const prevYear = resolved.comparison.to.getFullYear()
		const prevMonth = resolved.comparison.to.getMonth() + 1
		const previousDue = splitPlanByDay(bills, prevYear, prevMonth, resolved.comparison.to.getDate()).due
		plan = {
			year: period.year,
			month: period.month,
			day,
			daysInMonth: daysInMonth(period.year, period.month),
			bills: progress,
			split: splitFixedVariableByCategory(expenses, currentCategories, progress.due),
			previousSplit: splitFixedVariableByCategory(previousExpenses, previous.category_expenses ?? [], previousDue),
		}
	}

	const incomePlan =
		period.mode === 'month' && incomeItems.length > 0
			? {
					expected: roundMoney(incomeItems.reduce((sum, item) => sum + (item.amount_dop || 0), 0)),
					nextDay: resolved.inProgress
						? nextIncomeDay(incomeItems, period.year, period.month, resolved.range.to.getDate())
						: null,
				}
			: null

	const perDay = plan
		? {
				current: plan.split.variable / resolved.elapsedDays,
				previous: plan.previousSplit.variable / resolved.comparisonDays,
				variableOnly: true,
			}
		: {
				current: expenses / resolved.elapsedDays,
				previous: previousExpenses / resolved.comparisonDays,
				variableOnly: false,
			}

	const trend = buildMonthlyTrend(trendSummary?.monthly_summary ?? [], endMonthOf(resolved), today)

	let budgetRows: BudgetPaceRow[] | null = null
	if (period.mode === 'month') {
		const day = resolved.range.to.getDate()
		const length = daysInMonth(period.year, period.month)
		const spentByCategory = new Map(currentCategories.map((item) => [item.id, Math.abs(item.value)]))
		budgetRows = budgets
			.map((budget) => {
				const category = categories.find((item) => item.id === budget.category_id)
				const categoryBills = bills.filter((bill) => bill.category_id === budget.category_id)
				const split = splitPlanByDay(categoryBills, period.year, period.month, day)
				const spent = roundMoney(spentByCategory.get(budget.category_id) ?? 0)
				const estimatedClose = estimateMonthClose({
					spent,
					day,
					daysInMonth: length,
					planDue: split.dueAmount,
					planRemaining: split.remainingAmount,
				})
				return {
					id: budget.id,
					categoryId: budget.category_id,
					label: category?.name || budget.category_name || '',
					color: category?.color,
					spent,
					budget: roundMoney(budget.amount),
					estimatedClose,
					status: paceStatus(spent, estimatedClose, budget.amount),
					remainingPlanNames: split.remaining.map((item) => item.name),
				}
			})
			.sort(
				(a, b) =>
					PACE_STATUS_ORDER[a.status] - PACE_STATUS_ORDER[b.status] ||
					b.estimatedClose / (b.budget || 1) - a.estimatedClose / (a.budget || 1),
			)
	}

	return {
		resolved,
		income,
		expenses,
		previousIncome,
		previousExpenses,
		expenseDelta: percentDelta(expenses, previousExpenses),
		categories: currentCategories,
		changes,
		plan,
		hasPlanBills: bills.length > 0,
		incomePlan,
		perDay,
		trend,
		savings: savingsSeries(trend),
		budgets: budgetRows,
		hasActivity: income > 0 || expenses > 0 || currentCategories.some((item) => item.value !== 0),
	}
}

/**
 * Loads everything the report needs for a period and account and derives the
 * numbers. The three analytics queries gate the page (loading/error); plan,
 * budgets and the largest expenses load per section.
 */
export function useAnalysisReport(period: AnalysisPeriod, today: Date, accountId?: string) {
	const todayKey = today.getTime()
	const resolved = useMemo(() => resolvePeriod(period, new Date(todayKey)), [period, todayKey])

	const currentFilters = useMemo(
		() => toFilters(resolved.range.from, resolved.range.to, accountId),
		[resolved, accountId],
	)
	const comparisonFilters = useMemo(
		() => toFilters(resolved.comparison.from, resolved.comparison.to, accountId),
		[resolved, accountId],
	)
	const trendFilters = useMemo(() => {
		const range = trendRange(resolved)
		return toFilters(range.from, range.to, accountId)
	}, [resolved, accountId])

	const summaryQuery = useGetDashboardSummary(currentFilters)
	const previousQuery = useGetDashboardSummary(comparisonFilters)
	const trendQuery = useGetDashboardSummary(trendFilters)
	const planQuery = useMonthlyPlanItems()
	const budgetsQuery = useGetBudgets()
	const categoriesQuery = useGetCategories()
	const topQuery = useGetTransactions({
		type: 'bill',
		date_from: currentFilters.date_from,
		date_to: currentFilters.date_to,
		account_id: accountId,
		sort_by: 'amount',
		sort_order: 'desc',
		page: 1,
		limit: TOP_EXPENSES_FETCH,
	})

	const queries = [summaryQuery, previousQuery, trendQuery]
	const isLoading = queries.some((query) => query.isLoading)
	const isError = queries.some((query) => query.isError)
	const refetch = () => {
		for (const query of queries) if (query.isError) void query.refetch()
	}

	const planItems = planQuery.data
	const budgets = budgetsQuery.data
	const categories = categoriesQuery.data
	const report = useMemo(() => {
		if (!summaryQuery.data || !previousQuery.data) return null
		return buildAnalysisReport({
			resolved,
			today: new Date(todayKey),
			accountId,
			summary: summaryQuery.data,
			previous: previousQuery.data,
			trendSummary: trendQuery.data,
			planItems: planItems ?? [],
			budgets: budgets ?? [],
			categories: categories ?? [],
		})
	}, [
		resolved,
		todayKey,
		accountId,
		summaryQuery.data,
		previousQuery.data,
		trendQuery.data,
		planItems,
		budgets,
		categories,
	])

	const usdToDop = summaryQuery.data?.usd_to_dop_rate ?? 0
	const topExpenses = useMemo<TopExpense[]>(() => {
		const transactions = topQuery.data?.transactions ?? []
		const bills = activePlanItems(planItems ?? [], 'bill')
		return pickTopExpenses(transactions, usdToDop, TOP_EXPENSES_COUNT).map((transaction) => {
			const category = categories?.find((item) => item.id === transaction.category_id)
			return {
				...transaction,
				fromPlan: matchesPlanItem(transaction, bills, usdToDop),
				categoryName: category?.name,
				categoryColor: category?.color,
			}
		})
	}, [topQuery.data, planItems, categories, usdToDop])

	return {
		resolved,
		filters: currentFilters,
		report,
		isLoading,
		isError,
		refetch,
		planLoading: planQuery.isLoading,
		budgetsLoading: budgetsQuery.isLoading,
		budgetsError: budgetsQuery.isError,
		refetchBudgets: () => budgetsQuery.refetch(),
		topExpenses,
		// The list keeps the previous page while a new period loads; show the skeleton instead of stale rows.
		topLoading: topQuery.isLoading || topQuery.isPlaceholderData,
	}
}
