import { describe, expect, it } from 'vitest'
import {
	accountCurrencies,
	cardDebtTotals,
	portfolioMetrics,
	positionCurrency,
	transactionCurrency,
	usableRate,
} from '@/lib/valuation'
import { type Investment, InvestmentType } from '@/types/investment'

function position(overrides: Partial<Investment>): Investment {
	return {
		id: 'i',
		name: 'n',
		symbol: 's',
		type: InvestmentType.STOCK,
		quantity: 1,
		purchase_price: 1,
		current_price: 1,
		created_at: '2026-10-01T12:00:00Z',
		user_id: 'u',
		...overrides,
	}
}

describe('usableRate', () => {
	it.each([
		[60, 60],
		[0, null],
		[-1, null],
		[Number.NaN, null],
		[undefined, null],
		[null, null],
	])('%s -> %s', (rate, expected) => {
		expect(usableRate(rate)).toBe(expected)
	})
})

describe('cardDebtTotals', () => {
	it.each([
		{
			name: 'converts USD debt and limit at the rate',
			input: { debtDop: 1000, debtUsd: 10, limitDop: 10000, limitUsd: 100, rate: 60 },
			expected: { totalDebt: 1600, usdIncluded: true, utilization: 10 },
		},
		{
			name: 'without a rate USD debt is not counted as 0: it is reported as excluded',
			input: { debtDop: 1000, debtUsd: 10, limitDop: 10000, limitUsd: 100, rate: 0 },
			expected: { totalDebt: 1000, usdIncluded: false, utilization: null },
		},
		{
			name: 'without a rate and without USD amounts the DOP totals are complete',
			input: { debtDop: 1000, debtUsd: 0, limitDop: 10000, limitUsd: 0, rate: undefined },
			expected: { totalDebt: 1000, usdIncluded: true, utilization: 10 },
		},
		{
			name: 'no limit has no utilization',
			input: { debtDop: 0, debtUsd: 0, limitDop: 0, limitUsd: 0, rate: 60 },
			expected: { totalDebt: 0, usdIncluded: true, utilization: null },
		},
	])('$name', ({ input, expected }) => {
		expect(cardDebtTotals(input)).toEqual(expected)
	})
})

describe('portfolioMetrics', () => {
	it('values each position in its own currency (DOP divided by the rate)', () => {
		const metrics = portfolioMetrics(
			[
				position({ quantity: 4, purchase_price: 100, current_price: 150, settlement_currency: 'USD' }),
				position({ quantity: 2, purchase_price: 5000, current_price: 6000, settlement_currency: 'DOP' }),
			],
			60,
		)
		expect(metrics.totalValue).toBeCloseTo(600 + 200)
		expect(metrics.totalCost).toBeCloseTo(400 + 166.6667, 3)
		expect(metrics.convertedDop).toBe(true)
		expect(metrics.excluded).toBe(false)
	})

	it('leaves DOP positions out (and says so) when the rate is missing', () => {
		const metrics = portfolioMetrics(
			[
				position({ quantity: 1, current_price: 100, settlement_currency: 'USD' }),
				position({ quantity: 1, current_price: 6000, settlement_currency: 'DOP' }),
			],
			undefined,
		)
		expect(metrics.totalValue).toBe(100)
		expect(metrics.excluded).toBe(true)
	})

	it('treats a position without currency as USD', () => {
		expect(positionCurrency({ settlement_currency: undefined })).toBe('USD')
		expect(positionCurrency({ settlement_currency: ' dop ' })).toBe('DOP')
		expect(portfolioMetrics([position({ quantity: 2, current_price: 5 })], undefined).totalValue).toBe(10)
	})
})

describe('account currencies', () => {
	it('lists the account currency first and the others after, never mixing them', () => {
		expect(accountCurrencies([{ currency: 'USD' }, { currency: undefined }, { currency: 'DOP' }], 'DOP')).toEqual([
			'DOP',
			'USD',
		])
		expect(accountCurrencies([], 'USD')).toEqual(['USD'])
		expect(transactionCurrency({ currency: undefined }, 'USD')).toBe('USD')
	})
})
