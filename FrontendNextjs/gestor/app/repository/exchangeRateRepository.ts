import { BaseRepository } from '@/lib/base-repository'
import { ConvertResponse, ExchangeRateResponse } from '@/types/exchange'

export class ExchangeRateRepository extends BaseRepository {
	async getRate(): Promise<ExchangeRateResponse> {
		return this.get<ExchangeRateResponse>('/exchange/rate')
	}

	async convert(amount: number): Promise<ConvertResponse> {
		return this.get<ConvertResponse>(`/exchange/convert?amount=${amount}`)
	}
}

let exchangeRateRepositoryInstance: ExchangeRateRepository | null = null

export const getExchangeRateRepository = async () => {
	if (!exchangeRateRepositoryInstance) {
		exchangeRateRepositoryInstance = new ExchangeRateRepository()
	}
	return exchangeRateRepositoryInstance
}

export const exchangeRateRepository = new ExchangeRateRepository()
