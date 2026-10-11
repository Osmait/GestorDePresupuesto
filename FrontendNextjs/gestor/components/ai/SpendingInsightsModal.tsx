'use client'

import { format, subMonths } from 'date-fns'
import { AlertCircle, AlertTriangle, Info, Lightbulb, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { DateRange } from 'react-day-picker'
import { toast } from 'sonner'
import { CalendarDateRangePicker } from '@/components/date-range-picker'
import { Amount } from '@/components/shared/Amount'
import { EmptyState } from '@/components/shared/EmptyState'
import { FormDialog } from '@/components/shared/FormDialog'
import { StatCard } from '@/components/shared/StatCard'
import { Progress } from '@/components/ui/progress'
import { useAnalyzeSpendingMutation } from '@/hooks/queries/useAIQuery'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { cn } from '@/lib/utils'
import { CategoryBreakdown, Pattern, Recommendation, SpendingAnalysisResponse, SpendingInsights } from '@/types/ai'

interface SpendingInsightsModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

// The analysis aggregates the user's amounts without a currency of its own: it
// is shown in the app's default currency (DOP), like the other cross-account totals.

export function SpendingInsightsModal({ open, onOpenChange }: SpendingInsightsModalProps) {
	const t = useTranslations('ai.insights')
	const tCommon = useTranslations('ai.common')
	const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
		const to = new Date()
		const from = subMonths(to, 3)
		return { from, to }
	})

	const [insights, setInsights] = useState<SpendingInsights | null>(null)
	const analyzeMutation = useAnalyzeSpendingMutation()

	const handleAnalyze = async () => {
		if (!dateRange?.from || !dateRange?.to) {
			toast.error(t('selectDateRangeError'))
			return
		}

		const result = await analyzeMutation.mutateAsync({
			date_from: format(dateRange.from, 'yyyy-MM-dd'),
			date_to: format(dateRange.to, 'yyyy-MM-dd'),
		})

		if ('success' in result && result.success) {
			const response = result as SpendingAnalysisResponse
			setInsights(response.data)
		} else {
			toast.error(t('failedToAnalyze'))
		}
	}

	const handleOpenChange = (next: boolean) => {
		if (!next) setInsights(null)
		onOpenChange(next)
	}

	return (
		<FormDialog
			open={open}
			onOpenChange={handleOpenChange}
			title={t('title')}
			description={t('description')}
			size='lg'
			onSubmit={handleAnalyze}
			submitLabel={analyzeMutation.isPending ? t('analyzing') : t('analyzeButton')}
			cancelLabel={tCommon('cancel')}
			loading={analyzeMutation.isPending}
			submitDisabled={!dateRange?.from || !dateRange?.to}
		>
			<div className='space-y-6'>
				<fieldset className='min-w-0'>
					<legend className='mb-2 text-sm font-medium'>{t('dateRange')}</legend>
					<CalendarDateRangePicker
						value={dateRange}
						onChange={(range) => {
							if (range && 'from' in range) {
								setDateRange(range)
							}
						}}
					/>
				</fieldset>

				{insights ? (
					<div className='space-y-6'>
						<SummarySection summary={insights.summary} />
						{insights.patterns.length > 0 && <PatternsSection patterns={insights.patterns} />}
						{insights.recommendations.length > 0 && (
							<RecommendationsSection recommendations={insights.recommendations} />
						)}
					</div>
				) : (
					!analyzeMutation.isPending && <EmptyState compact icon={Lightbulb} title={t('selectDateRange')} />
				)}
			</div>
		</FormDialog>
	)
}

