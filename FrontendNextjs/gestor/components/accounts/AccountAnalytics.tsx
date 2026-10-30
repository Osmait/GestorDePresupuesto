'use client'

import { ArrowDownRight, ArrowUpRight, BarChart3, PieChart, Wallet } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { type ReactNode, useMemo } from 'react'
import { useChartTheme } from '@/components/charts/chart-theme'
import { Amount } from '@/components/shared/Amount'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatCard } from '@/components/shared/StatCard'
import { StatGrid } from '@/components/shared/StatGrid'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { getAppTodayDate } from '@/lib/app-time'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { isInflowTransaction } from '@/lib/transaction-utils'
import { cn, DEFAULT_CURRENCY } from '@/lib/utils'
import { Category } from '@/types/category'
import { Transaction } from '@/types/transaction'

interface AccountAnalyticsProps {
	transactions: Transaction[]
	categories: Category[]
	currentBalance: number
	/** Currency of the account; all its transactions are shown in it. */
	currency?: string
}

const TOP_CATEGORIES_COUNT = 5

// Charts are client-only and load in their own chunk, after the summary cards.
// The CardContent around each one has a fixed height, so nothing shifts.
const chartLoading = () => <div className='h-full w-full rounded bg-muted/20 animate-pulse' />
const HorizontalBarChart = dynamic(() => import('@/components/charts/HorizontalBarChart'), {
	ssr: false,
	loading: chartLoading,
})
const DonutLegendChart = dynamic(() => import('@/components/charts/DonutLegendChart'), {
	ssr: false,
	loading: chartLoading,
})
const AreaTrendChart = dynamic(() => import('@/components/charts/AreaTrendChart'), {
	ssr: false,
	loading: chartLoading,
})

