'use client'

import { useQuery } from '@tanstack/react-query'
import { getExchangeRateRepository } from '@/app/repository/exchangeRateRepository'
import { ExchangeRateResponse } from '@/types/exchange'

export const EXCHANGE_KEYS = {
	rate: ['exchange', 'rate'] as const,
}

export function useExchangeRateQuery() {
	return useQuery({
		queryKey: EXCHANGE_KEYS.rate,
		queryFn: async (): Promise<ExchangeRateResponse> => {
			const repo = await getExchangeRateRepository()
			return repo.getRate()
		},
		staleTime: 1000 * 60 * 60, // 1 hour
		gcTime: 1000 * 60 * 60 * 2, // 2 hours
	})
}
