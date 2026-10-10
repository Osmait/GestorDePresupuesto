'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetInvestments } from '@/hooks/queries/useInvestmentsQuery'
import { getIntlLocale, useAppLocale } from '@/lib/i18n/date-locale'
import { formatCurrency } from '@/lib/utils'
import { InvestmentType } from '@/types/investment'
import { InvestmentSummaryCards } from './InvestmentSummaryCards'

const KNOWN_TYPES = new Set<string>(Object.values(InvestmentType))

// Client-only chart chunks: the summary cards render without waiting for Nivo.
const chartLoading = () => <div className='h-full w-full rounded bg-muted/20 animate-pulse' />
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
	const intlLocale = getIntlLocale(locale)
	const money = (value: number) => formatCurrency(value, 'USD', { locale })
	const { data: investments, isLoading } = useGetInvestments()
	const { theme } = useTheme()

	const metrics = useMemo(() => {
		if (!investments) return { totalValue: 0, totalCost: 0, totalProfit: 0, roi: 0, allocation: [], history: [] }

		let totalValue = 0
		let totalCost = 0
		const allocationMap = new Map<string, number>()

		investments.forEach((inv) => {
			const value = inv.quantity * inv.current_price
			const cost = inv.quantity * inv.purchase_price
			totalValue += value
			totalCost += cost

			const currentTypeTotal = allocationMap.get(inv.type) || 0
			allocationMap.set(inv.type, currentTypeTotal + value)
		})

		const totalProfit = totalValue - totalCost
		const roi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0

		const allocation = Array.from(allocationMap.entries()).map(([id, value]) => ({
			id,
			label: KNOWN_TYPES.has(id) ? t(`types.${id as InvestmentType}`) : id,
			value,
			color: id === 'stock' ? '#3b82f6' : id === 'crypto' ? '#f59e0b' : '#10b981',
		}))

		const history: { x: string; y: number }[] = []

		// Sort investments by date
		const sortedInvestments = [...investments].sort(
			(a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
		)

		let runningTotal = 0
		sortedInvestments.forEach((inv) => {
			const cost = inv.quantity * inv.purchase_price
			runningTotal += cost

			// Format date as YYYY-MM-DD for grouping/display
			const date = new Date(inv.created_at).toISOString().split('T')[0]

			// If multiple investments on same day, update last entry, else push new
			const lastEntry = history[history.length - 1]
			if (lastEntry && lastEntry.x === date) {
				lastEntry.y = runningTotal
			} else {
				history.push({ x: date, y: runningTotal })
			}
		})

		// Add today's point if needed, or ensuring at least 2 points for a line
		if (history.length === 1) {
			const today = new Date().toISOString().split('T')[0]
			if (history[0].x !== today) {
				history.push({ x: today, y: runningTotal })
			}
		}

		return { totalValue, totalCost, totalProfit, roi, allocation, history }
	}, [investments, t])

	const nivoTheme = useMemo(
		() => ({
			background: 'transparent',
			text: { fill: theme === 'dark' ? '#ffffff' : '#333333', fontSize: 11 },
			tooltip: {
				container: {
					background: theme === 'dark' ? '#1f2937' : '#ffffff',
					color: theme === 'dark' ? '#ffffff' : '#333333',
					fontSize: 12,
					borderRadius: '6px',
					boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
				},
			},
		}),
		[theme],
	)

	const growthPoints = useMemo(
		() =>
			metrics.history.map((point) => {
				const date = new Date(point.x)
				return {
					label: date.toLocaleDateString(intlLocale, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
					tooltipLabel: date.toLocaleDateString(intlLocale, {
						weekday: 'short',
						year: 'numeric',
						month: 'short',
						day: 'numeric',
						timeZone: 'UTC',
					}),
					value: point.y,
				}
			}),
		[metrics.history, intlLocale],
	)

	if (isLoading) {
		return (
			<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8'>
				{[1, 2, 3, 4].map((i) => (
					<Card key={i}>
						<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
							<Skeleton className='h-4 w-[100px]' />
						</CardHeader>
						<CardContent>
							<Skeleton className='h-8 w-[120px]' />
						</CardContent>
					</Card>
				))}
			</div>
		)
	}

	return (
		<div className='space-y-4 mb-8'>
			<InvestmentSummaryCards metrics={metrics} />

			<div className='grid gap-4 md:grid-cols-2'>
				<Card className='col-span-1'>
					<CardHeader>
						<CardTitle>{t('dashboard.allocation')}</CardTitle>
					</CardHeader>
					<CardContent className='h-[300px]'>
						{metrics.allocation.length > 0 ? (
							<InvestmentAllocationChart
								data={metrics.allocation}
								totalValue={metrics.totalValue}
								isDark={theme === 'dark'}
								nivoTheme={nivoTheme}
								formatValue={money}
							/>
						) : (
							<div className='h-full flex items-center justify-center text-muted-foreground'>
								{t('dashboard.noData')}
							</div>
						)}
					</CardContent>
				</Card>

				<Card className='col-span-1'>
					<CardHeader>
						<CardTitle>{t('dashboard.growth')}</CardTitle>
					</CardHeader>
					<CardContent className='h-[300px]'>
						{metrics.history.length > 0 ? (
							<AreaTrendChart
								points={growthPoints}
								color='#2563eb'
								seriesLabel={t('dashboard.value')}
								formatValue={money}
							/>
						) : (
							<div className='h-full flex items-center justify-center text-muted-foreground'>
								{t('dashboard.noHistory')}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
