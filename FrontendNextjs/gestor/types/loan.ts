export type LoanStatus = 'active' | 'paid' | 'defaulted' | 'cancelled'
export type LoanInterestMode = 'fixed_total' | 'none'
export type LoanInstallmentStatus = 'pending' | 'partial' | 'paid' | 'overdue'

export interface Loan {
	id: string
	borrower_name: string
	borrower_contact: string
	principal_amount: number
	currency: string
	interest_mode: LoanInterestMode
	annual_rate: number
	term_months: number
	start_date: string
	source_account_id: string
	notes: string
	total_interest: number
	total_amount: number
	paid_principal: number
	paid_interest: number
	pending_amount: number
	status: LoanStatus
	created_at: string
	updated_at: string
}

export interface LoanInstallment {
	id: string
	installment_number: number
	due_date: string
	expected_amount: number
	paid_amount: number
	status: LoanInstallmentStatus
	paid_at?: string | null
}

export interface LoanPayment {
	id: string
	destination_account_id: string
	amount: number
	principal_component: number
	interest_component: number
	payment_date: string
	notes: string
	created_at: string
}

export interface LoanDetails {
	loan: Loan
	installments: LoanInstallment[]
	payments: LoanPayment[]
}

export interface LoanSummary {
	total_principal: number
	total_pending: number
	total_collected: number
	total_interest_earned: number
	overdue_loans: number
	active_loans: number
}

export interface CreateLoanDTO {
	borrower_name: string
	borrower_contact?: string
	principal_amount: number
	currency?: string
	interest_mode: LoanInterestMode
	annual_rate: number
	term_months: number
	start_date?: string
	source_account_id: string
	notes?: string
}

export interface RegisterLoanPaymentDTO {
	destination_account_id: string
	amount: number
	payment_date?: string
	notes?: string
}
