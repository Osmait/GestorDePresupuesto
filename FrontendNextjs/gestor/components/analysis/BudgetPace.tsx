'use client'

import { PiggyBank, Plus } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Progress, type ProgressTone } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import type { PaceStatus } from '@/lib/analysisReport'
import { cn } from '@/lib/utils'
import { useListFormat } from './report-format'
import { CategoryDot, SectionCard } from './SectionCard'
import type { AnalysisReportData, BudgetPaceRow } from './useAnalysisReport'

/** Rows shown; the rest stay one click away in Presupuestos. */
export const MAX_BUDGET_ROWS = 5

const STATUS_BADGE: Record<PaceStatus, string> = {
	over: 'bg-destructive/10 text-destructive',
	fast: 'bg-warning/10 text-warning',
	tight: 'bg-muted text-muted-foreground',
	ok: 'bg-success/10 text-success',
}

const STATUS_TONE: Record<PaceStatus, ProgressTone> = {
	over: 'destructive',
	fast: 'warning',
	tight: 'default',
	ok: 'default',
}

const STATUS_KEY = {
	over: 'paceStatusOver',
	fast: 'paceStatusFast',
	tight: 'paceStatusTight',
	ok: 'paceStatusOk',
} as const

function PaceRow({ row, todayPercent }: { row: BudgetPaceRow; todayPercent: number | null }) {
	const t = useTranslations('analysis')
	const formatCurrency = useFormatCurrency()
	const formatPercent = useFormatPercent()
	const listFormat = useListFormat()
	const money = (value: number) => formatCurrency(value, 'DOP', { maximumFractionDigits: 0 })
	const usedPercent = row.budget > 0 ? (row.spent / row.budget) * 100 : 0
	const label = row.label || t('noCategory')
	const close = money(row.estimatedClose)

	let note: string
	if (todayPercent === null) {
		note =
			row.spent > row.budget
				? t('paceClosedOver', { spent: money(row.spent), amount: money(row.spent - row.budget) })
				: t('paceClosedUnder', { spent: money(row.spent), amount: money(row.budget - row.spent) })
	} else if (row.status === 'over' || row.status === 'fast') {
		note = t('paceNoteOver', { close, amount: money(row.estimatedClose - row.budget) })
	} else if (row.status === 'tight') {
		note = t('paceNoteTight', { close })
	} else if (row.remainingPlanNames.length > 0) {
		note = t('paceNoteOkPlan', { items: listFormat(row.remainingPlanNames.slice(0, 4)), close })
	} else {
		note = t('paceNoteOk', { close })
	}

	return (
		<li className='flex flex-col gap-2'>
			<div className='flex flex-wrap items-center justify-between gap-x-2 gap-y-1'>
				<span className='flex min-w-0 items-center gap-2'>
					<CategoryDot color={row.color} />
					<span className='truncate font-semibold'>{label}</span>
					<span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_BADGE[row.status])}>
						{t(STATUS_KEY[row.status])}
					</span>
				</span>
				<span className='text-xs text-muted-foreground tabular-nums sm:text-sm'>
					{t('paceSpentOf', { spent: money(row.spent), budget: money(row.budget) })}
				</span>
			</div>
			<div className='relative'>
				<Progress
					value={usedPercent}
					tone={STATUS_TONE[row.status]}
					aria-label={t('paceBarLabel', { category: label, percent: formatPercent(usedPercent), close })}
				/>
				{todayPercent !== null ? (
					<span
						aria-hidden='true'
						className='absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground'
						style={{ left: `${todayPercent.toFixed(1)}%` }}
					/>
				) : null}
			</div>
			<p className='text-sm text-muted-foreground'>{note}</p>
		</li>
	)
}

/**
 * "Ritmo de presupuestos" (month mode only): spent vs budget, today's marker
 * and the estimated close (spent + plan bills still due + variable pace).
 */
export function BudgetPace({
	report,
	loading,
	error,
	onRetry,
	accountName,
}: {
	report: AnalysisReportData
	loading?: boolean
	error?: boolean
	onRetry?: () => void
	accountName?: string
}) {
	const t = useTranslations('analysis')
	const formatPercent = useFormatPercent()
	const { plan, resolved, budgets } = report
	if (budgets === null || resolved.period.mode !== 'month') return null

	const { year, month } = resolved.period
	const day = resolved.range.to.getDate()
	const length = new Date(year, month, 0).getDate()
	const inProgress = resolved.inProgress && day < length
	const todayPercent = inProgress ? (day / length) * 100 : null
	const description = inProgress
		? t('paceDay', { day, days: length, percent: formatPercent((day / length) * 100, { maximumFractionDigits: 0 }) })
		: t('paceMonthComplete')
	const shown = budgets.slice(0, MAX_BUDGET_ROWS)
	const hidden = budgets.length - shown.length

	return (
		<SectionCard
			id='analysis-pace-title'
			title={t('paceTitle')}
			description={description}
			link={{ href: '/app/budget', label: t('paceViewBudgets') }}
		>
			{error ? (
				<ErrorState compact title={t('paceError')} onRetry={onRetry} />
			) : loading ? (
				<div className='space-y-4' aria-busy='true'>
					{[0, 1, 2].map((i) => (
						<Skeleton key={i} className='h-14 w-full' />
					))}
				</div>
			) : budgets.length === 0 ? (
				<EmptyState
					compact
					icon={PiggyBank}
					title={t('paceNoBudgets')}
					description={t('paceNoBudgetsDescription')}
					action={
						<Button asChild variant='outline'>
							<Link href='/app/budget?create=1'>
								<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
								{t('createBudgetCta')}
							</Link>
						</Button>
					}
				/>
			) : (
				<>
					<ul className='flex flex-col gap-[18px]'>
						{shown.map((row) => (
							<PaceRow key={row.id} row={row} todayPercent={todayPercent} />
						))}
					</ul>
					{hidden > 0 ? <p className='text-xs text-muted-foreground'>{t('paceHidden', { count: hidden })}</p> : null}
					{inProgress ? (
						<p className='text-xs text-muted-foreground'>{plan ? t('paceLegend') : t('paceLegendNoPlan')}</p>
					) : null}
					{accountName ? (
						<p className='text-xs text-muted-foreground'>{t('paceAccountNote', { account: accountName })}</p>
					) : null}
				</>
			)}
		</SectionCard>
	)
}
