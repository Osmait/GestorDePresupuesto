'use client'

import { AlertTriangle, CalendarClock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Amount } from '@/components/shared/Amount'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buildTimeline, PLAN_CURRENCY, runningBalance } from '@/lib/monthlyPlanUtils'
import { MonthlyPlanItem } from '@/types/monthlyPlan'

/**
 * Shows the plan ordered by the day of the month with a running balance, so a
 * cash-flow gap becomes visible: rent due on the 1st while the salary only
 * arrives on the 30th leaves the month negative in between, even when the totals
 * add up.
 */
export function MonthlyPlanTimeline({ items }: { items: MonthlyPlanItem[] }) {
	const t = useTranslations('monthlyPlan')
	const timeline = buildTimeline(items)
	const balances = runningBalance(timeline)
	const balanceByDay = new Map(balances.map((entry) => [entry.day, entry.balance]))
	const firstNegative = balances.find((entry) => entry.balance < 0)

	if (timeline.length === 0) {
		return null
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className='flex items-center gap-2 text-base'>
					<CalendarClock className='h-5 w-5 text-muted-foreground' aria-hidden='true' />
					{t('timelineTitle')}
				</CardTitle>
			</CardHeader>
			<CardContent>
				{firstNegative && (
					<div
						role='status'
						className='mb-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm'
					>
						<AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-warning' aria-hidden='true' />
						<p className='text-foreground'>{t('cashGapWarning', { day: firstNegative.day })}</p>
					</div>
				)}

				<div className='space-y-3'>
					{timeline.map((entry) => {
						const balance = balanceByDay.get(entry.day) ?? 0

						return (
							<div
								key={entry.day}
								className='flex items-start gap-3 rounded-lg border border-border p-3'
								data-testid={`timeline-day-${entry.day}`}
							>
								<div className='flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full bg-muted text-xs'>
									<span className='font-bold text-foreground'>{entry.day}</span>
								</div>

								<div className='min-w-0 flex-1'>
									<div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
										{entry.items.map((item) => (
											<span key={item.id} className='text-xs text-muted-foreground'>
												{item.name}{' '}
												<Amount
													value={item.type === 'income' ? item.amount_dop : -item.amount_dop}
													currency={PLAN_CURRENCY}
													tone='auto'
													signed
												/>
											</span>
										))}
									</div>
								</div>

								<div className='shrink-0 text-right'>
									<p className='text-xs text-muted-foreground'>{t('runningBalance')}</p>
									<p className='text-sm font-semibold'>
										<Amount value={balance} currency={PLAN_CURRENCY} tone='auto' />
									</p>
								</div>
							</div>
						)
					})}
				</div>
			</CardContent>
		</Card>
	)
}
