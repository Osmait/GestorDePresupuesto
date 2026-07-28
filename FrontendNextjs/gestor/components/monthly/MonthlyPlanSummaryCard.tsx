'use client'

import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, PieChart, Wallet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MonthlyPlanSummary } from '@/types/monthlyPlan'

/**
 * The headline of the feature. Every number comes straight from the backend so
 * the currency conversion happens in exactly one place.
 */
export function MonthlyPlanSummaryCard({ summary }: { summary: MonthlyPlanSummary }) {
	const t = useTranslations('monthlyPlan')

	const isOvercommitted = summary.available < 0
	// Only the bar is capped at 100%; the printed percentage still tells the truth.
	const barWidth = Math.min(Math.max(summary.committed_percentage, 0), 100)
	const barTone =
		summary.committed_percentage > 100
			? 'bg-red-500'
			: summary.committed_percentage > 85
				? 'bg-amber-500'
				: 'bg-emerald-500'

	return (
		<Card className='border-border/50 dark:border-border/20'>
			<CardHeader>
				<CardTitle className='flex items-center gap-2 text-foreground'>
					<Wallet className='h-5 w-5' />
					{t('summaryTitle')}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
					<div
						className='text-center p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5'
						data-testid='summary-income'
					>
						<ArrowUpCircle className='h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400' />
						<p className='text-sm font-medium text-muted-foreground'>{t('totalIncome')}</p>
						<p className='text-xl font-bold text-green-600 dark:text-green-400'>
							<AnimatedCounter value={summary.total_income} prefix='$' decimals={2} />
						</p>
						<p className='text-xs text-muted-foreground mt-1'>{t('itemsCount', { count: summary.income_count })}</p>
					</div>

					<div
						className='text-center p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-red-500/10 dark:from-orange-500/5 dark:to-red-500/5'
						data-testid='summary-expenses'
					>
						<ArrowDownCircle className='h-6 w-6 mx-auto mb-2 text-orange-600 dark:text-orange-400' />
						<p className='text-sm font-medium text-muted-foreground'>{t('totalExpenses')}</p>
						<p className='text-xl font-bold text-orange-600 dark:text-orange-400'>
							<AnimatedCounter value={summary.total_expenses} prefix='$' decimals={2} />
						</p>
						<p className='text-xs text-muted-foreground mt-1'>{t('itemsCount', { count: summary.expenses_count })}</p>
					</div>

					<div
						className='text-center p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5'
						data-testid='summary-available'
					>
						<Wallet className='h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400' />
						<p className='text-sm font-medium text-muted-foreground'>{t('available')}</p>
						<p
							className={`text-xl font-bold ${isOvercommitted ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}
						>
							<AnimatedCounter value={summary.available} prefix='$' decimals={2} />
						</p>
						{isOvercommitted && (
							<p className='text-xs text-red-600 dark:text-red-400 mt-1 flex items-center justify-center gap-1'>
								<AlertTriangle className='h-3 w-3' />
								{t('overcommitted')}
							</p>
						)}
					</div>

					<div
						className='text-center p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/5 dark:to-pink-500/5'
						data-testid='summary-committed'
					>
						<PieChart className='h-6 w-6 mx-auto mb-2 text-purple-600 dark:text-purple-400' />
						<p className='text-sm font-medium text-muted-foreground'>{t('committed')}</p>
						<p className='text-xl font-bold text-foreground'>
							<AnimatedCounter value={summary.committed_percentage} decimals={1} suffix='%' />
						</p>
						<div className='mt-2 h-2 w-full overflow-hidden rounded-full bg-muted'>
							<div className={`h-full rounded-full ${barTone}`} style={{ width: `${barWidth}%` }} />
						</div>
					</div>
				</div>

				{summary.usd_to_dop_rate > 0 && (
					<p className='text-xs text-muted-foreground mt-4 text-center'>
						{t('rateNote', { rate: summary.usd_to_dop_rate.toFixed(2) })}
					</p>
				)}
			</CardContent>
		</Card>
	)
}
