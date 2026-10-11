'use client'

import { useTranslations } from 'next-intl'
import { Amount } from '@/components/shared/Amount'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { shiftMonth, sparklinePath } from '@/lib/analysisReport'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { capitalize, useListFormat, useMonthName } from './report-format'
import type { AnalysisReportData } from './useAnalysisReport'

/** Changes smaller than this (in percent) read as "the same". */
const SAME_THRESHOLD = 0.05
const SPARK_WIDTH = 80
const SPARK_HEIGHT = 24

/** Phrase naming the comparison period ("en los mismos días de septiembre"). */
export function useComparisonPhrase(report: AnalysisReportData): string {
	const t = useTranslations('analysis')
	const monthName = useMonthName()
	const { period, inProgress, comparisonDays } = report.resolved
	if (period.mode === 'month') {
		const prev = shiftMonth(period.year, period.month, -1)
		const month = monthName(prev.year, prev.month)
		return inProgress ? t('compareSameDaysOfMonth', { month }) : t('compareMonth', { month })
	}
	if (period.mode === 'year') {
		const year = String(period.year - 1)
		return inProgress ? t('compareSamePeriodOfYear', { year }) : t('compareYear', { year })
	}
	return t('comparePreviousRange', { days: comparisonDays })
}

/** "Del 1 al 11 de octubre" (month) or "Del 5 de enero de 2026 al 10 de marzo de 2026". */
export function usePeriodRangeLabel(report: AnalysisReportData): string {
	const t = useTranslations('analysis')
	const locale = useAppLocale()
	const monthName = useMonthName()
	const { period, range } = report.resolved
	if (period.mode === 'month') {
		return t('heroRangeMonth', { day: range.to.getDate(), month: monthName(period.year, period.month) })
	}
	const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
	return t('heroRange', {
		from: formatLocalDate(range.from, locale, options),
		to: formatLocalDate(range.to, locale, options),
	})
}

