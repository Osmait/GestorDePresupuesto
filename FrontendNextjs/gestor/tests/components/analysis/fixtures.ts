import { buildAnalysisReport } from '@/components/analysis/useAnalysisReport'
import { type AnalysisPeriod, fromApiDate, resolvePeriod } from '@/lib/analysisReport'
import type { CategoryExpense, DashboardSummary } from '@/types/analytics'
import type { Budget } from '@/types/budget'
import type { Category } from '@/types/category'
import type { MonthlyPlanItem } from '@/types/monthlyPlan'

export const TODAY = fromApiDate('2026-10-11') as Date

const COLORS: Record<string, string> = {
	rent: '#2a78d6',
	food: '#e87ba4',
	transport: '#eb6834',
	fun: '#a16207',
	health: '#0e7490',
	services: '#1baf7a',
}
const LABELS: Record<string, string> = {
	rent: 'Housing',
	food: 'Food',
	transport: 'Transport',
	fun: 'Entertainment',
	health: 'Health',
	services: 'Services',
}

function expense(id: string, value: number): CategoryExpense {
	return {
		id,
		label: LABELS[id],
		value,
		color: COLORS[id],
		transaction_count: 2,
		dop_total: value,
		usd_total: 0,
	}
}

export function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
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
		...overrides,
	}
}

export const CURRENT = summary({
	total_income: 0,
	total_expenses: 70100,
	category_expenses: [
		expense('rent', 45000),
		expense('food', 12300),
		expense('transport', 6800),
		expense('fun', 3200),
		expense('services', 2800),
	],
})

export const PREVIOUS = summary({
	total_income: 100000,
	total_expenses: 68950,
	category_expenses: [
		expense('rent', 45000),
		expense('food', 8200),
		expense('transport', 9400),
		expense('health', 4250),
		expense('fun', 1300),
		expense('services', 800),
	],
})

export const TREND = summary({
	monthly_summary: [
		{ month: '2026-05', Ingresos: 100000, Gastos: 80000 },
		{ month: '2026-06', Ingresos: 100000, Gastos: 70000 },
		{ month: '2026-07', Ingresos: 100000, Gastos: 90000 },
		{ month: '2026-08', Ingresos: 100000, Gastos: 75000 },
		{ month: '2026-09', Ingresos: 100000, Gastos: 68950 },
		{ month: '2026-10', Ingresos: 0, Gastos: 70100 },
	],
})

export function planItem(overrides: Partial<MonthlyPlanItem>): MonthlyPlanItem {
	return {
		id: 'p',
		user_id: 'u1',
		name: 'Item',
		description: '',
		amount: 0,
		amount_dop: 0,
		currency: 'DOP',
		type: 'bill',
		is_active: true,
		created_at: '2026-01-01T00:00:00Z',
		...overrides,
	}
}

export const PLAN: MonthlyPlanItem[] = [
	planItem({ id: 'rent', name: 'Rent', amount_dop: 45000, day_of_month: 1, category_id: 'rent' }),
	planItem({ id: 'power', name: 'Power', amount_dop: 2500, day_of_month: 12, category_id: 'services' }),
	planItem({ id: 'water', name: 'Water', amount_dop: 800, day_of_month: 15, category_id: 'services' }),
	planItem({ id: 'phone', name: 'Phone', amount_dop: 1500, day_of_month: 20, category_id: 'services' }),
	planItem({ id: 'salary', name: 'Salary', type: 'income', amount_dop: 100000, day_of_month: 15 }),
]

export const BUDGETS: Budget[] = [
	{ id: 'b1', category_id: 'fun', user_id: 'u1', amount: 5000, current_amount: 0, created_at: '' },
	{ id: 'b2', category_id: 'food', user_id: 'u1', amount: 35000, current_amount: 0, created_at: '' },
	{ id: 'b3', category_id: 'services', user_id: 'u1', amount: 30000, current_amount: 0, created_at: '' },
]

export const CATEGORIES: Category[] = Object.keys(LABELS).map((id) => ({
	id,
	name: LABELS[id],
	color: COLORS[id],
	icon: '',
	created_at: '',
}))

export function makeReport({
	period = { mode: 'month', year: 2026, month: 10 } as AnalysisPeriod,
	plan = PLAN,
	budgets = BUDGETS,
	current = CURRENT,
	previous = PREVIOUS,
}: {
	period?: AnalysisPeriod
	plan?: MonthlyPlanItem[]
	budgets?: Budget[]
	current?: DashboardSummary
	previous?: DashboardSummary
} = {}) {
	return buildAnalysisReport({
		resolved: resolvePeriod(period, TODAY),
		today: TODAY,
		summary: current,
		previous,
		trendSummary: TREND,
		planItems: plan,
		budgets,
		categories: CATEGORIES,
	})
}
