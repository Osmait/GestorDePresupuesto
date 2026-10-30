'use client'

import { DollarSign, Percent, PieChart, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Amount } from '@/components/shared/Amount'
import { StatCard, type StatTone } from '@/components/shared/StatCard'
import { StatGrid } from '@/components/shared/StatGrid'
import { useFormatPercent } from '@/hooks/useFormatPercent'

interface InvestmentMetrics {
	totalValue: number
	totalCost: number
	totalProfit: number
	roi: number
	/** Some DOP positions were converted to USD at the rate. */
	convertedDop?: boolean
	/** Some positions are not included (DOP without a rate). */
	excluded?: boolean
}

interface InvestmentSummaryCardsProps {
	metrics: InvestmentMetrics
	loading?: boolean
	/** USD->DOP rate the DOP positions were converted at. */
	usdToDop?: number
}

// The portfolio is reported in USD: USD positions as is, DOP positions converted at the rate.
const PORTFOLIO_CURRENCY = 'USD'

/** Sign-aware tone with a neutral zero (rounded to hundredths, like the displayed value). */
function toneFor(value: number): StatTone {
	const rounded = Math.round(value * 100)
	if (rounded > 0) return 'positive'
	if (rounded < 0) return 'negative'
	return 'default'
}

export function InvestmentSummaryCards({ metrics, loading = false, usdToDop }: InvestmentSummaryCardsProps) {
	const t = useTranslations('investments.summary')
	const formatPercent = useFormatPercent()
	const valueHint = metrics.excluded
		? t('rateUnavailable')
		: metrics.convertedDop && usdToDop
			? t('convertedHint', { rate: usdToDop.toFixed(2) })
			: t('totalValueHint')

	return (
		<StatGrid columns={4}>
			<StatCard
				label={t('totalValue')}
				icon={DollarSign}
				loading={loading}
				tone={metrics.excluded ? 'warning' : undefined}
				value={<Amount value={metrics.totalValue} currency={PORTFOLIO_CURRENCY} />}
				hint={valueHint}
			/>
			<StatCard
				label={t('totalCost')}
				icon={PieChart}
				loading={loading}
				value={<Amount value={metrics.totalCost} currency={PORTFOLIO_CURRENCY} />}
				hint={t('totalCostHint')}
			/>
			<StatCard
				label={t('totalProfit')}
				icon={TrendingUp}
				loading={loading}
				value={<Amount value={metrics.totalProfit} currency={PORTFOLIO_CURRENCY} tone='auto' signed icon />}
				hint={t('totalProfitHint')}
			/>
			<StatCard
				label={t('roi')}
				icon={Percent}
				loading={loading}
				tone={toneFor(metrics.roi)}
				value={formatPercent(metrics.roi, {
					signDisplay: 'exceptZero',
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				})}
				hint={t('roiHint')}
			/>
		</StatGrid>
	)
}