export function AccountAnalytics({
	transactions,
	categories,
	currentBalance,
	currency = DEFAULT_CURRENCY,
}: AccountAnalyticsProps) {
	const t = useTranslations('analysis')
	const locale = useAppLocale()
	const formatCurrency = useFormatCurrency()
	const { colors } = useChartTheme()
	const formatInCurrency = (value: number) => formatCurrency(value, currency)

	const stats = useMemo(() => {
		let income = 0
		let expense = 0
		const incomeMap: Record<string, number> = {}
		const expenseMap: Record<string, number> = {}

		transactions.forEach((t) => {
			const amount = t.amount
			if (t.type_transation === 'income') {
				income += amount
				if (t.category_id) {
					incomeMap[t.category_id] = (incomeMap[t.category_id] || 0) + amount
				}
			} else if (t.type_transation === 'bill') {
				expense += amount
				if (t.category_id) {
					expenseMap[t.category_id] = (expenseMap[t.category_id] || 0) + amount
				}
			}
		})

		const formatCategoryData = (map: Record<string, number>, noCategory: string) => {
			return Object.entries(map)
				.map(([id, value]) => {
					const cat = categories.find((c) => c.id === id)
					return {
						name: cat?.name || noCategory,
						value,
						// Category colors are user data; uncategorized money is neutral ink.
						color: cat?.color || colors.mutedText,
					}
				})
				.sort((a, b) => b.value - a.value)
				.slice(0, TOP_CATEGORIES_COUNT)
		}

		// Balance History Logic
		let balanceTracker = currentBalance
		// Create a copy and sort by date descending (newest first) to walk backward
		const sortedTransactions = [...transactions].sort(
			(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
		)

		const historyPoints: { label: string; value: number }[] = []
		// Push current state
		historyPoints.push({
			label: formatLocalDate(getAppTodayDate(), locale, { month: 'short', day: 'numeric' }),
			value: balanceTracker,
		})

		sortedTransactions.forEach((t) => {
			// To go back in time:
			// If transaction was Income (+), we SUBTRACT it to get previous balance.
			// If transaction was Expense (-), we ADD it (using abs amount) to get previous balance.
			if (isInflowTransaction(t.type_transation)) {
				balanceTracker -= t.amount // going back in time: undo income = subtract
			} else {
				balanceTracker += t.amount // going back in time: undo expense = add back
			}

			historyPoints.push({
				label: formatLocalDate(t.created_at, locale, { month: 'short', day: 'numeric' }),
				value: balanceTracker,
			})
		})

		// Reverse to get chronological order (oldest -> newest) for Chart
		const balanceHistory = historyPoints
			.reverse()
			.filter((_, index) => index % Math.ceil(historyPoints.length / 20) === 0 || index === historyPoints.length - 1) // Downsample simple logic

		// Top Expenses by Concept Logic
		const expenseByNameMap: Record<string, number> = {}
		transactions.forEach((t) => {
			if (t.type_transation === 'bill') {
				expenseByNameMap[t.name] = (expenseByNameMap[t.name] || 0) + t.amount
			}
		})

		const topExpenses = Object.entries(expenseByNameMap)
			.map(([name, value]) => ({ name, value, color: colors.negative }))
			.sort((a, b) => b.value - a.value)
			.slice(0, TOP_CATEGORIES_COUNT)

		return {
			income,
			expense,
			incomeByCategory: formatCategoryData(incomeMap, t('noCategory')),
			expenseByCategory: formatCategoryData(expenseMap, t('noCategory')),
			balanceHistory,
			topExpenses,
		}
	}, [transactions, categories, currentBalance, locale, t, colors])

	const summaryData = [
		{ name: t('income'), value: stats.income, color: colors.positive },
		{ name: t('expenses'), value: stats.expense, color: colors.negative },
	].filter((d) => d.value > 0)

	return (
		<div className='space-y-6'>
			<StatGrid columns={3}>
				<StatCard label={t('balance')} icon={Wallet} value={<Amount value={currentBalance} currency={currency} />} />
				<StatCard
					label={t('totalIncome')}
					icon={ArrowUpRight}
					value={<Amount value={stats.income} currency={currency} tone='auto' signed />}
				/>
				<StatCard
					label={t('totalExpenses')}
					icon={ArrowDownRight}
					value={<Amount value={-stats.expense} currency={currency} tone='auto' signed />}
				/>
			</StatGrid>

			<div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
				<ChartCard title={t('financialSummary')}>
					{summaryData.length > 0 ? (
						<HorizontalBarChart
							data={summaryData}
							formatValue={formatInCurrency}
							labelWidth={80}
							ariaLabel={t('financialSummary')}
						/>
					) : (
						<EmptyState compact icon={BarChart3} title={t('noData')} />
					)}
				</ChartCard>

				<ChartCard title={t('topExpenses')}>
					{stats.topExpenses.length > 0 ? (
						<HorizontalBarChart
							data={stats.topExpenses}
							formatValue={formatInCurrency}
							labelWidth={100}
							fontSize={11}
							padding={0.4}
							ariaLabel={t('topExpenses')}
						/>
					) : (
						<EmptyState compact icon={BarChart3} title={t('noData')} />
					)}
				</ChartCard>

				<ChartCard title={t('expensesByCategory')}>
					{stats.expenseByCategory.length > 0 ? (
						<DonutLegendChart
							data={stats.expenseByCategory}
							formatValue={formatInCurrency}
							ariaLabel={t('expensesByCategory')}
						/>
					) : (
						<EmptyState compact icon={PieChart} title={t('noData')} />
					)}
				</ChartCard>

				<ChartCard title={t('incomeByCategory')}>
					{stats.incomeByCategory.length > 0 ? (
						<DonutLegendChart
							data={stats.incomeByCategory}
							formatValue={formatInCurrency}
							ariaLabel={t('incomeByCategory')}
						/>
					) : (
						<EmptyState compact icon={PieChart} title={t('noData')} />
					)}
				</ChartCard>

				<ChartCard title={t('balanceHistory')} className='lg:col-span-2' contentClassName='h-[250px]'>
					<AreaTrendChart
						points={stats.balanceHistory}
						color={colors.series[0]}
						seriesLabel={t('balance')}
						formatValue={formatInCurrency}
						ariaLabel={t('balanceHistory')}
					/>
				</ChartCard>
			</div>
		</div>
	)
}

/** One chart per card, fixed height so the lazy chart chunk doesn't shift the layout. */
function ChartCard({
	title,
	children,
	className,
	contentClassName = 'h-[200px]',
}: {
	title: string
	children: ReactNode
	className?: string
	contentClassName?: string
}) {
	return (
		<Card className={cn('min-w-0', className)}>
			<CardHeader>
				<CardTitle className='text-base'>{title}</CardTitle>
			</CardHeader>
			<CardContent className={cn('min-w-0', contentClassName)}>{children}</CardContent>
		</Card>
	)
}