function SummarySection({ summary }: { summary: SpendingInsights['summary'] }) {
	const t = useTranslations('ai.insights')
	const formatPercent = useFormatPercent()

	return (
		<section className='space-y-4'>
			<h3 className='text-base font-semibold'>{t('summary')}</h3>

			<dl className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
				<StatCard
					label={t('totalExpenses')}
					icon={TrendingDown}
					tone='negative'
					value={<Amount value={summary.total_expenses} />}
				/>
				<StatCard
					label={t('totalIncome')}
					icon={TrendingUp}
					tone='positive'
					value={<Amount value={summary.total_income} />}
				/>
				<StatCard label={t('savingsRate')} icon={PiggyBank} value={formatPercent(summary.savings_rate_percent)} />
			</dl>

			{summary.top_categories.length > 0 && (
				<div className='space-y-2'>
					<h4 className='text-sm font-medium'>{t('topCategories')}</h4>
					<ul className='space-y-3'>
						{summary.top_categories.map((cat) => (
							<CategoryBar key={cat.category} category={cat} />
						))}
					</ul>
				</div>
			)}

			<p className='text-xs text-muted-foreground'>
				{t('period', { from: summary.period.from, to: summary.period.to, days: summary.period.days })}
			</p>
		</section>
	)
}

function CategoryBar({ category }: { category: CategoryBreakdown }) {
	const formatPercent = useFormatPercent()
	return (
		<li className='space-y-1'>
			<div className='flex items-baseline justify-between gap-3 text-sm'>
				<span className='min-w-0 truncate'>{category.category}</span>
				<span className='shrink-0 tabular-nums'>
					<Amount value={category.amount} />
					<span className='ml-2 text-xs text-muted-foreground'>{formatPercent(category.percentage)}</span>
				</span>
			</div>
			<Progress value={category.percentage} aria-label={category.category} />
		</li>
	)
}

const SEVERITY_ICON = {
	alert: { icon: AlertCircle, className: 'text-destructive' },
	warning: { icon: AlertTriangle, className: 'text-warning' },
	info: { icon: Info, className: 'text-info' },
} as const

function PatternsSection({ patterns }: { patterns: Pattern[] }) {
	const t = useTranslations('ai.insights')
	return (
		<section className='space-y-3'>
			<h3 className='text-base font-semibold'>{t('patternsDetected')}</h3>
			<ul className='space-y-2'>
				{patterns.map((pattern) => {
					const severity = SEVERITY_ICON[pattern.severity] ?? SEVERITY_ICON.info
					const Icon = severity.icon
					return (
						<li key={pattern.type} className='flex items-start gap-3 rounded-lg border p-3'>
							<Icon className={cn('mt-0.5 h-4 w-4 shrink-0', severity.className)} aria-hidden='true' />
							<div className='min-w-0'>
								<p className='text-sm font-medium first-letter:uppercase'>{pattern.type.replace(/_/g, ' ')}</p>
								<p className='text-sm text-muted-foreground'>{pattern.description}</p>
							</div>
						</li>
					)
				})}
			</ul>
		</section>
	)
}

const PRIORITY_CLASS: Record<Recommendation['priority'], string> = {
	high: 'bg-destructive/10 text-destructive',
	medium: 'bg-warning/10 text-warning',
	low: 'bg-muted text-muted-foreground',
}

const PRIORITY_ORDER: Record<Recommendation['priority'], number> = { high: 0, medium: 1, low: 2 }

function RecommendationsSection({ recommendations }: { recommendations: Recommendation[] }) {
	const t = useTranslations('ai.insights')
	const sortedRecommendations = [...recommendations].sort(
		(a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
	)

	return (
		<section className='space-y-3'>
			<h3 className='text-base font-semibold'>{t('recommendations')}</h3>
			<ul className='space-y-2'>
				{sortedRecommendations.map((rec) => (
					<li key={rec.title} className='rounded-lg border p-3 sm:p-4'>
						<div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4'>
							<div className='min-w-0 flex-1'>
								<div className='mb-1 flex flex-wrap items-center gap-2'>
									<span className='text-sm font-medium'>{rec.title}</span>
									<span className={cn('rounded px-2 py-0.5 text-xs font-medium', PRIORITY_CLASS[rec.priority])}>
										{t(`priority.${rec.priority}`)}
									</span>
								</div>
								<p className='text-sm text-muted-foreground'>{rec.description}</p>
							</div>
							{rec.potential_savings > 0 && (
								<div className='flex items-baseline gap-2 sm:flex-col sm:items-end sm:gap-0'>
									<Amount value={rec.potential_savings} tone='positive' className='text-sm font-semibold' />
									<span className='text-xs text-muted-foreground'>{t('potentialSavings')}</span>
								</div>
							)}
						</div>
					</li>
				))}
			</ul>
		</section>
	)
}
