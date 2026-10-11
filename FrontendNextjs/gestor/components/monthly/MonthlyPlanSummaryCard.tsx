'use client'

import { AlertTriangle, ArrowDownRight, ArrowUpRight, PieChart, Wallet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Amount } from '@/components/shared/Amount'
import { StatCard } from '@/components/shared/StatCard'
import { StatGrid } from '@/components/shared/StatGrid'
import { Progress, type ProgressTone } from '@/components/ui/progress'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { getIntlLocale, useAppLocale } from '@/lib/i18n/date-locale'
import { PLAN_CURRENCY } from '@/lib/monthlyPlanUtils'
import { MonthlyPlanSummary } from '@/types/monthlyPlan'

/** Neutral while there is room, amber close to the limit, red once expenses exceed income. */
function committedTone(percentage: number): ProgressTone {
	if (percentage > 100) return 'destructive'
	if (percentage > 85) return 'warning'
	return 'default'
}

/**
 * The headline of the feature. Every number comes straight from the backend so
 * the currency conversion happens in exactly one place.
 */
export function MonthlyPlanSummaryCard({ summary }: { summary: MonthlyPlanSummary }) {
	const t = useTranslations('monthlyPlan')
	const locale = useAppLocale()

	const isOvercommitted = summary.available < 0
	const formatPercent = useFormatPercent()
	const rateFormatter = new Intl.NumberFormat(getIntlLocale(locale), {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})

	return (
		<section aria-label={t('summaryTitle')} className='space-y-2'>
			<StatGrid>
				<div data-testid='summary-income'>
					<StatCard
						className='h-full'
						label={t('totalIncome')}
						icon={ArrowUpRight}
						tone='positive'
						value={<Amount value={summary.total_income} currency={PLAN_CURRENCY} animate />}
						hint={t('itemsCount', { count: summary.income_count })}
					/>
				</div>

				<div data-testid='summary-expenses'>
					<StatCard
						className='h-full'
						label={t('totalExpenses')}
						icon={ArrowDownRight}
						tone='negative'
						value={<Amount value={summary.total_expenses} currency={PLAN_CURRENCY} animate />}
						hint={t('itemsCount', { count: summary.expenses_count })}
					/>
				</div>

				<div data-testid='summary-available'>
					<StatCard
						className='h-full'
						label={t('available')}
						icon={Wallet}
						tone={isOvercommitted ? 'negative' : 'default'}
						value={<Amount value={summary.available} currency={PLAN_CURRENCY} animate />}
						hint={
							isOvercommitted ? (
								<span className='flex items-center gap-1 text-destructive'>
									<AlertTriangle className='h-3 w-3 shrink-0' aria-hidden='true' />
									{t('overcommitted')}
								</span>
							) : undefined
						}
					/>
				</div>

				<div data-testid='summary-committed'>
					<StatCard
						className='h-full'
						label={t('committed')}
						icon={PieChart}
						value={
							<>
								{/* Only the bar is capped at 100%; the printed percentage still tells the truth. */}
								<span>{formatPercent(summary.committed_percentage)}</span>
								<Progress
									className='mt-3'
									value={summary.committed_percentage}
									tone={committedTone(summary.committed_percentage)}
									aria-label={t('committedBar')}
								/>
							</>
						}
					/>
				</div>
			</StatGrid>

			{summary.usd_to_dop_rate > 0 && (
				<p className='text-xs text-muted-foreground'>
					{t('rateNote', { rate: rateFormatter.format(summary.usd_to_dop_rate) })}
				</p>
			)}
		</section>
	)
}
