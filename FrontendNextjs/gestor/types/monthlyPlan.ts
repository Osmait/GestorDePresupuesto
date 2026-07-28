export type MonthlyPlanItemType = 'income' | 'bill'
export type MonthlyPlanCurrency = 'DOP' | 'USD'

export interface MonthlyPlanItem {
	id: string
	user_id: string
	name: string
	description: string
	amount: number
	/** `amount` already converted to DOP by the backend. */
	amount_dop: number
	currency: MonthlyPlanCurrency
	type: MonthlyPlanItemType
	category_id?: string
	account_id?: string
	day_of_month?: number
	is_active: boolean
	created_at: string
}

export interface MonthlyPlanItemRequest {
	name: string
	description: string
	amount: number
	currency: MonthlyPlanCurrency
	type: MonthlyPlanItemType
	category_id?: string
	account_id?: string
	day_of_month?: number
	is_active?: boolean
}

/** Totals of the plan, all amounts in DOP. Computed by the backend. */
export interface MonthlyPlanSummary {
	total_income: number
	total_expenses: number
	/** Income minus expenses. Negative means the plan does not add up. */
	available: number
	/** Share of the expected income already taken by fixed expenses. */
	committed_percentage: number
	usd_to_dop_rate: number
	income_count: number
	expenses_count: number
}
