'use client'

import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId, useMemo, useState } from 'react'
import { Amount } from '@/components/shared/Amount'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { PLAN_CURRENCY, type PlanDate, projectMonthFlow } from '@/lib/monthlyPlanUtils'
import { cn } from '@/lib/utils'
import { MonthlyPlanItem } from '@/types/monthlyPlan'
import { MonthlyPlanFlowChart } from './MonthlyPlanFlowChart'

/** Rows of "Next 7 days" shown on mobile before "See the next 7 days". */
const MOBILE_UPCOMING = 4

interface MonthlyPlanFlowCardProps {
	items: MonthlyPlanItem[]
	today: PlanDate
	/** Money in the accounts today (DOP); null while it loads or when it failed. */
	startBalance: number | null
	loading?: boolean
	error?: boolean
	onRetry?: () => void
}

/**
 * "Month cash flow": from the balance the user has today to the projected
 * close of the month, applying the active plan items still to come. Shows the
 * lowest point, the next income and what is due in the next 7 days.
 */
export function MonthlyPlanFlowCard({
	items,
	today,
	startBalance,
	loading = false,
	error = false,
	onRetry,
}: MonthlyPlanFlowCardProps) {
	const t = useTranslations('monthlyPlan')
	const locale = useAppLocale()
	const formatCurrency = useFormatCurrency()
	const titleId = useId()
	const [showAllUpcoming, setShowAllUpcoming] = useState(false)

	const flow = useMemo(
		() => (startBalance === null ? null : projectMonthFlow(items, startBalance, today)),
		[items, startBalance, today],
	)

	const dateOf = (day: number, options: Intl.DateTimeFormatOptions) =>
		formatLocalDate(new Date(today.year, today.month, day), locale, options)
	const longDate = (day: number) => dateOf(day, { day: 'numeric', month: 'long' })
	const shortDate = (day: number) => dateOf(day, { day: 'numeric', month: 'short' }).replace('.', '')
	const money = (value: number) => formatCurrency(value, PLAN_CURRENCY)
	const monthLong = dateOf(1, { month: 'long' })
	const lastDay = new Date(today.year, today.month + 1, 0).getDate()

	const insightSentences = (): string[] => {
		if (!flow) return []
		if (flow.events.length === 0 && flow.noDayTotal === 0) return [t('insightNothingLeft')]
		const sentences: string[] = []
		if (flow.firstNegative) {
			sentences.push(
				t('insightNegative', {
					date: longDate(flow.firstNegative.day),
					amount: money(flow.low.balance),
					lowDate: longDate(flow.low.day),
				}),
			)
		} else if (flow.low.day === flow.today) {
			sentences.push(t('insightLowToday'))
		} else {
			sentences.push(t('insightLow', { amount: money(flow.low.balance), date: longDate(flow.low.day) }))
		}
		if (flow.nextIncome) {
			sentences.push(t('insightNextIncome', { date: longDate(flow.nextIncome.day), name: flow.nextIncome.item.name }))
		}
		if (flow.noDayTotal !== 0) {
			sentences.push(
				t('insightNoDay', { amount: formatCurrency(flow.noDayTotal, PLAN_CURRENCY, { signDisplay: 'exceptZero' }) }),
			)
		}
		return sentences
	}

	return (
		<section aria-labelledby={titleId} className='min-w-0'>
			<Card className='flex flex-col gap-4 p-4 sm:p-5' data-testid='monthly-flow'>
				<div>
					<h2 id={titleId} className='text-base font-semibold'>
						{t('flowTitle')}
					</h2>
					<p className='mt-1 text-sm text-muted-foreground'>
						{t('flowSubtitle', { from: today.day, to: lastDay, month: monthLong })}
					</p>
				</div>

				{error ? (
					<ErrorState
						compact
						title={t('flowErrorTitle')}
						description={t('flowErrorDescription')}
						onRetry={onRetry}
						retryLabel={t('tryAgain')}
					/>
				) : loading || !flow ? (
					<div className='space-y-4' aria-busy='true'>
						<div className='grid grid-cols-2 gap-3'>
							<Skeleton className='h-11' />
							<Skeleton className='h-11' />
						</div>
						<Skeleton className='h-32 w-full' />
						<Skeleton className='h-16 w-full' />
					</div>
				) : (
					<>
						<dl className='grid grid-cols-2 gap-3'>
							<div data-testid='flow-start'>
								<dt className='text-xs text-muted-foreground'>{t('balanceToday')}</dt>
								<dd className='mt-0.5 text-base font-semibold tabular-nums sm:text-lg'>
									<Amount value={flow.start} currency={PLAN_CURRENCY} tone={flow.start < 0 ? 'negative' : 'neutral'} />
								</dd>
							</div>
							<div data-testid='flow-end'>
								<dt className='text-xs text-muted-foreground'>{t('projectedClose')}</dt>
								<dd className='mt-0.5 text-base font-semibold tabular-nums sm:text-lg'>
									<Amount value={flow.end} currency={PLAN_CURRENCY} tone={flow.end < 0 ? 'negative' : 'neutral'} />
								</dd>
							</div>
						</dl>

						{flow.today < flow.monthDays && (
							<figure>
								<MonthlyPlanFlowChart
									flow={flow}
									todayLabel={t('todayTick')}
									label={t('flowChartLabel', {
										from: flow.today,
										to: flow.monthDays,
										start: money(flow.start),
										low: money(flow.low.balance),
										lowDay: flow.low.day,
										end: money(flow.end),
									})}
									describeDay={(day, balance) => `${shortDate(day)}: ${money(balance)}`}
								/>
								<figcaption className='mt-2.5 flex flex-wrap gap-3.5 text-xs text-muted-foreground'>
									<span className='flex items-center gap-1.5'>
										<span aria-hidden='true' className='size-2 rounded-full bg-success' />
										{t('legendIncome')}
									</span>
									<span className='flex items-center gap-1.5'>
										<span
											aria-hidden='true'
											className={cn(
												'size-2 rounded-full border-2',
												flow.low.balance < 0 ? 'border-destructive' : 'border-warning',
											)}
										/>
										{t('legendLow')}
									</span>
								</figcaption>
							</figure>
						)}

						<p
							className={cn(
								'flex gap-2 rounded-md border px-3.5 py-3 text-sm text-foreground',
								flow.firstNegative ? 'border-destructive/30 bg-destructive/10' : 'border-warning/30 bg-warning/10',
							)}
							data-testid='flow-insight'
						>
							{flow.firstNegative && (
								<AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-destructive' aria-hidden='true' />
							)}
							<span>{insightSentences().join(' ')}</span>
						</p>

						<div>
							<h3 className='mb-1.5 text-sm font-semibold'>{t('nextDaysTitle')}</h3>
							{flow.upcoming.length === 0 ? (
								<EmptyState compact className='py-4' title={t('nextDaysEmpty')} />
							) : (
								<>
									<ul data-testid='flow-upcoming'>
										{flow.upcoming.map((event, index) => (
											<li
												key={event.item.id}
												className={cn(
													'grid min-h-10 grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-2 border-t border-border/60 text-sm sm:min-h-9',
													index >= MOBILE_UPCOMING && !showAllUpcoming && 'hidden sm:grid',
												)}
											>
												<span className='text-muted-foreground tabular-nums'>{shortDate(event.day)}</span>
												<span className='truncate'>{event.item.name}</span>
												<Amount
													className='font-medium'
													value={event.amount}
													currency={PLAN_CURRENCY}
													tone={event.amount > 0 ? 'positive' : 'neutral'}
													signed
												/>
											</li>
										))}
									</ul>
									{flow.upcoming.length > MOBILE_UPCOMING && (
										<Button
											variant='link'
											className='h-10 px-0 text-sm sm:hidden'
											aria-expanded={showAllUpcoming}
											onClick={() => setShowAllUpcoming((current) => !current)}
										>
											{showAllUpcoming ? t('showLessNextDays') : t('showAllNextDays')}
										</Button>
									)}
									<p className='mt-2 text-xs text-muted-foreground'>
										{t('nextDaysSummary', {
											out: money(flow.upcomingOut),
											in: money(flow.upcomingIn),
											from: shortDate(flow.today + 1),
											to: shortDate(flow.upcomingTo),
										})}
									</p>
								</>
							)}
						</div>
					</>
				)}
			</Card>
		</section>
	)
}
