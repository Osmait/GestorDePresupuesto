'use client'

import { domAnimation, LazyMotion, m } from 'framer-motion'
import {
	AlertTriangle,
	ArrowDownRight,
	ArrowUpRight,
	BarChart3,
	CalendarRange,
	CheckCircle2,
	Info,
	PiggyBank,
	Plus,
	Wallet,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type ComponentType, type ReactNode, useMemo } from 'react'
import { Amount } from '@/components/shared/Amount'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatCard } from '@/components/shared/StatCard'
import { StatGrid } from '@/components/shared/StatGrid'
import { AnalyticsSkeleton } from '@/components/skeletons/analytics-skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getProgressTone, Progress } from '@/components/ui/progress'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useGetDashboardSummary } from '@/hooks/queries/useAnalyticsQuery'
import { useGetBudgets } from '@/hooks/queries/useBudgetsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { cn } from '@/lib/utils'
import { useAnalysisContext } from './AnalysisContext'
import { buildAnalyticsFilters, buildPreviousPeriodFilters, daysBetween, fromApiDate } from './analysis-query'

function ChartLoading() {
	return <div className='h-full w-full animate-pulse rounded-md bg-muted/40' />
}

const AnalysisLineChart = dynamic(() => import('@/components/charts/AnalysisLineChart'), {
	ssr: false,
	loading: ChartLoading,
})
const AnalysisBarChart = dynamic(() => import('@/components/charts/AnalysisBarChart'), {
	ssr: false,
	loading: ChartLoading,
})
const AnalysisPieChart = dynamic(() => import('@/components/charts/AnalysisPieChart'), {
	ssr: false,
	loading: ChartLoading,
})
const AnalysisRadarChart = dynamic(() => import('@/components/charts/AnalysisRadarChart'), {
	ssr: false,
	loading: ChartLoading,
})

/** True when there is at least one finite, non-zero value: nivo renders `d="null"`/NaN paths otherwise. */
export function hasPlottableValues(values: Array<number | null | undefined>): boolean {
	return values.some((value) => typeof value === 'number' && Number.isFinite(value) && value !== 0)
}

type InsightTone = 'neutral' | 'warning' | 'positive'

const INSIGHT_ICON: Record<InsightTone, { icon: ComponentType<{ className?: string }>; className: string }> = {
	warning: { icon: AlertTriangle, className: 'text-warning' },
	positive: { icon: CheckCircle2, className: 'text-success' },
	neutral: { icon: Info, className: 'text-info' },
}

function ChartCard({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle className='text-lg'>{title}</CardTitle>
			</CardHeader>
			<CardContent className='h-[300px]'>{children}</CardContent>
		</Card>
	)
}

// m + LazyMotion(domAnimation) instead of motion: only a fade is used, so the
// full feature bundle (layout, drag) is not needed.
export function AnalysisDashboard() {
	return (
		<LazyMotion features={domAnimation}>
			<AnalysisDashboardView />
		</LazyMotion>
	)
}

