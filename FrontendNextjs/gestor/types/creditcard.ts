export type PaymentStatus = 'pending' | 'completed' | 'cancelled'

export interface CardBalance {
	id: string
	currency: string
	current_balance: number
	credit_limit: number
	available_credit: number
	utilization_percent: number
	created_at: string
	updated_at: string
}

export interface CardPayment {
	id: string
	card_id: string
	from_account_id: string
	currency: string
	amount: number
	source_currency?: string
	source_amount?: number
	exchange_rate?: number
	includes_interest: boolean
	interest_amount: number
	payment_date: string
	status: PaymentStatus
	notes: string
	created_at: string
}

export interface CreditCard {
	id: string
	name: string
	bank: string
	last_four_digits: string
	cut_day: number
	due_day: number
	balances: CardBalance[]
	next_cut_date?: string
	next_due_date?: string
	created_at: string
	updated_at: string
}

export interface CreditCardSummary {
	total_cards: number
	total_debt: Record<string, number>
	total_credit_limit: Record<string, number>
	avg_utilization: Record<string, number>
	by_card: CreditCard[]
}

export interface CreateCreditCardDTO {
	name: string
	bank: string
	last_four_digits?: string
	cut_day: number
	due_day: number
	balances: CreateBalanceDTO[]
}

export interface CreateBalanceDTO {
	currency: string
	credit_limit: number
	initial_debt?: number
}

export interface UpdateCreditCardDTO {
	name?: string
	bank?: string
	last_four_digits?: string
	cut_day?: number
	due_day?: number
}

export interface UpdateBalanceDTO {
	credit_limit?: number
}

/** A credit limit changed in the edit form, saved with PUT /credit-cards/:id/balances/:balanceId. */
export interface CreditLimitChange {
	balanceId: string
	credit_limit: number
}

/**
 * What the edit form saves. PUT /credit-cards/:id only takes the card fields; limits go
 * through the balance endpoint and the debt only changes by reconciling the card.
 */
export interface UpdateCreditCardInput {
	card: UpdateCreditCardDTO
	creditLimits: CreditLimitChange[]
}

export interface CreatePaymentDTO {
	from_account_id: string
	currency: string
	amount: number
	exchange_rate?: number
	includes_interest?: boolean
	interest_amount?: number
	notes?: string
}

export function formatCurrency(amount: number, currency: string = 'DOP'): string {
	return new Intl.NumberFormat('es-DO', {
		style: 'currency',
		currency,
	}).format(amount)
}
