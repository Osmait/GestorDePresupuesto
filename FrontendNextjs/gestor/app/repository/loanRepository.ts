import { BaseRepository } from '@/lib/base-repository'
import { CreateLoanDTO, Loan, LoanDetails, LoanPayment, LoanSummary, RegisterLoanPaymentDTO } from '@/types/loan'

export class LoanRepository extends BaseRepository {
	async findAll(): Promise<Loan[]> {
		return this.get<Loan[]>('/loan')
	}

	async findById(id: string): Promise<LoanDetails> {
		return this.get<LoanDetails>(`/loan/${id}`)
	}

	async create(data: CreateLoanDTO): Promise<Loan> {
		return this.post<Loan>('/loan', data) as Promise<Loan>
	}

	async registerPayment(id: string, data: RegisterLoanPaymentDTO): Promise<LoanPayment> {
		return this.post<LoanPayment>(`/loan/${id}/payments`, data) as Promise<LoanPayment>
	}

	async updateStatus(id: string, status: Loan['status']): Promise<void> {
		return this.patch(`/loan/${id}/status`, { status })
	}

	async getSummary(): Promise<LoanSummary> {
		return this.get<LoanSummary>('/loan/summary')
	}
}

export const loanRepository = new LoanRepository()