/** The headline of the report: what was spent vs the same days before, why, and three side figures. */
export function AnalysisHero({ report }: { report: AnalysisReportData }) {
	const t = useTranslations('analysis')
	const locale = useAppLocale()
	const formatCurrency = useFormatCurrency()
	const formatPercent = useFormatPercent()
	const monthName = useMonthName()
	const listFormat = useListFormat()
	const comparison = useComparisonPhrase(report)
	const rangeLabel = usePeriodRangeLabel(report)
	const { resolved, expenses, previousExpenses, expenseDelta, plan, incomePlan, perDay, savings, changes } = report
	const { period } = resolved

	const amount = formatCurrency(expenses, 'DOP')
	const headline =
		previousExpenses > 0 && expenseDelta !== null
			? t('heroHeadline', {
					direction: Math.abs(expenseDelta) < SAME_THRESHOLD ? 'same' : expenseDelta > 0 ? 'more' : 'less',
					amount,
					percent: formatPercent(Math.abs(expenseDelta)),
					comparison,
				})
			: t('heroHeadlineNoComparison', { amount, comparison })

	const sentences: string[] = []
	if (plan) {
		sentences.push(
			plan.split.fixed === plan.previousSplit.fixed
				? t('heroFixedSame', { amount: formatCurrency(plan.split.fixed, 'DOP') })
				: t('heroFixedDifferent', {
						amount: formatCurrency(plan.split.fixed, 'DOP'),
						previous: formatCurrency(plan.previousSplit.fixed, 'DOP'),
					}),
		)
	}
	if (previousExpenses > 0) {
		const up = changes.changed.filter((change) => change.delta > 0).slice(0, 2)
		const down = changes.changed.filter((change) => change.delta < 0).slice(0, 2)
		const upLabels = listFormat(up.map((change) => change.label))
		const downLabels = listFormat(down.map((change) => change.label))
		if (up.length > 0 && down.length > 0) sentences.push(t('heroDriversBoth', { up: upLabels, down: downLabels }))
		else if (up.length > 0) sentences.push(t('heroDriversUp', { up: upLabels }))
		else if (down.length > 0) sentences.push(t('heroDriversDown', { down: downLabels }))
	}

	let incomeHint: string
	if (incomePlan) {
		const expected = formatCurrency(incomePlan.expected, 'DOP', { maximumFractionDigits: 0 })
		incomeHint =
			incomePlan.nextDay !== null
				? t('heroIncomeExpectedNext', { amount: expected, day: incomePlan.nextDay })
				: t('heroIncomeExpected', { amount: expected })
	} else {
		incomeHint = t('heroIncomePrevious', { amount: formatCurrency(report.previousIncome, 'DOP') })
	}

	const last = savings.last
	const sparkValues = savings.months.map((month) => month.savingsRate)
	const spark = sparklinePath(sparkValues, SPARK_WIDTH, SPARK_HEIGHT)
	const sparkLabel = t('heroSavingsTrend', {
		values: listFormat(
			savings.months.map(
				(month) =>
					`${monthName(month.year, month.month)} ${month.savingsRate === null ? t('trendNoIncome') : formatPercent(month.savingsRate)}`,
			),
		),
	})

	const previousLabel =
		period.mode === 'month'
			? capitalize(monthName(resolved.comparison.from.getFullYear(), resolved.comparison.from.getMonth() + 1), locale)
			: t('previousPeriodShort')
	const previousPerDay = formatCurrency(perDay.previous, 'DOP')

	return (
		<section
			aria-labelledby='analysis-hero-title'
			className='flex flex-wrap items-start gap-x-10 gap-y-5 rounded-lg border bg-card p-4 text-card-foreground shadow-sm sm:p-6'
		>
			<div className='min-w-0 flex-[3_1_420px]'>
				<p className='mb-1.5 text-sm text-muted-foreground'>{rangeLabel}</p>
				<h2
					id='analysis-hero-title'
					className='max-w-[30ch] text-xl font-semibold tracking-tight text-balance tabular-nums sm:text-2xl'
				>
					{headline}
				</h2>
				{sentences.length > 0 ? (
					<p className='mt-2.5 max-w-[60ch] text-sm text-muted-foreground sm:text-base'>{sentences.join(' ')}</p>
				) : null}
			</div>

			<dl className='grid min-w-0 flex-[2_1_340px] grid-cols-2 gap-x-4 gap-y-4 border-t pt-4 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] sm:gap-5 sm:border-t-0 sm:pt-0'>
				<div className='min-w-0'>
					<dt className='text-xs font-medium text-muted-foreground sm:text-sm'>
						{period.mode === 'month' ? t('heroIncomeMonth') : t('heroIncomePeriod')}
					</dt>
					<dd className='mt-1 text-base font-semibold tabular-nums sm:text-xl'>
						<Amount value={report.income} currency='DOP' />
					</dd>
					<dd className='mt-0.5 text-xs text-muted-foreground'>{incomeHint}</dd>
				</div>

				<div className='min-w-0'>
					<dt className='text-xs font-medium text-muted-foreground sm:text-sm'>
						{last ? t('heroSavings', { month: monthName(last.year, last.month) }) : t('heroSavingsLastMonth')}
					</dt>
					<dd className='mt-1 flex items-center gap-2.5'>
						<span className='text-base font-semibold tabular-nums sm:text-xl'>
							{last?.savingsRate != null ? formatPercent(last.savingsRate) : '—'}
						</span>
						{spark && sparkValues.filter((value) => value !== null).length > 1 ? (
							<svg
								viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
								width={SPARK_WIDTH}
								height={SPARK_HEIGHT}
								role='img'
								aria-label={sparkLabel}
								className='hidden shrink-0 overflow-visible sm:block'
							>
								<path
									d={spark}
									fill='none'
									className='stroke-chart-1'
									strokeWidth={2}
									strokeLinejoin='round'
									strokeLinecap='round'
								/>
							</svg>
						) : null}
					</dd>
					<dd className='mt-0.5 text-xs text-muted-foreground'>
						{!last
							? t('heroSavingsNoData')
							: last.savingsRate === null
								? t('heroSavingsNoIncome')
								: savings.average !== null
									? t('heroSavingsAverage', {
											count: savings.averageCount,
											percent: formatPercent(savings.average),
										})
									: null}
					</dd>
				</div>

				<div className='hidden min-w-0 sm:block'>
					<dt className='text-xs font-medium text-muted-foreground sm:text-sm'>
						{perDay.variableOnly ? t('heroDailyVariable') : t('heroDaily')}
					</dt>
					<dd className='mt-1 text-base font-semibold tabular-nums sm:text-xl'>
						<Amount value={perDay.current} currency='DOP' />
					</dd>
					<dd className='mt-0.5 text-xs text-muted-foreground'>
						{perDay.variableOnly
							? t('heroDailyPreviousVariable', { period: previousLabel, amount: previousPerDay })
							: t('heroDailyPrevious', { period: previousLabel, amount: previousPerDay })}
					</dd>
				</div>
			</dl>
		</section>
	)
}
