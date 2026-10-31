'use client'

import { LineChart, PieChart } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { useChartTheme } from '@/components/charts/chart-theme'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useExchangeRateQuery } from '@/hooks/queries/useExchangeRateQuery'
import { useGetInvestments } from '@/hooks/queries/useInvestmentsQuery'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatDateInTimeZone, getAppTodayString } from '@/lib/app-time'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { portfolioMetrics } from '@/lib/valuation'
import { InvestmentType } from '@/types/investment'
import { InvestmentSummaryCards } from './InvestmentSummaryCards'

/** Fixed series order per type, so a type keeps its color across renders and pages. */
const TYPE_ORDER: readonly string[] = [InvestmentType.STOCK, InvestmentType.CRYPTO, InvestmentType.FIXED_INCOME]
const KNOWN_TYPES = new Set<string>(TYPE_ORDER)
// The portfolio is reported in USD: USD positions as is, DOP positions converted at the rate.
const PORTFOLIO_CURRENCY = 'USD'

// Client-only chart chunks: the summary cards render without waiting for Nivo.
const chartLoading = () => <Skeleton className='h-full w-full' />
const InvestmentAllocationChart = dynamic(() => import('@/components/charts/InvestmentAllocationChart'), {
	ssr: false,
	loading: chartLoading,
})
const AreaTrendChart = dynamic(() => import('@/components/charts/AreaTrendChart'), {
	ssr: false,
	loading: chartLoading,
})

export function InvestmentDashboard() {
	const t = useTranslations('investments')
	const locale = useAppLocale()
	const formatCurrency = useFormatCurrency()
	const formatPortfolioValue = (value: number) => formatCurrency(value, PORTFOLIO_CURRENCY)
	const { data: investments, isLoading } = useGetInvestments()
	const { colors } = useChartTheme()

	const { data: exchangeRate } = useExchangeRateQuery()
	const usdToDop = exchangeRate?.usd_to_dop

	const metrics = useMemo(() => {
		if (!investments)
			return {
				totalValue: 0,
				totalCost: 0,
				totalProfit: 0,
				roi: 0,
				allocation: [],
				history: [],
				convertedDop: false,
				excluded: false,
			}

		// Each position in its own currency; DOP converted to the USD portfolio currency.
		const portfolio = portfolioMetrics(investments, usdToDop)

		const allocation = Array.from(portfolio.allocation.entries())
			.sort(([a], [b]) => orderOf(a) - orderOf(b))
			.map(([id, value]) => ({
				id,
				label: KNOWN_TYPES.has(id) ? t(`types.${id as InvestmentType}`) : id,
				value,
			}))

		const history: { x: string; y: number }[] = []

		// Sort investments by date
		const sortedCosts = [...portfolio.costs].sort(
			(a, b) => new Date(a.investment.created_at).getTime() - new Date(b.investment.created_at).getTime(),
		)

		let runningTotal = 0
		sortedCosts.forEach(({ investment: inv, cost }) => {
			runningTotal += cost

			// Group by the calendar day (YYYY-MM-DD) in the app's time zone.
			const date = formatDateInTimeZone(new Date(inv.created_at))

			// If multiple investments on same day, update last entry, else push new
			const lastEntry = history[history.length - 1]
			if (lastEntry && lastEntry.x === date) {
				lastEntry.y = runningTotal
			} else {
				history.push({ x: date, y: runningTotal })
			}
		})

		// A single day draws no line: add today's point.
		if (history.length === 1) {
			const today = getAppTodayString()
			if (history[0].x !== today) {
				history.push({ x: today, y: runningTotal })
			}
		}

		return {
			totalValue: portfolio.totalValue,
			totalCost: portfolio.totalCost,
			totalProfit: portfolio.totalProfit,
			roi: portfolio.roi,
			allocation,
			history,
			convertedDop: portfolio.convertedDop,
			excluded: portfolio.excluded,
		}
	}, [investments, t, usdToDop])

	const allocationData = useMemo(
		() =>
			metrics.allocation.map((slice) => ({
				...slice,
				color: colors.series[Math.max(orderOf(slice.id), 0) % colors.series.length],
			})),
		[metrics.allocation, colors.series],
	)

	const growthPoints = useMemo(
		() =>
			metrics.history.map((point) => ({
				label: formatLocalDate(point.x, locale, { month: 'short', day: 'numeric' }),
				tooltipLabel: formatLocalDate(point.x, locale, {
					weekday: 'short',
					year: 'numeric',
					month: 'short',
					day: 'numeric',
				}),
				value: point.y,
			})),
		[metrics.history, locale],
	)

	return (
		<div className='space-y-4'>
			<InvestmentSummaryCards metrics={metrics} loading={isLoading} usdToDop={usdToDop} />

			<div className='grid gap-4 lg:grid-cols-2'>
				<Card>
					<CardHeader>
						<CardTitle className='text-base font-semibold'>{t('dashboard.allocation')}</CardTitle>
					</CardHeader>
					<CardContent className='h-[300px]'>
						{isLoading ? (
							<Skeleton className='h-full w-full' />
						) : allocationData.length > 0 ? (
							<div role='img' aria-label={t('dashboard.allocationAria')} className='h-full w-full'>
								<InvestmentAllocationChart
									data={allocationData}
									totalValue={metrics.totalValue}
									formatValue={formatPortfolioValue}
								/>
							</div>
						) : (
							<EmptyState compact icon={PieChart} title={t('dashboard.noData')} className='h-full' />
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className='text-base font-semibold'>{t('dashboard.growth')}</CardTitle>
					</CardHeader>
					<CardContent className='h-[300px]'>
						{isLoading ? (
							<Skeleton className='h-full w-full' />
						) : growthPoints.length > 0 ? (
							<div role='img' aria-label={t('dashboard.growthAria')} className='h-full w-full'>
								<AreaTrendChart
									points={growthPoints}
									color={colors.series[0]}
									seriesLabel={t('dashboard.value')}
									formatValue={formatPortfolioValue}
								/>
							</div>
						) : (
							<EmptyState compact icon={LineChart} title={t('dashboard.noHistory')} className='h-full' />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	)
}

function orderOf(type: string) {
	const index = TYPE_ORDER.indexOf(type)
	return index === -1 ? TYPE_ORDER.length : index
}
