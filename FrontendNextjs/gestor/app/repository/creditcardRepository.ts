import { BaseRepository } from '@/lib/base-repository'
import {
	CardBalance,
	CardPayment,
	CreateCreditCardDTO,
	CreatePaymentDTO,
	CreditCard,
	CreditCardSummary,
	UpdateBalanceDTO,
	UpdateCreditCardDTO,
} from '@/types/creditcard'

export class CreditCardRepository extends BaseRepository {
	async findAll(): Promise<CreditCard[]> {
		return this.get<CreditCard[]>('/credit-cards') as Promise<CreditCard[]>
	}

	async findById(id: string): Promise<CreditCard> {
		return this.get<CreditCard>(`/credit-cards/${id}`) as Promise<CreditCard>
	}

	async create(data: CreateCreditCardDTO): Promise<CreditCard> {
		return this.post<CreditCard>('/credit-cards', data) as Promise<CreditCard>
	}

	async update(id: string, data: UpdateCreditCardDTO): Promise<CreditCard> {
		return this.put<CreditCard>(`/credit-cards/${id}`, data) as Promise<CreditCard>
	}

	async delete(id: string): Promise<void> {
		return this.deleteRequest(`/credit-cards/${id}`)
	}

	async getSummary(): Promise<CreditCardSummary> {
		return this.get<CreditCardSummary>('/credit-cards/summary') as Promise<CreditCardSummary>
	}

	async updateBalance(cardId: string, balanceId: string, data: UpdateBalanceDTO): Promise<CardBalance> {
		return this.put<CardBalance>(`/credit-cards/${cardId}/balances/${balanceId}`, data) as Promise<CardBalance>
	}

	async createPayment(cardId: string, data: CreatePaymentDTO): Promise<CardPayment> {
		return this.post<CardPayment>(`/credit-cards/${cardId}/payments`, data) as Promise<CardPayment>
	}

	async getPayments(cardId: string): Promise<CardPayment[]> {
		return this.get<CardPayment[]>(`/credit-cards/${cardId}/payments`) as Promise<CardPayment[]>
	}
}

let creditCardRepositoryInstance: CreditCardRepository | null = null

export const getCreditCardRepository = async () => {
	if (!creditCardRepositoryInstance) {
		creditCardRepositoryInstance = new CreditCardRepository()
	}
	return creditCardRepositoryInstance
}

export const creditCardRepository = new CreditCardRepository()
