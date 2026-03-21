import { BaseRepository } from '@/lib/base-repository'
import {
	CreateInvestmentDTO,
	FundBrokerDTO,
	FundingBalance,
	Investment,
	InvestmentFilters,
	UpdateInvestmentDTO,
} from '@/types/investment'

export class InvestmentRepository extends BaseRepository {
	async findAll(filters?: InvestmentFilters): Promise<Investment[]> {
		try {
			const queryParams = new URLSearchParams()
			if (filters?.user_id) {
				queryParams.append('user_id', filters.user_id)
			}

			const response = await this.get<Investment[]>(
				`/investments${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
			)
			return response
		} catch (error) {
			console.error('Error fetching investments:', error)
			return []
		}
	}

	async findById(id: string): Promise<Investment | null> {
		try {
			return await this.get<Investment>(`/investments/${id}`)
		} catch (error) {
			console.error('Error fetching investment by id:', error)
			return null
		}
	}

	async create(investment: CreateInvestmentDTO): Promise<void> {
		try {
			await this.post('/investments', investment)
		} catch (error) {
			console.error('Error creating investment:', error)
			throw error
		}
	}

	async fundBroker(payload: FundBrokerDTO): Promise<void> {
		try {
			await this.post('/investments/funding', payload)
		} catch (error) {
			console.error('Error funding broker:', error)
			throw error
		}
	}

	async getFundingBalances(): Promise<FundingBalance[]> {
		try {
			return await this.get<FundingBalance[]>('/investments/funding/balances')
		} catch (error) {
			console.error('Error fetching funding balances:', error)
			return []
		}
	}

	async update(investment: UpdateInvestmentDTO): Promise<void> {
		try {
			await this.put(`/investments`, investment)
		} catch (error) {
			console.error('Error updating investment:', error)
			throw error
		}
	}

	async delete(id: string): Promise<void> {
		try {
			await this.deleteRequest(`/investments/${id}`)
		} catch (error) {
			console.error('Error deleting investment:', error)
			throw error
		}
	}

	async getQuote(symbol: string): Promise<{ regular_market_price: number; symbol: string; name?: string } | null> {
		try {
			return await this.get<{ regular_market_price: number; symbol: string; name?: string }>(`/quotes/${symbol}`)
		} catch (error) {
			console.error('Error fetching quote:', error)
			return null
		}
	}
}
