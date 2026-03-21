'use client'

import { motion } from 'framer-motion'
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'
import { AnalyticsSkeleton } from '@/components/skeletons/analytics-skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useGetDashboardSummary } from '@/hooks/queries/useAnalyticsQuery'
import { useGetBudgets } from '@/hooks/queries/useBudgetsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { AnalyticsQueryFilters } from '@/types/analytics'
import { useAnalysisContext } from './AnalysisContext'

const AnalysisLineChart = dynamic(() => import('@/components/charts/AnalysisLineChart'), {
	ssr: false,
	loading: () => <div className='h-full w-full bg-muted/20 animate-pulse rounded' />,
})
const AnalysisBarChart = dynamic(() => import('@/components/charts/AnalysisBarChart'), {
	ssr: false,
	loading: () => <div className='h-full w-full bg-muted/20 animate-pulse rounded' />,
})
const AnalysisPieChart = dynamic(() => import('@/components/charts/AnalysisPieChart'), {
	ssr: false,
	loading: () => <div className='h-full w-full bg-muted/20 animate-pulse rounded' />,
})
const AnalysisRadarChart = dynamic(() => import('@/components/charts/AnalysisRadarChart'), {
	ssr: false,
	loading: () => <div className='h-full w-full bg-muted/20 animate-pulse rounded' />,
})
const AnalysisHeatMap = dynamic(() => import('@/components/charts/AnalysisHeatMap'), {
	ssr: false,
	loading: () => <div className='h-full w-full bg-muted/20 animate-pulse rounded' />,
})

const mockHeat = [
	{
		id: 'Lun',
		data: [
			{ x: 'Ene', y: 2 },
			{ x: 'Feb', y: 3 },
		],
	},
]

