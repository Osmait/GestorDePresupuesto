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
}

interface InvestmentSummaryCardsProps {
	metrics: InvestmentMetrics
	loading?: boolean
}

// Portfolio totals are aggregated without FX conversion; positions are settled in USD by default.
const PORTFOLIO_CURRENCY = 'USD'

/** Sign-aware tone with a neutral zero (rounded to hundredths, like the displayed value). */
function toneFor(value: number): StatTone {
	const rounded = Math.round(value * 100)
	if (rounded > 0) return 'positive'
	if (rounded < 0) return 'negative'
	return 'default'
}

export function InvestmentSummaryCards({ metrics, loading = false }: InvestmentSummaryCardsProps) {
	const t = useTranslations('investments.summary')
	const formatPercent = useFormatPercent()

	return (
		<StatGrid columns={4}>
			<StatCard
				label={t('totalValue')}
				icon={DollarSign}
				loading={loading}
				value={<Amount value={metrics.totalValue} currency={PORTFOLIO_CURRENCY} />}
				hint={t('totalValueHint')}
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
