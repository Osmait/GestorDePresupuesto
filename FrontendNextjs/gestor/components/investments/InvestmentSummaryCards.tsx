'use client'

import { DollarSign, PieChart, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppLocale } from '@/lib/i18n/date-locale'
import { formatCurrency } from '@/lib/utils'

interface InvestmentMetrics {
	totalValue: number
	totalCost: number
	totalProfit: number
	roi: number
}

export function InvestmentSummaryCards({ metrics }: { metrics: InvestmentMetrics }) {
	const t = useTranslations('investments.summary')
	const locale = useAppLocale()
	// Portfolio totals are aggregated without FX conversion; positions are settled in USD by default.
	const money = (value: number, signDisplay?: 'exceptZero') => formatCurrency(value, 'USD', { locale, signDisplay })
	return (
		<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
			<Card>
				<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
					<CardTitle className='text-sm font-medium'>{t('totalValue')}</CardTitle>
					<DollarSign className='h-4 w-4 text-muted-foreground' />
				</CardHeader>
				<CardContent>
					<div className='text-2xl font-bold'>{money(metrics.totalValue)}</div>
					<p className='text-xs text-muted-foreground'>{t('totalValueHint')}</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
					<CardTitle className='text-sm font-medium'>{t('totalCost')}</CardTitle>
					<PieChart className='h-4 w-4 text-muted-foreground' />
				</CardHeader>
				<CardContent>
					<div className='text-2xl font-bold'>{money(metrics.totalCost)}</div>
					<p className='text-xs text-muted-foreground'>{t('totalCostHint')}</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
					<CardTitle className='text-sm font-medium'>{t('totalProfit')}</CardTitle>
					{metrics.totalProfit >= 0 ? (
						<TrendingUp className='h-4 w-4 text-green-500' />
					) : (
						<TrendingDown className='h-4 w-4 text-red-500' />
					)}
				</CardHeader>
				<CardContent>
					<div className={`text-2xl font-bold ${metrics.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
						{money(metrics.totalProfit, 'exceptZero')}
					</div>
					<p className='text-xs text-muted-foreground'>{t('totalProfitHint')}</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
					<CardTitle className='text-sm font-medium'>{t('roi')}</CardTitle>
					{metrics.roi >= 0 ? (
						<TrendingUp className='h-4 w-4 text-green-500' />
					) : (
						<TrendingDown className='h-4 w-4 text-red-500' />
					)}
				</CardHeader>
				<CardContent>
					<div className={`text-2xl font-bold ${metrics.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
						{metrics.roi.toFixed(2)}%
					</div>
					<p className='text-xs text-muted-foreground'>{t('roiHint')}</p>
				</CardContent>
			</Card>
		</div>
	)
}
