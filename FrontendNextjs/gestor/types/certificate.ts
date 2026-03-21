export type InterestType = 'simple' | 'compound'
export type CertificateStatus = 'active' | 'matured' | 'cancelled'

export interface Certificate {
	id: string
	bank: string
	base_capital: number
	interest_type: InterestType
	current_interest_rate: number
	current_tax_rate: number
	cut_day: number
	reinvest_interest: boolean
	payout_account_id?: string
	maturity_date?: string
	status: CertificateStatus
	currency: string
	created_at: string
	updated_at: string
	effective_capital: number
	next_payment_date?: string
	projected_payment?: ProjectedPayment
}

export interface ProjectedPayment {
	gross_interest: number
	tax_withheld: number
	net_interest: number
}

export interface CertificatePayment {
	id: string
	certificate_id: string
	payment_date: string
	period_start: string
	period_end: string
	gross_interest: number
	tax_withheld: number
	net_interest: number
	applied_rate: number
	applied_tax_rate: number
	applied_capital: number
	transaction_id?: string
	created_at: string
	updated_at?: string
}

export interface CertificateSummary {
	total_capital: number
	total_gross_interest: number
	total_tax_withheld: number
	total_net_interest: number
	portfolio_value: number
	active_certificates: number
}

export interface CertificateWithHistory extends Certificate {
	payments: CertificatePayment[]
	summary: CertificateSummary
}

export interface CreateCertificateDTO {
	bank: string
	base_capital: number
	interest_type: InterestType
	current_interest_rate: number
	current_tax_rate: number
	cut_day: number
	reinvest_interest: boolean
	payout_account_id?: string
	maturity_date?: string
	currency?: string
}

export interface UpdateCertificateDTO {
	bank?: string
	base_capital?: number
	current_interest_rate?: number
	current_tax_rate?: number
	cut_day?: number
	reinvest_interest?: boolean
	payout_account_id?: string
	status?: CertificateStatus
}

export interface UpdateCertificatePaymentDTO {
	payment_date?: string
	period_start?: string
	period_end?: string
	gross_interest?: number
	tax_withheld?: number
	net_interest?: number
	applied_rate?: number
	applied_tax_rate?: number
	applied_capital?: number
}

export interface SimulatePaymentDTO {
	capital?: number
	rate?: number
	tax_rate?: number
	months?: number
}

export interface SimulationResult {
	payments: ProjectedPayment[]
	totals: {
		gross_interest: number
		tax_withheld: number
		net_interest: number
	}
}

export function calculateMonthlyPayment(capital: number, rate: number, taxRate: number): ProjectedPayment {
	const grossInterest = (capital * (rate / 100)) / 12
	const taxWithheld = grossInterest * (taxRate / 100)
	const netInterest = grossInterest - taxWithheld

	return {
		gross_interest: Math.round(grossInterest * 100) / 100,
		tax_withheld: Math.round(taxWithheld * 100) / 100,
		net_interest: Math.round(netInterest * 100) / 100,
	}
}

export function formatCurrency(amount: number, currency: string = 'DOP'): string {
	return new Intl.NumberFormat('es-DO', {
		style: 'currency',
		currency,
	}).format(amount)
}

export function getInterestTypeLabel(type: InterestType): string {
	return type === 'simple' ? 'Simple' : 'Compound'
}

export function getStatusLabel(status: CertificateStatus): string {
	switch (status) {
		case 'active':
			return 'Active'
		case 'matured':
			return 'Matured'
		case 'cancelled':
			return 'Cancelled'
		default:
			return status
	}
}
