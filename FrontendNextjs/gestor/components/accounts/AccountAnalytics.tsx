'use client'

import { ArrowDownCircle, ArrowUpCircle, TrendingUp } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { isInflowTransaction } from '@/lib/transaction-utils'
import { DEFAULT_CURRENCY, formatCurrency } from '@/lib/utils'
import { Category } from '@/types/category'
import { Transaction } from '@/types/transaction'

interface AccountAnalyticsProps {
	transactions: Transaction[]
	categories: Category[]
	currentBalance: number
	/** Currency of the account; all its transactions are shown in it. */
	currency?: string
}

const COLORS = ['#10b981', '#ef4444'] // Green for Income, Red for Expense
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
	const formatMoney = (value: number, signDisplay?: 'exceptZero') =>
		formatCurrency(value, currency, { locale, signDisplay })

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
						color: cat?.color || '#94a3b8', // fallback color
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
			label: formatLocalDate(new Date(), locale, { month: 'short', day: 'numeric' }),
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
			.map(([name, value]) => ({ name, value, color: '#ef4444' }))
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
	}, [transactions, categories, currentBalance, locale, t])

	const summaryData = [
		{ name: t('income'), value: stats.income, color: COLORS[0] },
		{ name: t('expenses'), value: stats.expense, color: COLORS[1] },
	].filter((d) => d.value > 0)

	return (
		<div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8'>
			<Card className='min-w-0'>
				<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
					<CardTitle className='text-sm font-medium'>{t('totalIncome')}</CardTitle>
					<ArrowUpCircle className='h-4 w-4 text-green-500' />
				</CardHeader>
				<CardContent>
					<div className='text-xl sm:text-2xl font-bold text-green-500 tabular-nums break-words'>
						{formatMoney(stats.income, 'exceptZero')}
					</div>
				</CardContent>
			</Card>
			<Card className='min-w-0'>
				<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
					<CardTitle className='text-sm font-medium'>{t('totalExpenses')}</CardTitle>
					<ArrowDownCircle className='h-4 w-4 text-red-500' />
				</CardHeader>
				<CardContent>
					<div className='text-xl sm:text-2xl font-bold text-red-500 tabular-nums break-words'>
						{formatMoney(-stats.expense, 'exceptZero')}
					</div>
				</CardContent>
			</Card>

			<Card className='min-w-0 md:col-span-2 lg:row-span-2'>
				<CardHeader>
					<CardTitle>{t('financialSummary')}</CardTitle>
				</CardHeader>
				<CardContent className='h-[200px] min-w-0'>
					<HorizontalBarChart data={summaryData} formatValue={formatMoney} labelWidth={80} />
				</CardContent>
			</Card>

			<Card className='min-w-0 md:col-span-2'>
				<CardHeader>
					<CardTitle>{t('expensesByCategory')}</CardTitle>
				</CardHeader>
				<CardContent className='h-[200px] min-w-0'>
					{stats.expenseByCategory.length > 0 ? (
						<DonutLegendChart data={stats.expenseByCategory} formatValue={formatMoney} />
					) : (
						<div className='h-full flex items-center justify-center text-muted-foreground text-sm'>{t('noData')}</div>
					)}
				</CardContent>
			</Card>

			<Card className='min-w-0 md:col-span-2'>
				<CardHeader>
					<CardTitle>{t('incomeByCategory')}</CardTitle>
				</CardHeader>
				<CardContent className='h-[200px] min-w-0'>
					{stats.incomeByCategory.length > 0 ? (
						<DonutLegendChart data={stats.incomeByCategory} formatValue={formatMoney} />
					) : (
						<div className='h-full flex items-center justify-center text-muted-foreground text-sm'>{t('noData')}</div>
					)}
				</CardContent>
			</Card>

			<Card className='min-w-0 md:col-span-2'>
				<CardHeader>
					<CardTitle>{t('topExpenses')}</CardTitle>
				</CardHeader>
				<CardContent className='h-[200px] min-w-0'>
					{stats.topExpenses.length > 0 ? (
						<HorizontalBarChart
							data={stats.topExpenses}
							formatValue={formatMoney}
							labelWidth={100}
							fontSize={11}
							padding={0.4}
						/>
					) : (
						<div className='h-full flex items-center justify-center text-muted-foreground text-sm'>{t('noData')}</div>
					)}
				</CardContent>
			</Card>

			<Card className='min-w-0 md:col-span-2 lg:col-span-4 lg:mt-4'>
				<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
					<CardTitle>{t('balanceHistory')}</CardTitle>
					<TrendingUp className='h-4 w-4 text-muted-foreground' />
				</CardHeader>
				<CardContent className='h-[250px] min-w-0'>
					<AreaTrendChart
						points={stats.balanceHistory}
						color='#8884d8'
						seriesLabel={t('balance')}
						formatValue={formatMoney}
					/>
				</CardContent>
			</Card>
		</div>
	)
}