function AnalysisDashboardView() {
	const router = useRouter()
	const t = useTranslations('analysis')
	const locale = useAppLocale()
	const formatCurrency = useFormatCurrency()
	const formatPercent = useFormatPercent()
	const { filters } = useAnalysisContext()
	const { data: accounts = [] } = useGetAccounts()
	const { data: categories = [] } = useGetCategories()
	const { data: budgets = [] } = useGetBudgets()

	const activeFilters = useMemo(() => buildAnalyticsFilters(filters), [filters])
	const previousPeriodFilters = useMemo(() => buildPreviousPeriodFilters(activeFilters), [activeFilters])

	const {
		data: dashboardSummary,
		isLoading: isLoadingDashboardSummary,
		isError,
		refetch,
	} = useGetDashboardSummary(activeFilters)
	const { data: previousSummary } = useGetDashboardSummary(previousPeriodFilters)

	if (isLoadingDashboardSummary) return <AnalyticsSkeleton />
	if (isError && !dashboardSummary) {
		return (
			<Card>
				<ErrorState title={t('errorTitle')} onRetry={() => refetch()} />
			</Card>
		)
	}

	const categoryExpenses = dashboardSummary?.category_expenses || []
	const monthlySummary = dashboardSummary?.monthly_summary || []
	// Analytics amounts come from the API converted to DOP.
	const formatDOP = (value: number) => formatCurrency(value, 'DOP')

	const totalIncome = dashboardSummary?.total_income || 0
	const totalExpenses = dashboardSummary?.total_expenses || 0
	const netAmount = dashboardSummary?.net_amount || 0
	// Without income there is no meaningful savings rate (avoid "Ahorro bajo 0.0%").
	const savingsRate = totalIncome > 0 ? (netAmount / totalIncome) * 100 : null

	const selectedFrom = activeFilters.date_from ? fromApiDate(activeFilters.date_from) : null
	const selectedTo = activeFilters.date_to ? fromApiDate(activeFilters.date_to) : null
	const daysInRange = selectedFrom && selectedTo ? daysBetween(selectedFrom, selectedTo) : 30

	const avgDailySpend = totalExpenses / daysInRange

	const monthsWithExpenses = monthlySummary.filter((month) => Math.abs(month.Gastos) > 0)
	const avgMonthlyExpense =
		monthsWithExpenses.length > 0
			? monthsWithExpenses.reduce((sum, month) => sum + Math.abs(month.Gastos), 0) / monthsWithExpenses.length
			: 0

	const previousExpenses = previousSummary?.total_expenses || 0
	const expenseDelta = previousExpenses > 0 ? ((totalExpenses - previousExpenses) / previousExpenses) * 100 : 0

	const topCategory = [...categoryExpenses].sort((a, b) => b.value - a.value)[0]
	const normalizeAmount = (value: number) => Math.round(Math.abs(value) * 100) / 100
	const topCategoryShare = totalExpenses > 0 && topCategory ? (topCategory.value / totalExpenses) * 100 : 0
	const hasBudgetForTopCategory = topCategory ? budgets.some((budget) => budget.category_id === topCategory.id) : false

	const accountName = accounts.find((account) => account.id === filters.account)?.name
	const categoryName = categories.find((category) => category.id === filters.category)?.name

	const periodBadge =
		filters.filterMode === 'month'
			? filters.month === 'all'
				? `${t('year')}: ${filters.year}`
				: formatLocalDate(new Date(Number(filters.year), Number(filters.month) - 1, 1), locale, {
						month: 'long',
						year: 'numeric',
					})
			: selectedFrom && selectedTo
				? `${formatLocalDate(selectedFrom, locale)} – ${formatLocalDate(selectedTo, locale)}`
				: null

	const activeFilterBadges = [
		periodBadge,
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
		tone: InsightTone
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
	const projectedTone = getProgressTone(projectedVsBudget)

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
			detail: t('insightExpenseUpDetail', { delta: formatPercent(expenseDelta) }),
			tone: 'warning',
			actionLabel: t('viewTransactions'),
			onAction: openTransactionsForCurrentFilters,
		})
	}

	const hasActivity =
		totalIncome > 0 || totalExpenses > 0 || hasPlottableValues(categoryExpenses.map((item) => item.value))

	if (savingsRate !== null && savingsRate < 10) {
		insights.push({
			title: t('insightSavingsLowTitle'),
			detail: t('insightSavingsLowDetail', { rate: formatPercent(savingsRate) }),
			tone: 'warning',
			actionLabel: t('viewTransactions'),
			onAction: openTransactionsForCurrentFilters,
		})
	} else if (savingsRate !== null && savingsRate >= 20) {
		insights.push({
			title: t('insightSavingsGoodTitle'),
			detail: t('insightSavingsGoodDetail', { rate: formatPercent(savingsRate) }),
			tone: 'positive',
		})
	}

	if (topCategory && topCategoryShare >= 40) {
		insights.push({
			title: t('insightCategoryConcentrationTitle'),
			detail: t('insightCategoryConcentrationDetail', {
				category: topCategory.label,
				share: formatPercent(topCategoryShare),
			}),
			tone: 'neutral',
			actionLabel: hasBudgetForTopCategory ? t('viewTransactions') : t('createBudgetCta'),
			onAction: hasBudgetForTopCategory
				? () => openCategoryTransactions(topCategory.id)
				: () => openBudgetCreateForCategory(topCategory.id),
		})
	}

	if (insights.length === 0 && hasActivity) {
		insights.push({
			title: t('insightBalancedTitle'),
			detail: t('insightBalancedDetail'),
			tone: 'positive',
		})
	}

	const savingsTone =
		savingsRate === null ? 'default' : savingsRate >= 20 ? 'positive' : savingsRate < 0 ? 'negative' : 'default'
	const noDataState = <EmptyState compact icon={BarChart3} title={t('noData')} className='h-full' />

	return (
		<m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className='space-y-6'>
			{activeFilterBadges.length > 0 && (
				<div className='flex flex-wrap items-center gap-2'>
					<span className='text-sm text-muted-foreground'>{t('activeFilters')}:</span>
					{activeFilterBadges.map((badge) => (
						<Badge key={badge} variant='secondary' className='font-medium'>
							{badge}
						</Badge>
					))}
				</div>
			)}

			<StatGrid columns={5}>
				<StatCard
					label={t('income')}
					icon={ArrowUpRight}
					tone='positive'
					value={<Amount value={totalIncome} currency='DOP' />}
				/>
				<StatCard
					label={t('expense')}
					icon={ArrowDownRight}
					tone='negative'
					value={<Amount value={totalExpenses} currency='DOP' />}
					hint={
						expenseDelta !== 0 ? (
							<>
								<span
									className={cn('font-medium tabular-nums', expenseDelta > 0 ? 'text-destructive' : 'text-success')}
								>
									{formatPercent(expenseDelta, { signDisplay: 'exceptZero' })}
								</span>{' '}
								{t('vsPreviousPeriod')}
							</>
						) : undefined
					}
				/>
				<StatCard
					label={t('savingsRate')}
					icon={PiggyBank}
					tone={savingsTone}
					value={savingsRate === null ? '—' : formatPercent(savingsRate)}
				/>
				<StatCard
					label={t('dailySpend')}
					icon={Wallet}
					value={<Amount value={avgDailySpend} currency='DOP' />}
					hint={t('daysAnalyzed', { days: daysInRange })}
				/>
				<StatCard
					label={t('monthlyAvgExpense')}
					icon={CalendarRange}
					value={<Amount value={avgMonthlyExpense} currency='DOP' />}
					hint={
						monthsWithExpenses.length > 0
							? t('monthsAnalyzed', { months: monthsWithExpenses.length })
							: t('noMonthlyData')
					}
				/>
			</StatGrid>

			{!hasActivity && (
				<Card>
					<EmptyState
						icon={BarChart3}
						title={t('emptyTitle')}
						description={t('emptyDescription')}
						className='min-h-0'
					/>
				</Card>
			)}

			{insights.length > 0 && (
				<div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
					{insights.slice(0, 3).map((insight) => {
						const { icon: InsightIcon, className: iconClass } = INSIGHT_ICON[insight.tone]
						return (
							<Card key={insight.title}>
								<CardContent className='flex gap-3 pt-6'>
									<InsightIcon className={cn('mt-0.5 h-4 w-4 shrink-0', iconClass)} aria-hidden='true' />
									<div className='min-w-0'>
										<p className='text-sm font-semibold text-foreground'>{insight.title}</p>
										<p className='mt-1 text-sm text-muted-foreground'>{insight.detail}</p>
										{insight.actionLabel && insight.onAction && (
											<Button type='button' variant='outline' size='sm' className='mt-3' onClick={insight.onAction}>
												{insight.actionLabel}
											</Button>
										)}
									</div>
								</CardContent>
							</Card>
						)
					})}
				</div>
			)}

			{topCategory && (
				<Card>
					<CardContent className='pt-6'>
						<p className='text-sm text-muted-foreground'>{t('topCategoryPeriod')}</p>
						<p className='text-lg font-semibold text-foreground'>{topCategory.label}</p>
						<p className='text-sm text-muted-foreground'>
							<Amount value={topCategory.value} currency='DOP' /> ·{' '}
							{t('transactionsCount', { count: topCategory.transaction_count })}
						</p>
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader>
					<div className='flex flex-wrap items-center justify-between gap-3'>
						<CardTitle className='text-lg'>{t('budgetVsActual')}</CardTitle>
						{budgetVsRealRows.length > 0 && (
							<Badge variant={overBudgetCount > 0 ? 'destructive' : 'secondary'}>
								{overBudgetCount > 0 ? t('budgetsExceededBadge', { count: overBudgetCount }) : t('budgetsOnTrackBadge')}
							</Badge>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{budgetVsRealRows.length === 0 ? (
						<EmptyState
							compact
							icon={PiggyBank}
							title={t('noBudgetsForComparison')}
							action={
								<Button asChild variant='outline' size='sm'>
									<Link href='/app/budget?create=1'>
										<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
										{t('createBudgetCta')}
									</Link>
								</Button>
							}
						/>
					) : (
						<>
							<dl className='mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
								<div className='rounded-lg border p-3'>
									<dt className='text-xs text-muted-foreground'>{t('plannedBudget')}</dt>
									<dd className='text-lg font-semibold'>
										<Amount value={totalBudgetPlanned} currency='DOP' />
									</dd>
								</div>
								<div className='rounded-lg border p-3'>
									<dt className='text-xs text-muted-foreground'>{t('realSpent')}</dt>
									<dd className='text-lg font-semibold'>
										<Amount value={totalBudgetSpent} currency='DOP' />
									</dd>
								</div>
								<div className='rounded-lg border p-3'>
									<dt className='text-xs text-muted-foreground'>{t('remainingBudget')}</dt>
									<dd className='text-lg font-semibold'>
										<Amount value={totalBudgetRemaining} currency='DOP' tone='auto' />
									</dd>
								</div>
								<div className='rounded-lg border p-3'>
									<dt className='text-xs text-muted-foreground'>{t('projectedMonthClose')}</dt>
									<dd className='text-lg font-semibold'>
										<Amount
											value={projectedSpent}
											currency='DOP'
											tone={
												projectedTone === 'destructive'
													? 'negative'
													: projectedTone === 'warning'
														? 'warning'
														: 'neutral'
											}
										/>
									</dd>
								</div>
							</dl>

							<ul className='space-y-3'>
								{budgetVsRealRows.slice(0, 6).map((row) => (
									<li key={row.id} className='rounded-lg border p-3'>
										<div className='mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1'>
											<p className='min-w-0 truncate text-sm font-medium text-foreground'>{row.categoryLabel}</p>
											<div className='flex flex-wrap items-center gap-2'>
												<p className='text-xs text-muted-foreground tabular-nums'>
													{formatDOP(row.spent)} / {formatDOP(row.budgetAmount)}
												</p>
												<Button
													type='button'
													variant='ghost'
													size='sm'
													onClick={() => openCategoryTransactions(row.categoryId)}
												>
													{t('viewTransactions')}
												</Button>
											</div>
										</div>
										<Progress
											value={row.progress}
											tone={getProgressTone(row.progress, { warningAt: 85, dangerAt: 100.01 })}
											aria-label={t('budgetUsageLabel', {
												category: row.categoryLabel,
												percent: formatPercent(row.progress),
											})}
											className='mb-2'
										/>
										<div className='flex items-center justify-between gap-2 text-xs'>
											<span className={row.remaining >= 0 ? 'text-success' : 'text-destructive'}>
												{row.remaining >= 0
													? t('budgetRemainingValue', { amount: formatDOP(row.remaining) })
													: t('budgetExceededValue', { amount: formatDOP(Math.abs(row.remaining)) })}
											</span>
											<span className='text-muted-foreground tabular-nums'>{formatPercent(row.progress)}</span>
										</div>
									</li>
								))}
							</ul>
						</>
					)}
				</CardContent>
			</Card>

			<div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
				<ChartCard title={t('incomeExpensesByMonth')}>
					{!hasPlottableValues(monthlySummary.flatMap((month) => [month.Ingresos, month.Gastos])) ? (
						noDataState
					) : (
						<AnalysisLineChart
							label={t('chartLabel', { title: t('incomeExpensesByMonth') })}
							data={[
								{
									id: t('income'),
									data: monthlySummary.map((month) => ({ x: month.month, y: month.Ingresos })),
								},
								{
									id: t('expenses'),
									data: monthlySummary.map((month) => ({ x: month.month, y: Math.abs(month.Gastos) })),
								},
							]}
							t={{
								income: t('income'),
								expenses: t('expenses'),
								month: t('month'),
								amount: t('amount'),
							}}
						/>
					)}
				</ChartCard>

				<ChartCard title={t('expensesByCategory')}>
					{!hasPlottableValues(categoryExpenses.map((category) => category.value)) ? (
						noDataState
					) : (
						<AnalysisBarChart
							label={t('chartLabel', { title: t('expensesByCategory') })}
							data={categoryExpenses.map((category) => ({
								categoria: category.label,
								monto: normalizeAmount(category.value),
							}))}
							t={{
								category: t('category'),
								amount: t('amount'),
							}}
						/>
					)}
				</ChartCard>

				<ChartCard title={t('categoryDistribution')}>
					{!hasPlottableValues(categoryExpenses.map((category) => category.value)) ? (
						noDataState
					) : (
						<AnalysisPieChart
							label={t('chartLabel', { title: t('categoryDistribution') })}
							data={categoryExpenses.map((category) => ({
								id: category.label || category.id,
								label: category.label || category.id,
								value: normalizeAmount(category.value),
								color: category.color || undefined,
							}))}
						/>
					)}
				</ChartCard>

				<ChartCard title={t('categoryRadar')}>
					{/* A radar needs at least 3 axes to draw a polygon. */}
					{categoryExpenses.length < 3 || !hasPlottableValues(categoryExpenses.map((category) => category.value)) ? (
						noDataState
					) : (
						<AnalysisRadarChart
							label={t('chartLabel', { title: t('categoryRadar') })}
							data={categoryExpenses.map((category) => ({
								categoria: category.label,
								[t('expenses')]: normalizeAmount(category.value),
							}))}
							t={{
								expenses: t('expenses'),
							}}
						/>
					)}
				</ChartCard>
			</div>
		</m.div>
	)
}
