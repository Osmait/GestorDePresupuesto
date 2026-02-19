export interface ExchangeRateResponse {
	usd_to_dop: number
	last_updated: string
}

export interface ConvertResponse {
	usd: number
	dop: number
	rate: number
}

export function formatExchangeRate(rate: number): string {
	return rate.toFixed(2)
}
