'use client'

import { ArrowLeftRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/shared/EmptyState'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import type { CategoryChange } from '@/lib/analysisReport'
import { useAppLocale } from '@/lib/i18n/date-locale'
import { cn } from '@/lib/utils'
import { formatDateRange, useListFormat } from './report-format'
import { CategoryDot, SectionCard } from './SectionCard'
import type { AnalysisReportData } from './useAnalysisReport'

/** Rows shown; the rest are summarized in one line. */
export const MAX_CHANGE_ROWS = 6

function ChangeRow({ change, maxDelta }: { change: CategoryChange; maxDelta: number }) {
	const t = useTranslations('analysis')
	const formatCurrency = useFormatCurrency()
	const formatPercent = useFormatPercent()
	const up = change.delta > 0
	const width = maxDelta > 0 ? (Math.abs(change.delta) / maxDelta) * 50 : 0

	return (
		<li className='grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t py-2.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_8rem] sm:gap-x-3.5 sm:py-2'>
			<span className='col-start-1 row-start-1 flex min-w-0 items-center gap-2 sm:row-span-2'>
				<CategoryDot color={change.color} />
				<span className='truncate font-medium'>{change.label || t('noCategory')}</span>
				<span className='hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:inline'>
					{formatCurrency(change.current, 'DOP', { maximumFractionDigits: 0 })}
				</span>
			</span>
			<span
				aria-hidden='true'
				className='relative col-start-1 row-start-2 block h-2 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:h-2.5'
			>
				<span className='absolute -top-1 -bottom-1 left-1/2 w-px bg-border' />
				<span
					className={cn('absolute top-0 h-full rounded-sm', up ? 'left-1/2 bg-warning' : 'right-1/2 bg-info')}
					style={{ width: `${width.toFixed(1)}%` }}
				/>
			</span>
			<span
				className={cn(
					'col-start-2 row-start-1 text-right font-semibold tabular-nums sm:col-start-3',
					up ? 'text-warning' : 'text-info',
				)}
			>
				<span aria-hidden='true'>{up ? '▲' : '▼'} </span>
				{formatCurrency(change.delta, 'DOP', { signDisplay: 'exceptZero', maximumFractionDigits: 0 })}
			</span>
			<span className='col-start-2 row-start-2 text-right text-xs text-muted-foreground tabular-nums sm:col-start-3'>
				{change.percent === null
					? t('changesNew')
					: formatPercent(change.percent, { signDisplay: 'exceptZero', maximumFractionDigits: 0 })}
			</span>
		</li>
	)
}

/** "Qué cambió": categories whose spend moved vs the comparison, biggest change first (diverging bars). */
export function CategoryChanges({ report }: { report: AnalysisReportData }) {
	const t = useTranslations('analysis')
	const locale = useAppLocale()
	const listFormat = useListFormat()
	const { changed, unchanged } = report.changes
	const { comparison, range: measured, period } = report.resolved
	const shown = changed.slice(0, MAX_CHANGE_ROWS)
	const hidden = changed.length - shown.length
	const maxDelta = Math.max(0, ...shown.map((change) => Math.abs(change.delta)))
	// No spending at all in the comparison: every row would just read "new".
	const nothingBefore = unchanged.length === 0 && changed.every((change) => change.previous === 0)
	// The year is left out only when it can't be misread: a one-year comparison next to a
	// month (Sep vs Oct, Dec 2025 vs Jan 2026) or inside the same year as the period.
	const sameYear =
		comparison.from.getFullYear() === comparison.to.getFullYear() &&
		(period.mode === 'month' || comparison.from.getFullYear() === measured.from.getFullYear())
	const rangeOptions: Intl.DateTimeFormatOptions = sameYear
		? { day: 'numeric', month: 'long' }
		: { day: 'numeric', month: 'long', year: 'numeric' }
	const range = formatDateRange(comparison.from, comparison.to, locale, rangeOptions)

	return (
		<SectionCard id='analysis-changes-title' title={t('changesTitle')} description={t('changesVs', { range })}>
			{changed.length === 0 || nothingBefore ? (
				<EmptyState
					compact
					icon={ArrowLeftRight}
					title={unchanged.length > 0 && !nothingBefore ? t('changesNone') : t('changesEmpty')}
				/>
			) : (
				<>
					<ul className='-mt-2 flex flex-col'>
						{shown.map((change) => (
							<ChangeRow key={change.id || change.label} change={change} maxDelta={maxDelta} />
						))}
					</ul>
					{hidden > 0 ? <p className='text-xs text-muted-foreground'>{t('changesHidden', { count: hidden })}</p> : null}
					{unchanged.length > 0 ? (
						<p className='text-xs text-muted-foreground'>
							{t('changesUnchanged', { categories: listFormat(unchanged.map((change) => change.label)) })}
						</p>
					) : null}
					<div className='flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
						<span className='flex items-center gap-1.5'>
							<span aria-hidden='true' className='h-2.5 w-2.5 rounded-sm bg-warning' />
							{t('changesMore')}
						</span>
						<span className='flex items-center gap-1.5'>
							<span aria-hidden='true' className='h-2.5 w-2.5 rounded-sm bg-info' />
							{t('changesLess')}
						</span>
					</div>
				</>
			)}
		</SectionCard>
	)
}
