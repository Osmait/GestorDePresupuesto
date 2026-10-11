'use client'

import { CalendarClock } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { planDueDay } from '@/lib/analysisReport'
import { useListFormat } from './report-format'
import { SectionCard } from './SectionCard'
import type { AnalysisReportData } from './useAnalysisReport'

const PLAN_HREF = '/app/monthly'
const NEXT_ITEMS = 3

/**
 * "Tu plan contra la realidad" (month mode only): plan bills already due vs
 * still to come, the next ones, and what was spent split into fixed (plan
 * bills already due) and variable (everything else).
 */
export function PlanVsActual({ report, loading }: { report: AnalysisReportData; loading?: boolean }) {
	const t = useTranslations('analysis')
	const formatCurrency = useFormatCurrency()
	const formatPercent = useFormatPercent()
	const listFormat = useListFormat()
	const { plan, resolved } = report
	if (resolved.period.mode !== 'month') return null

	const link = { href: PLAN_HREF, label: t('planOpen') }

	if (loading) {
		return (
			<SectionCard id='analysis-plan-title' title={t('planTitle')} link={link}>
				<div className='space-y-3' aria-busy='true'>
					<Skeleton className='h-5 w-full' />
					<Skeleton className='h-2 w-full' />
					<Skeleton className='h-4 w-2/3' />
					<Skeleton className='mt-4 h-3 w-full' />
				</div>
			</SectionCard>
		)
	}

	if (!plan) {
		return (
			<SectionCard id='analysis-plan-title' title={t('planTitle')}>
				<EmptyState
					compact
					icon={CalendarClock}
					title={t('planEmpty')}
					description={t('planEmptyDescription')}
					action={
						<Button asChild variant='outline'>
							<Link href={PLAN_HREF}>{t('planOpen')}</Link>
						</Button>
					}
				/>
			</SectionCard>
		)
	}

	const { bills, split } = plan
	const money = (value: number) => formatCurrency(value, 'DOP')
	const total = bills.due.length + bills.remaining.length
	const duePercent = bills.totalAmount > 0 ? (bills.dueAmount / bills.totalAmount) * 100 : 0
	const spent = split.fixed + split.variable
	const fixedPercent = spent > 0 ? (split.fixed / spent) * 100 : 0
	const variablePercent = spent > 0 ? 100 - fixedPercent : 0
	const next = bills.remaining
		.slice(0, NEXT_ITEMS)
		.map((item) => t('planNextItem', { name: item.name, day: planDueDay(item, plan.year, plan.month) }))
	const strong = (chunks: ReactNode) => <strong className='font-semibold'>{chunks}</strong>

	return (
		<SectionCard id='analysis-plan-title' title={t('planTitle')} link={link}>
			<div>
				<p className='text-sm sm:text-base'>
					{bills.remaining.length === 0
						? t.rich('planAllDue', { total, amount: money(bills.dueAmount), strong })
						: t.rich('planDueSoFar', {
								due: bills.due.length,
								total,
								dueAmount: money(bills.dueAmount),
								left: bills.remaining.length,
								leftAmount: money(bills.remainingAmount),
								strong,
							})}
				</p>
				<Progress
					className='mt-2.5'
					value={duePercent}
					aria-label={t('planProgressLabel', { percent: formatPercent(duePercent, { maximumFractionDigits: 0 }) })}
				/>
				{next.length > 0 ? (
					<p className='mt-2 text-sm text-muted-foreground'>{t('planNext', { items: listFormat(next) })}</p>
				) : null}
			</div>

			<div className='border-t pt-3.5'>
				<p className='mb-2 text-sm font-medium'>
					{resolved.inProgress ? t('planSplitTitleCurrent') : t('planSplitTitle')}
				</p>
				<div
					role='img'
					aria-label={t('planSplitLabel', {
						fixed: formatPercent(fixedPercent, { maximumFractionDigits: 0 }),
						variable: formatPercent(variablePercent, { maximumFractionDigits: 0 }),
					})}
					className='flex h-3 gap-0.5 overflow-hidden rounded-sm bg-muted'
				>
					{split.fixed > 0 ? <span className='block bg-primary' style={{ width: `${fixedPercent}%` }} /> : null}
					{split.variable > 0 ? <span className='block bg-chart-2' style={{ width: `${variablePercent}%` }} /> : null}
				</div>
				<div className='mt-2.5 flex flex-wrap gap-x-6 gap-y-1.5 text-sm'>
					<span className='flex items-center gap-1.5 tabular-nums'>
						<span aria-hidden='true' className='h-2.5 w-2.5 rounded-sm bg-primary' />
						{t('planFixed', {
							amount: formatCurrency(split.fixed, 'DOP', { maximumFractionDigits: 0 }),
							percent: formatPercent(fixedPercent, { maximumFractionDigits: 0 }),
						})}
					</span>
					<span className='flex items-center gap-1.5 tabular-nums'>
						<span aria-hidden='true' className='h-2.5 w-2.5 rounded-sm bg-chart-2' />
						{t('planVariable', {
							amount: formatCurrency(split.variable, 'DOP', { maximumFractionDigits: 0 }),
							percent: formatPercent(variablePercent, { maximumFractionDigits: 0 }),
						})}
					</span>
				</div>
				<p className='mt-2 text-xs text-muted-foreground'>{t('planSplitHint')}</p>
			</div>
		</SectionCard>
	)
}