export function AnalysisDashboard() {
	const { theme } = useTheme()
	const router = useRouter()
	const t = useTranslations('analysis')
	const { filters } = useAnalysisContext()
	const categoryPalette = ['#22c55e', '#0ea5e9', '#f59e0b', '#f97316', '#eab308', '#14b8a6', '#ef4444', '#8b5cf6']
	const { data: accounts = [] } = useGetAccounts()
	const { data: categories = [] } = useGetCategories()
	const { data: budgets = [] } = useGetBudgets()

	const formatDate = (date: Date) => date.toISOString().split('T')[0]

	const activeFilters = useMemo((): AnalyticsQueryFilters => {
		const next: AnalyticsQueryFilters = {}

		if (filters.filterMode === 'month') {
			const selectedYear = Number(filters.year || new Date().getFullYear())
			if (filters.month && filters.month !== 'all') {
				const selectedMonth = Number(filters.month)
				const from = new Date(selectedYear, selectedMonth - 1, 1)
				const to = new Date(selectedYear, selectedMonth, 0)
				next.date_from = formatDate(from)
				next.date_to = formatDate(to)
			} else {
				const from = new Date(selectedYear, 0, 1)
				const to = new Date(selectedYear, 11, 31)
				next.date_from = formatDate(from)
				next.date_to = formatDate(to)
			}
		} else if (filters.dateRange?.from && filters.dateRange?.to) {
			next.date_from = formatDate(filters.dateRange.from)
			next.date_to = formatDate(filters.dateRange.to)
		}

		if (filters.account !== 'all') next.account_id = filters.account
		if (filters.category !== 'all') next.category_id = filters.category
		if (filters.type === 'INCOME') next.type = 'income'
		if (filters.type === 'BILL') next.type = 'bill'

		const minAmount = Number(filters.minAmount)
		if (filters.minAmount !== '' && !Number.isNaN(minAmount) && minAmount >= 0) {
			next.min_amount = minAmount
		}

		const maxAmount = Number(filters.maxAmount)
		if (filters.maxAmount !== '' && !Number.isNaN(maxAmount) && maxAmount >= 0) {
			next.max_amount = maxAmount
		}

		return next
	}, [filters, formatDate])

	const previousPeriodFilters = useMemo((): AnalyticsQueryFilters | undefined => {
		if (!activeFilters.date_from || !activeFilters.date_to) return undefined

		const from = new Date(`${activeFilters.date_from}T00:00:00`)
		const to = new Date(`${activeFilters.date_to}T00:00:00`)
		if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return undefined

		const diffMs = to.getTime() - from.getTime()
		const prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000)
		const prevFrom = new Date(prevTo.getTime() - diffMs)

		return {
			...activeFilters,
			date_from: formatDate(prevFrom),
			date_to: formatDate(prevTo),
		}
	}, [activeFilters, formatDate])

	// TanStack Query Hooks
	const { data: dashboardSummary, isLoading: isLoadingDashboardSummary } = useGetDashboardSummary(activeFilters)
	const { data: previousSummary } = useGetDashboardSummary(previousPeriodFilters)

	const categoryExpenses = dashboardSummary?.category_expenses || []
	const monthlySummary = dashboardSummary?.monthly_summary || []

	const nivoTheme = useMemo(
		() => ({
			background: 'transparent',
			text: {
				fill: theme === 'dark' ? '#ffffff' : '#333333',
				fontSize: 11,
			},
			axis: {
				domain: {
					line: {
						stroke: theme === 'dark' ? '#525252' : '#e5e7eb',
						strokeWidth: 1,
					},
				},
				legend: {
					text: {
						fill: theme === 'dark' ? '#ffffff' : '#333333',
						fontSize: 12,
						fontWeight: 500,
					},
				},
				ticks: {
					line: {
						stroke: theme === 'dark' ? '#525252' : '#e5e7eb',
						strokeWidth: 1,
					},
					text: {
						fill: theme === 'dark' ? '#ffffff' : '#333333',
						fontSize: 11,
					},
				},
			},
			grid: {
				line: {
					stroke: theme === 'dark' ? '#444444' : '#e5e7eb',
					strokeWidth: 1,
				},
			},
			legends: {
				text: {
					fill: theme === 'dark' ? '#ffffff' : '#333333',
					fontSize: 11,
				},
			},
			tooltip: {
				container: {
					background: theme === 'dark' ? '#1f2937' : '#ffffff',
					color: theme === 'dark' ? '#ffffff' : '#333333',
					fontSize: 12,
					borderRadius: '6px',
					boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
				},
			},
		}),
		[theme],
	)

	// ... (rest of the code)

	const loading = isLoadingDashboardSummary

	if (loading) return <AnalyticsSkeleton />

	const totalIncome = dashboardSummary?.total_income || 0
	const totalExpenses = dashboardSummary?.total_expenses || 0
	const netAmount = dashboardSummary?.net_amount || 0
	const savingsRate = totalIncome > 0 ? (netAmount / totalIncome) * 100 : 0

	const selectedFrom = activeFilters.date_from ? new Date(`${activeFilters.date_from}T00:00:00`) : null
	const selectedTo = activeFilters.date_to ? new Date(`${activeFilters.date_to}T00:00:00`) : null
	const daysInRange =
		selectedFrom && selectedTo
			? Math.max(1, Math.floor((selectedTo.getTime() - selectedFrom.getTime()) / (24 * 60 * 60 * 1000)) + 1)
			: 30

	const avgDailySpend = totalExpenses / daysInRange
	const previousExpenses = previousSummary?.total_expenses || 0
	const expenseDelta = previousExpenses > 0 ? ((totalExpenses - previousExpenses) / previousExpenses) * 100 : 0

	const topCategory = [...categoryExpenses].sort((a, b) => b.value - a.value)[0]
	const normalizeAmount = (value: number) => Math.round(Math.abs(value) * 100) / 100
	const topCategoryShare = totalExpenses > 0 && topCategory ? (topCategory.value / totalExpenses) * 100 : 0
	const hasBudgetForTopCategory = topCategory ? budgets.some((budget) => budget.category_id === topCategory.id) : false
	const formatDOP = (value: number) =>
		new Intl.NumberFormat('es-DO', {
			style: 'currency',
			currency: 'DOP',
			maximumFractionDigits: 2,
		}).format(value)

	const accountName = accounts.find((a) => a.id === filters.account)?.name
	const categoryName = categories.find((c) => c.id === filters.category)?.name

	const activeFilterBadges = [
		filters.filterMode === 'month'
			? `${t('month')}: ${filters.month === 'all' ? t('all') : filters.month}/${filters.year}`
			: activeFilters.date_from && activeFilters.date_to
				? `${activeFilters.date_from} - ${activeFilters.date_to}`
				: null,
		accountName ? `${t('account')}: ${accountName}` : null,
		categoryName ? `${t('category')}: ${categoryName}` : null,
		activeFilters.type ? `${t('type')}: ${activeFilters.type === 'income' ? t('income') : t('expense')}` : null,
		typeof activeFilters.min_amount === 'number' ? `${t('minAmount')}: ${formatDOP(activeFilters.min_amount)}` : null,
		typeof activeFilters.max_amount === 'number' ? `${t('maxAmount')}: ${formatDOP(activeFilters.max_amount)}` : null,
	].filter((value): value is string => Boolean(value))

	const openTransactionsForCurrentFilters = () => {
		const params = new URLSearchParams()
		params.set('type', 'BILL')
		if (activeFilters.date_from) params.set('dateFrom', activeFilters.date_from)
		if (activeFilters.date_to) params.set('dateTo', activeFilters.date_to)
		if (activeFilters.account_id) params.set('account', activeFilters.account_id)
		if (activeFilters.category_id) params.set('category', activeFilters.category_id)
		if (typeof activeFilters.min_amount === 'number') params.set('minAmount', String(activeFilters.min_amount))
		if (typeof activeFilters.max_amount === 'number') params.set('maxAmount', String(activeFilters.max_amount))
		router.push(`/app/transactions?${params.toString()}`)
	}

	const insights: {
		title: string
		detail: string
		tone: 'neutral' | 'warning' | 'positive'
		actionLabel?: string
		onAction?: () => void
	}[] = []

	const budgetVsRealRows = budgets
		.map((budget) => {
			const categoryExpense = categoryExpenses.find((item) => item.id === budget.category_id)
			const spent = normalizeAmount(categoryExpense?.value || 0)
			const budgetAmount = normalizeAmount(budget.amount)
			const progress = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0
			const remaining = budgetAmount - spent
			const categoryLabel =
				categories.find((category) => category.id === budget.category_id)?.name ||
				budget.category_name ||
				t('noCategory')

			return {
				id: budget.id,
				categoryId: budget.category_id,
				categoryLabel,
				budgetAmount,
				spent,
				remaining,
				progress,
			}
		})
		.sort((a, b) => b.progress - a.progress)

	const totalBudgetPlanned = budgetVsRealRows.reduce((sum, row) => sum + row.budgetAmount, 0)
	const totalBudgetSpent = budgetVsRealRows.reduce((sum, row) => sum + row.spent, 0)
	const totalBudgetRemaining = totalBudgetPlanned - totalBudgetSpent
	const overBudgetCount = budgetVsRealRows.filter((row) => row.progress > 100).length

	const now = new Date()
	const hasCurrentMonthContext =
		filters.filterMode === 'month' &&
		filters.month !== 'all' &&
		Number(filters.year) === now.getFullYear() &&
		Number(filters.month) === now.getMonth() + 1

	const daysInMonth = hasCurrentMonthContext
		? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
		: daysInRange
	const elapsedDays = hasCurrentMonthContext ? now.getDate() : daysInRange
	const projectionRatio = elapsedDays > 0 ? daysInMonth / elapsedDays : 1
	const projectedSpent = totalBudgetSpent * projectionRatio
	const projectedVsBudget = totalBudgetPlanned > 0 ? (projectedSpent / totalBudgetPlanned) * 100 : 0

	const openCategoryTransactions = (categoryId?: string) => {
		if (!categoryId) return
		const params = new URLSearchParams()
		params.set('category', categoryId)
		params.set('type', 'BILL')
		if (activeFilters.date_from) params.set('dateFrom', activeFilters.date_from)
		if (activeFilters.date_to) params.set('dateTo', activeFilters.date_to)
		if (typeof activeFilters.min_amount === 'number') params.set('minAmount', String(activeFilters.min_amount))
		if (typeof activeFilters.max_amount === 'number') params.set('maxAmount', String(activeFilters.max_amount))
		router.push(`/app/transactions?${params.toString()}`)
	}

	const openBudgetCreateForCategory = (categoryId?: string) => {
		if (!categoryId) return
		router.push(`/app/budget?create=1&category=${categoryId}`)
	}

	if (expenseDelta > 12) {
		insights.push({
			title: t('insightExpenseUpTitle'),
			detail: t('insightExpenseUpDetail', { delta: expenseDelta.toFixed(1) }),
			tone: 'warning',
			actionLabel: t('viewTransactions'),
			onAction: openTransactionsForCurrentFilters,
		})
	}

	if (savingsRate < 10) {
		insights.push({
			title: t('insightSavingsLowTitle'),
			detail: t('insightSavingsLowDetail', { rate: savingsRate.toFixed(1) }),
			tone: 'warning',
			actionLabel: t('viewTransactions'),
			onAction: openTransactionsForCurrentFilters,
		})
	} else if (savingsRate >= 20) {
		insights.push({
			title: t('insightSavingsGoodTitle'),
			detail: t('insightSavingsGoodDetail', { rate: savingsRate.toFixed(1) }),
			tone: 'positive',
		})
	}

	if (topCategory && topCategoryShare >= 40) {
		insights.push({
			title: t('insightCategoryConcentrationTitle'),
			detail: t('insightCategoryConcentrationDetail', {
				category: topCategory.label,
				share: topCategoryShare.toFixed(1),
			}),
			tone: 'neutral',
			actionLabel: hasBudgetForTopCategory ? t('viewTransactions') : t('createBudgetCta'),
			onAction: hasBudgetForTopCategory
				? () => openCategoryTransactions(topCategory.id)
				: () => openBudgetCreateForCategory(topCategory.id),
		})
	}

	if (insights.length === 0) {
		insights.push({
			title: t('insightBalancedTitle'),
			detail: t('insightBalancedDetail'),
			tone: 'positive',
		})
	}

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.5 }}
			className='space-y-6 mb-10'
		>
			{activeFilterBadges.length > 0 && (
				<Card>
					<CardContent className='pt-6'>
						<div className='mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
							{t('activeFilters')}
						</div>
						<div className='flex flex-wrap gap-2'>
							{activeFilterBadges.map((badge) => (
								<Badge key={badge} variant='secondary'>
									{badge}
								</Badge>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			<div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
				<Card>
					<CardHeader className='pb-1'>
						<CardTitle className='text-sm font-medium text-muted-foreground'>{t('income')}</CardTitle>
					</CardHeader>
					<CardContent className='pt-0'>
						<p className='text-2xl font-semibold'>{formatDOP(totalIncome)}</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className='pb-1'>
						<CardTitle className='text-sm font-medium text-muted-foreground'>{t('expense')}</CardTitle>
					</CardHeader>
					<CardContent className='pt-0'>
						<div className='flex items-center gap-2'>
							<p className='text-2xl font-semibold'>{formatDOP(totalExpenses)}</p>
							{expenseDelta !== 0 && (
								<span className={`text-xs font-medium ${expenseDelta > 0 ? 'text-destructive' : 'text-success'}`}>
									{expenseDelta > 0 ? '+' : ''}
									{expenseDelta.toFixed(1)}%
								</span>
							)}
						</div>
						<p className='text-xs text-muted-foreground'>{t('vsPreviousPeriod')}</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className='pb-1'>
						<CardTitle className='text-sm font-medium text-muted-foreground'>{t('savingsRate')}</CardTitle>
					</CardHeader>
					<CardContent className='pt-0'>
						<div className='flex items-center gap-2'>
							<p className='text-2xl font-semibold'>{savingsRate.toFixed(1)}%</p>
							{savingsRate >= 20 ? (
								<TrendingUp className='h-4 w-4 text-success' />
							) : (
								<TrendingDown className='h-4 w-4 text-destructive' />
							)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className='pb-1'>
						<CardTitle className='text-sm font-medium text-muted-foreground'>{t('dailySpend')}</CardTitle>
					</CardHeader>
					<CardContent className='pt-0'>
						<div className='flex items-center gap-2'>
							<Wallet className='h-4 w-4 text-muted-foreground' />
							<p className='text-2xl font-semibold'>{formatDOP(avgDailySpend)}</p>
						</div>
						<p className='text-xs text-muted-foreground'>{t('daysAnalyzed', { days: daysInRange })}</p>
					</CardContent>
				</Card>
			</div>

			<div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
				{insights.slice(0, 3).map((insight) => (
					<Card key={insight.title}>
						<CardContent className='pt-6'>
							<p
								className={`text-sm font-semibold ${insight.tone === 'warning' ? 'text-amber-600' : insight.tone === 'positive' ? 'text-emerald-600' : 'text-foreground'}`}
							>
								{insight.title}
							</p>
							<p className='mt-1 text-sm text-muted-foreground'>{insight.detail}</p>
							{insight.actionLabel && insight.onAction && (
								<Button
									type='button'
									variant='ghost'
									size='sm'
									className='mt-2 h-7 px-2 text-xs'
									onClick={insight.onAction}
								>
									{insight.actionLabel}
								</Button>
							)}
						</CardContent>
					</Card>
				))}
			</div>

			{topCategory && (
				<Card>
					<CardContent className='pt-6'>
						<p className='text-sm text-muted-foreground'>{t('topCategoryPeriod')}</p>
						<p className='text-lg font-semibold text-foreground'>{topCategory.label}</p>
						<p className='text-sm text-muted-foreground'>
							{formatDOP(topCategory.value)} · {t('transactionsCount', { count: topCategory.transaction_count })}
						</p>
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader>
					<div className='flex items-center justify-between gap-3'>
						<CardTitle>{t('budgetVsActual')}</CardTitle>
						{budgetVsRealRows.length > 0 && (
							<Badge variant={overBudgetCount > 0 ? 'destructive' : 'secondary'}>
								{overBudgetCount > 0 ? t('budgetsExceededBadge', { count: overBudgetCount }) : t('budgetsOnTrackBadge')}
							</Badge>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{budgetVsRealRows.length === 0 ? (
						<p className='text-sm text-muted-foreground'>{t('noBudgetsForComparison')}</p>
					) : (
						<>
							<div className='grid grid-cols-1 gap-4 md:grid-cols-4 mb-6'>
								<div className='rounded-lg border border-border/60 p-3'>
									<p className='text-xs text-muted-foreground'>{t('plannedBudget')}</p>
									<p className='text-lg font-semibold'>{formatDOP(totalBudgetPlanned)}</p>
								</div>
								<div className='rounded-lg border border-border/60 p-3'>
									<p className='text-xs text-muted-foreground'>{t('realSpent')}</p>
									<p className='text-lg font-semibold'>{formatDOP(totalBudgetSpent)}</p>
								</div>
								<div className='rounded-lg border border-border/60 p-3'>
									<p className='text-xs text-muted-foreground'>{t('remainingBudget')}</p>
									<p
										className={`text-lg font-semibold ${totalBudgetRemaining >= 0 ? 'text-emerald-600' : 'text-destructive'}`}
									>
										{formatDOP(totalBudgetRemaining)}
									</p>
								</div>
								<div className='rounded-lg border border-border/60 p-3'>
									<p className='text-xs text-muted-foreground'>{t('projectedMonthClose')}</p>
									<p
										className={`text-lg font-semibold ${projectedVsBudget > 100 ? 'text-destructive' : 'text-amber-600'}`}
									>
										{formatDOP(projectedSpent)}
									</p>
								</div>
							</div>

							<div className='space-y-3'>
								{budgetVsRealRows.slice(0, 6).map((row) => {
									const cappedProgress = Math.min(Math.max(row.progress, 0), 100)
									const progressToneClass =
										row.progress > 100 ? 'bg-red-500' : row.progress > 85 ? 'bg-amber-500' : 'bg-emerald-500'

									return (
										<div key={row.id} className='rounded-lg border border-border/50 p-3'>
											<div className='mb-1 flex items-center justify-between gap-3'>
												<p className='text-sm font-medium text-foreground'>{row.categoryLabel}</p>
												<div className='flex items-center gap-2'>
													<p className='text-xs text-muted-foreground'>
														{formatDOP(row.spent)} / {formatDOP(row.budgetAmount)}
													</p>
													<Button
														type='button'
														variant='ghost'
														size='sm'
														className='h-7 px-2 text-xs'
														onClick={() => openCategoryTransactions(row.categoryId)}
													>
														{t('viewTransactions')}
													</Button>
												</div>
											</div>
											<div className='mb-2 h-2 w-full overflow-hidden rounded-full bg-muted'>
												<div
													className={`h-full rounded-full ${progressToneClass}`}
													style={{ width: `${Math.max(cappedProgress, cappedProgress > 0 ? 4 : 0)}%` }}
												/>
											</div>
											<div className='flex items-center justify-between text-xs'>
												<span className={row.remaining >= 0 ? 'text-emerald-600' : 'text-destructive'}>
													{row.remaining >= 0
														? t('budgetRemainingValue', { amount: formatDOP(row.remaining) })
														: t('budgetExceededValue', { amount: formatDOP(Math.abs(row.remaining)) })}
												</span>
												<span className='text-muted-foreground'>{row.progress.toFixed(1)}%</span>
											</div>
										</div>
									)
								})}
							</div>
						</>
					)}
				</CardContent>
			</Card>

			<div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
				<Card>
					<CardHeader>
						<CardTitle>{t('incomeExpensesByMonth')}</CardTitle>
					</CardHeader>
					<CardContent style={{ height: 300 }}>
						<AnalysisLineChart
							data={
								monthlySummary && monthlySummary.length > 0
									? [
											{
												id: t('income'),
												color: '#22c55e',
												data: monthlySummary.map((m) => ({ x: m.month, y: m.Ingresos })),
											},
											{
												id: t('expenses'),
												color: '#f97316',
												data: monthlySummary.map((m) => ({ x: m.month, y: Math.abs(m.Gastos) })),
											},
										]
									: []
							}
							theme={theme}
							nivoTheme={nivoTheme}
							t={{
								income: t('income'),
								expenses: t('expenses'),
								month: t('month'),
								amount: t('amount'),
							}}
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>{t('expensesByCategory')}</CardTitle>
					</CardHeader>
					<CardContent style={{ height: 300 }}>
						<AnalysisBarChart
							data={
								categoryExpenses && categoryExpenses.length > 0
									? categoryExpenses.map((cat) => ({ categoria: cat.label, monto: normalizeAmount(cat.value) }))
									: []
							}
							nivoTheme={nivoTheme}
							t={{
								category: t('category'),
								amount: t('amount'),
							}}
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>{t('categoryDistribution')}</CardTitle>
					</CardHeader>
					<CardContent style={{ height: 300 }}>
						<AnalysisPieChart
							data={
								categoryExpenses && categoryExpenses.length > 0
									? categoryExpenses.map((cat, index) => ({
											id: cat.label || cat.id,
											label: cat.label || cat.id,
											value: normalizeAmount(cat.value),
											color: cat.color || categoryPalette[index % categoryPalette.length],
										}))
									: []
							}
							theme={theme}
							nivoTheme={nivoTheme}
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>{t('categoryRadar')}</CardTitle>
					</CardHeader>
					<CardContent style={{ height: 300 }}>
						<AnalysisRadarChart
							data={
								categoryExpenses && categoryExpenses.length > 0
									? categoryExpenses.map((cat) => ({
											categoria: cat.label,
											[t('expenses')]: normalizeAmount(cat.value),
										}))
									: []
							}
							nivoTheme={nivoTheme}
							t={{
								expenses: t('expenses'),
							}}
						/>
					</CardContent>
				</Card>

				<Card className='md:col-span-2'>
					<CardHeader>
						<CardTitle>{t('weeklyHeatmap')}</CardTitle>
					</CardHeader>
					<CardContent style={{ height: 300 }}>
						<AnalysisHeatMap
							data={mockHeat}
							nivoTheme={nivoTheme}
							t={{
								month: t('month'),
								day: t('day'),
							}}
						/>
					</CardContent>
				</Card>
			</div>
		</motion.div>
	)
}
