import type { Investment } from '@/types/investment'
import type { Transaction } from '@/types/transaction'

/** A positive USD->DOP rate, or null when it is missing (never a silent 0). */
export function usableRate(rate: number | null | undefined): number | null {
	return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null
}

/** Settlement currency of a position (USD when unset, like the API). */
export function positionCurrency(investment: Pick<Investment, 'settlement_currency'>): string {
	return (investment.settlement_currency || 'USD').trim().toUpperCase() || 'USD'
}

export interface CardDebtTotals {
	/** DOP debt plus USD debt converted; USD left out when the rate is missing. */
	totalDebt: number
	/** False when there is USD debt or limit and no rate to convert it. */
	usdIncluded: boolean
	/** Debt / limit in %, or null when it cannot be computed (no rate for USD amounts, or no limit). */
	utilization: number | null
}

/**
 * Totals of the credit cards in DOP. USD amounts are converted at `rate`;
 * without a rate they cannot be added, so the total says so instead of
 * counting them as 0.
 */
export function cardDebtTotals({
	debtDop,
	debtUsd,
	limitDop,
	limitUsd,
	rate,
}: {
	debtDop: number
	debtUsd: number
	limitDop: number
	limitUsd: number
	rate: number | null | undefined
}): CardDebtTotals {
	const usable = usableRate(rate)
	const hasUsd = debtUsd > 0 || limitUsd > 0
	if (usable === null && hasUsd) {
		return { totalDebt: debtDop, usdIncluded: false, utilization: null }
	}
	const fx = usable ?? 0
	const totalDebt = debtDop + debtUsd * fx
	const totalLimit = limitDop + limitUsd * fx
	return { totalDebt, usdIncluded: true, utilization: totalLimit > 0 ? (totalDebt / totalLimit) * 100 : null }
}

export interface PortfolioMetrics {
	/** Market value, in USD (DOP positions converted at the rate). */
	totalValue: number
	/** Cost, in USD. */
	totalCost: number
	totalProfit: number
	roi: number
	/** Market value per investment type, in USD. */
	allocation: Map<string, number>
	/** Cost of each included position in USD, for the growth history. */
	costs: { investment: Investment; cost: number }[]
	/** Some DOP positions were converted at the rate. */
	convertedDop: boolean
	/** Some positions were left out: DOP without a rate, or an unsupported currency. */
	excluded: boolean
}

/**
 * Portfolio totals in USD, each position valued in its own currency: USD as
 * is, DOP divided by the USD->DOP rate. Without a rate DOP positions cannot
 * be added and are reported as excluded.
 */
export function portfolioMetrics(investments: Investment[], usdToDop: number | null | undefined): PortfolioMetrics {
	const rate = usableRate(usdToDop)
	const allocation = new Map<string, number>()
	const costs: PortfolioMetrics['costs'] = []
	let totalValue = 0
	let totalCost = 0
	let convertedDop = false
	let excluded = false

	for (const inv of investments) {
		const currency = positionCurrency(inv)
		let factor: number
		if (currency === 'USD') {
			factor = 1
		} else if (currency === 'DOP' && rate !== null) {
			factor = 1 / rate
			convertedDop = true
		} else {
			excluded = true
			continue
		}
		const value = inv.quantity * inv.current_price * factor
		const cost = inv.quantity * inv.purchase_price * factor
		totalValue += value
		totalCost += cost
		allocation.set(inv.type, (allocation.get(inv.type) || 0) + value)
		costs.push({ investment: inv, cost })
	}

	const totalProfit = totalValue - totalCost
	const roi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0
	return { totalValue, totalCost, totalProfit, roi, allocation, costs, convertedDop, excluded }
}

/** Currency of a transaction of an account in `accountCurrency` (transactions without one are in the account's). */
export function transactionCurrency(transaction: Pick<Transaction, 'currency'>, accountCurrency: string): string {
	return (transaction.currency || accountCurrency).trim().toUpperCase() || accountCurrency
}

/**
 * The currencies of an account's transactions, the account's own first: a
 * credit card can hold DOP and USD transactions, which are never added
 * together.
 */
export function accountCurrencies(transactions: Pick<Transaction, 'currency'>[], accountCurrency: string): string[] {
	const primary = accountCurrency.toUpperCase()
	const others = new Set<string>()
	for (const t of transactions) {
		const c = transactionCurrency(t, primary)
		if (c !== primary) others.add(c)
	}
	return [primary, ...[...others].sort()]
}
