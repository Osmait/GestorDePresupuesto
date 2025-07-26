export interface CategoryExpense {
	id: string
	label: string
	value: number
	color: string
}

export interface MonthlySummary {
	month: string
	Ingresos: number
	Gastos: number
}