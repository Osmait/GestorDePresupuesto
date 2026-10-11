'use client'

import { BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { AnalyticsSkeleton } from '@/components/skeletons/analytics-skeleton'
import { Card } from '@/components/ui/card'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { AnalysisHero } from './AnalysisHero'
import { BudgetPace } from './BudgetPace'
import { CategoryBreakdown } from './CategoryBreakdown'
import { CategoryChanges } from './CategoryChanges'
import { MonthlyTrend } from './MonthlyTrend'
import { PlanVsActual } from './PlanVsActual'
import { TopExpenses } from './TopExpenses'
import { useAnalysisReport } from './useAnalysisReport'
import { useAnalysisUrlState } from './useAnalysisUrlState'

/** The Analytics report for the period and account in the URL. */
export function AnalysisDashboard() {
	const t = useTranslations('analysis')
	const { period, today, accountId } = useAnalysisUrlState()
	const { data: accounts = [] } = useGetAccounts()
	const {
		report,
		filters,
		isLoading,
		isError,
		refetch,
		planLoading,
		budgetsLoading,
		budgetsError,
		refetchBudgets,
		topExpenses,
		topLoading,
	} = useAnalysisReport(period, today, accountId)

	if (isError) {
		return (
			<Card>
				<ErrorState title={t('errorTitle')} onRetry={refetch} />
			</Card>
		)
	}
	if (isLoading || !report) return <AnalyticsSkeleton />

	if (!report.hasActivity) {
		return (
			<Card>
				<EmptyState icon={BarChart3} title={t('emptyTitle')} description={t('emptyDescription')} />
			</Card>
		)
	}

	const isMonth = report.resolved.period.mode === 'month'
	const accountName = accountId ? accounts.find((account) => account.id === accountId)?.name : undefined

	return (
		<div className='space-y-6'>
			<AnalysisHero report={report} />

			<div className='grid items-stretch gap-6 lg:grid-cols-2'>
				<CategoryChanges report={report} />
				{isMonth ? (
					<BudgetPace
						report={report}
						loading={budgetsLoading || planLoading}
						error={budgetsError}
						onRetry={() => void refetchBudgets()}
						accountName={accountName}
					/>
				) : (
					<TopExpenses expenses={topExpenses} loading={topLoading} filters={filters} />
				)}
			</div>

			{isMonth ? (
				<div className='grid items-stretch gap-6 lg:grid-cols-2'>
					<PlanVsActual report={report} loading={planLoading} />
					<TopExpenses expenses={topExpenses} loading={topLoading} filters={filters} />
				</div>
			) : null}

			<div className='grid items-stretch gap-6 lg:grid-cols-[3fr_2fr]'>
				<MonthlyTrend months={report.trend} />
				<CategoryBreakdown categories={report.categories} current={isMonth && report.resolved.inProgress} />
			</div>
		</div>
	)
}
