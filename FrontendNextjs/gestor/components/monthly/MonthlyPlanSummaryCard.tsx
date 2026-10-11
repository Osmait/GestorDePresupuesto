'use client'

import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Amount } from '@/components/shared/Amount'
import { StatStrip, StatStripItem } from '@/components/shared/StatStrip'
import { Progress, type ProgressTone } from '@/components/ui/progress'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { PLAN_CURRENCY } from '@/lib/monthlyPlanUtils'
import { MonthlyPlanSummary } from '@/types/monthlyPlan'

/** Neutral while there is room, amber close to the limit, red once expenses exceed income. */
function committedTone(percentage: number): ProgressTone {
	if (percentage > 100) return 'destructive'
	if (percentage > 85) return 'warning'
	return 'default'
}

interface MonthlyPlanSummaryCardProps {
	summary: MonthlyPlanSummary
	/** Paused fixed expenses (the backend counts only the active ones). */
	pausedExpenses?: number
}

/**
 * The headline of the feature as one compact strip. Every total comes straight
 * from the backend so the currency conversion happens in exactly one place.
 */
export function MonthlyPlanSummaryCard({ summary, pausedExpenses = 0 }: MonthlyPlanSummaryCardProps) {
	const t = useTranslations('monthlyPlan')
	const formatPercent = useFormatPercent()
	const formatCurrency = useFormatCurrency()
	const isOvercommitted = summary.available < 0

	return (
		<StatStrip
			label={t('summaryTitle')}
			footer={
				summary.usd_to_dop_rate > 0
					? t('rateNote', { rate: formatCurrency(summary.usd_to_dop_rate, PLAN_CURRENCY) })
					: undefined
			}
		>
			<StatStripItem
				data-testid='summary-income'
				label={t('totalIncome')}
				tone='positive'
				value={<Amount value={summary.total_income} currency={PLAN_CURRENCY} />}
				hint={t('incomeHint', { count: summary.income_count })}
			/>
			<StatStripItem
				data-testid='summary-expenses'
				label={t('totalExpenses')}
				value={<Amount value={summary.total_expenses} currency={PLAN_CURRENCY} />}
				hint={
					pausedExpenses > 0
						? t('expensesHintPaused', { active: summary.expenses_count, paused: pausedExpenses })
						: t('expensesHint', { active: summary.expenses_count })
				}
			/>
			<StatStripItem
				data-testid='summary-available'
				label={t('available')}
				tone={isOvercommitted ? 'negative' : 'default'}
				value={<Amount value={summary.available} currency={PLAN_CURRENCY} />}
				hint={
					isOvercommitted ? (
						<span className='flex items-center gap-1 text-destructive'>
							<AlertTriangle className='h-3 w-3 shrink-0' aria-hidden='true' />
							{t('overcommitted')}
						</span>
					) : (
						t('availableHint')
					)
				}
			/>
			<StatStripItem
				data-testid='summary-committed'
				label={t('committed')}
				value={formatPercent(summary.committed_percentage)}
				hint={
					// Only the bar is capped at 100%; the printed percentage still tells the truth.
					<Progress
						className='mt-1.5 h-1.5'
						value={summary.committed_percentage}
						tone={committedTone(summary.committed_percentage)}
						aria-label={t('committedBar')}
					/>
				}
			/>
		</StatStrip>
	)
}
