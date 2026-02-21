export interface CategoryExpense {
	id: string
	label: string
	value: number
	color: string
	transaction_count: number
	dop_total: number
	usd_total: number
}

export interface MonthlySummary {
	month: string
	Ingresos: number
	Gastos: number
}

export interface DashboardSummary {
	total_income: number
	total_expenses: number
	net_amount: number
	usd_to_dop_rate: number
	accounts_total: number
	investments_total: number
	certificates_total: number
	accounts_count: number
	investments_count: number
	certificates_count: number
	category_expenses: CategoryExpense[]
	monthly_summary: MonthlySummary[]
}

export interface AnalyticsQueryFilters {
	date_from?: string
	date_to?: string
	account_id?: string
	category_id?: string
	type?: 'income' | 'bill'
}
