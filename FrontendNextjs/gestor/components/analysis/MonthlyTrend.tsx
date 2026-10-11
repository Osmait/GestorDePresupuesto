'use client'

import { BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/shared/EmptyState'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import type { TrendMonth } from '@/lib/analysisReport'
import { useAppLocale } from '@/lib/i18n/date-locale'
import { cn } from '@/lib/utils'
import { capitalize, useMonthName } from './report-format'
import { SectionCard } from './SectionCard'

/**
 * "Últimos 6 meses": income vs expenses per month as plain HTML bars (labels
 * stay readable at any width), savings rate under each month, and the month in
 * progress drawn lighter.
 */
export function MonthlyTrend({ months }: { months: TrendMonth[] }) {
	const t = useTranslations('analysis')
	const locale = useAppLocale()
	const formatCurrency = useFormatCurrency()
	const formatPercent = useFormatPercent()
	const monthName = useMonthName()
	const max = Math.max(0, ...months.flatMap((month) => [month.income, month.expenses]))
	const current = months.find((month) => month.inProgress)
	const height = (value: number) => (max > 0 ? `${((value / max) * 100).toFixed(1)}%` : '0%')
	const money = (value: number) => formatCurrency(value, 'DOP', { maximumFractionDigits: 0 })

	const label =
		months.length > 0
			? t('trendLabel', {
					values: months
						.map((month) =>
							t('trendMonthValue', {
								month: monthName(month.year, month.month),
								income: money(month.income),
								expenses: money(month.expenses),
							}),
						)
						.join('; '),
				})
			: ''

	return (
		<SectionCard id='analysis-trend-title' title={t('trendTitle')} className='gap-3'>
			<div className='-mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
				<span className='flex items-center gap-1.5'>
					<span aria-hidden='true' className='h-2.5 w-2.5 rounded-sm bg-chart-1' />
					{t('income')}
				</span>
				<span className='flex items-center gap-1.5'>
					<span aria-hidden='true' className='h-2.5 w-2.5 rounded-sm bg-chart-2' />
					{t('expenses')}
				</span>
			</div>
			{max === 0 ? (
				<EmptyState compact icon={BarChart3} title={t('noData')} />
			) : (
				<div role='img' aria-label={label} className='grid grid-cols-6 gap-1 sm:gap-2'>
					{months.map((month) => (
						<div key={month.key} className='flex min-w-0 flex-col items-center'>
							<div className='flex h-40 w-full items-end justify-center gap-0.5 border-b sm:gap-1'>
								<span
									className='block w-1/3 max-w-[30px] rounded-t-sm bg-chart-1'
									style={{ height: height(month.income) }}
								/>
								<span
									className={cn('block w-1/3 max-w-[30px] rounded-t-sm bg-chart-2', month.inProgress && 'opacity-45')}
									style={{ height: height(month.expenses) }}
								/>
							</div>
							<span className='mt-2 text-xs font-medium sm:text-sm'>
								{capitalize(monthName(month.year, month.month, 'short'), locale)}
							</span>
							<span className='text-xs text-muted-foreground tabular-nums'>
								{month.inProgress
									? t('trendInProgress')
									: month.savingsRate === null
										? '—'
										: formatPercent(month.savingsRate, { maximumFractionDigits: 0 })}
							</span>
						</div>
					))}
				</div>
			)}
			<p className='text-xs text-muted-foreground'>
				{current
					? t('trendCaptionInProgress', { month: capitalize(monthName(current.year, current.month), locale) })
					: t('trendCaption')}
			</p>
		</SectionCard>
	)
}
