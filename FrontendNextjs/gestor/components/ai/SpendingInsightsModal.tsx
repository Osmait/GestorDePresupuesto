'use client'

import { format, subMonths } from 'date-fns'
import {
	AlertCircle,
	AlertTriangle,
	DollarSign,
	Info,
	Lightbulb,
	Loader2,
	PiggyBank,
	TrendingDown,
	TrendingUp,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { DateRange } from 'react-day-picker'
import { toast } from 'sonner'
import { CalendarDateRangePicker } from '@/components/date-range-picker'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAnalyzeSpendingMutation } from '@/hooks/queries/useAIQuery'
import { cn } from '@/lib/utils'
import { CategoryBreakdown, Pattern, Recommendation, SpendingAnalysisResponse, SpendingInsights } from '@/types/ai'

interface SpendingInsightsModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function SpendingInsightsModal({ open, onOpenChange }: SpendingInsightsModalProps) {
	const t = useTranslations('ai.insights')
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

	const handleClose = () => {
		setInsights(null)
		onOpenChange(false)
	}

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className='w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto'>
				<DialogHeader>
					<DialogTitle className='flex items-center gap-2'>
						<Lightbulb className='h-5 w-5 text-primary' />
						{t('title')}
					</DialogTitle>
					<DialogDescription>{t('description')}</DialogDescription>
				</DialogHeader>

				<div className='space-y-4 sm:space-y-6'>
					<div className='flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4'>
						<div className='flex-1'>
							<label className='text-sm font-medium mb-2 block'>{t('dateRange')}</label>
							<CalendarDateRangePicker
								value={dateRange}
								onChange={(range) => {
									if (range && 'from' in range) {
										setDateRange(range)
									}
								}}
							/>
						</div>
						<Button
							onClick={handleAnalyze}
							disabled={!dateRange?.from || !dateRange?.to || analyzeMutation.isPending}
							className='w-full sm:w-auto'
						>
							{analyzeMutation.isPending ? (
								<>
									<Loader2 className='h-4 w-4 mr-2 animate-spin' />
									{t('analyzing')}
								</>
							) : (
								<>
									<Lightbulb className='h-4 w-4 mr-2' />
									{t('analyzeButton')}
								</>
							)}
						</Button>
					</div>

					{insights && (
						<div className='space-y-4 sm:space-y-6'>
							<SummarySection summary={insights.summary} />
							{insights.patterns.length > 0 && <PatternsSection patterns={insights.patterns} />}
							{insights.recommendations.length > 0 && (
								<RecommendationsSection recommendations={insights.recommendations} />
							)}
						</div>
					)}

					{!insights && !analyzeMutation.isPending && (
						<div className='text-center py-8 sm:py-12 text-muted-foreground'>
							<Lightbulb className='h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50' />
							<p className='text-sm sm:text-base'>{t('selectDateRange')}</p>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}

function SummarySection({ summary }: { summary: SpendingInsights['summary'] }) {
	const t = useTranslations('ai.insights')
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
		}).format(amount)
	}

	return (
		<div className='space-y-4'>
			<h3 className='text-base sm:text-lg font-semibold'>{t('summary')}</h3>

			<div className='grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4'>
				<div className='p-3 sm:p-4 rounded-lg bg-red-50 dark:bg-red-900/20'>
					<div className='flex items-center gap-2 text-red-600 dark:text-red-400 mb-1'>
						<TrendingDown className='h-4 w-4' />
						<span className='text-xs sm:text-sm'>{t('totalExpenses')}</span>
					</div>
					<p className='text-xl sm:text-2xl font-bold'>{formatCurrency(summary.total_expenses)}</p>
				</div>

				<div className='p-3 sm:p-4 rounded-lg bg-green-50 dark:bg-green-900/20'>
					<div className='flex items-center gap-2 text-green-600 dark:text-green-400 mb-1'>
						<TrendingUp className='h-4 w-4' />
						<span className='text-xs sm:text-sm'>{t('totalIncome')}</span>
					</div>
					<p className='text-xl sm:text-2xl font-bold'>{formatCurrency(summary.total_income)}</p>
				</div>

				<div className='p-3 sm:p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20'>
					<div className='flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1'>
						<PiggyBank className='h-4 w-4' />
						<span className='text-xs sm:text-sm'>{t('savingsRate')}</span>
					</div>
					<p className='text-xl sm:text-2xl font-bold'>{summary.savings_rate_percent.toFixed(1)}%</p>
				</div>
			</div>

			{summary.top_categories.length > 0 && (
				<div>
					<h4 className='text-sm font-medium mb-2'>{t('topCategories')}</h4>
					<div className='space-y-2'>
						{summary.top_categories.map((cat) => (
							<CategoryBar key={cat.category} category={cat} />
						))}
					</div>
				</div>
			)}

			<p className='text-xs text-muted-foreground'>
				{t('period', { from: summary.period.from, to: summary.period.to, days: summary.period.days })}
			</p>
		</div>
	)
}

function CategoryBar({ category }: { category: CategoryBreakdown }) {
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
		}).format(amount)
	}

	return (
		<div className='flex items-center gap-3'>
			<div className='w-24 text-sm truncate'>{category.category}</div>
			<div className='flex-1 h-6 bg-muted rounded-full overflow-hidden'>
				<div
					className='h-full bg-primary rounded-full flex items-center justify-end pr-2'
					style={{ width: `${Math.min(category.percentage, 100)}%` }}
				>
					<span className='text-xs text-primary-foreground font-medium'>{category.percentage.toFixed(0)}%</span>
				</div>
			</div>
			<div className='w-20 text-sm text-right'>{formatCurrency(category.amount)}</div>
		</div>
	)
}

function PatternsSection({ patterns }: { patterns: Pattern[] }) {
	const t = useTranslations('ai.insights')
	return (
		<div className='space-y-3 sm:space-y-4'>
			<h3 className='text-base sm:text-lg font-semibold'>{t('patternsDetected')}</h3>
			<div className='space-y-2 sm:space-y-3'>
				{patterns.map((pattern) => (
					<div key={pattern.type} className='flex items-start gap-3 p-3 rounded-lg bg-muted'>
						{pattern.severity === 'alert' ? (
							<AlertCircle className='h-4 w-4 sm:h-5 sm:w-5 text-red-500 mt-0.5 shrink-0' />
						) : pattern.severity === 'warning' ? (
							<AlertTriangle className='h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 mt-0.5 shrink-0' />
						) : (
							<Info className='h-4 w-4 sm:h-5 sm:w-5 text-blue-500 mt-0.5 shrink-0' />
						)}
						<div>
							<p className='font-medium text-sm sm:text-base capitalize'>{pattern.type.replace(/_/g, ' ')}</p>
							<p className='text-xs sm:text-sm text-muted-foreground'>{pattern.description}</p>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

function RecommendationsSection({ recommendations }: { recommendations: Recommendation[] }) {
	const t = useTranslations('ai.insights')
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
		}).format(amount)
	}

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case 'high':
				return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
			case 'medium':
				return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
			default:
				return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
		}
	}

	const sortedRecommendations = [...recommendations].sort((a, b) => {
		const priorityOrder = { high: 0, medium: 1, low: 2 }
		return priorityOrder[a.priority] - priorityOrder[b.priority]
	})

	return (
		<div className='space-y-3 sm:space-y-4'>
			<h3 className='text-base sm:text-lg font-semibold'>{t('recommendations')}</h3>
			<div className='space-y-2 sm:space-y-3'>
				{sortedRecommendations.map((rec) => (
					<div key={rec.title} className='p-3 sm:p-4 rounded-lg border border-border'>
						<div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4'>
							<div className='flex-1'>
								<div className='flex items-center gap-2 mb-1'>
									<span className='font-medium text-sm sm:text-base'>{rec.title}</span>
									<span className={cn('text-xs px-2 py-0.5 rounded capitalize', getPriorityColor(rec.priority))}>
										{rec.priority}
									</span>
								</div>
								<p className='text-xs sm:text-sm text-muted-foreground'>{rec.description}</p>
							</div>
							{rec.potential_savings > 0 && (
								<div className='flex items-center gap-1 sm:flex-col sm:items-end text-green-600 dark:text-green-400'>
									<DollarSign className='h-4 w-4' />
									<span className='font-bold text-sm sm:text-base'>{formatCurrency(rec.potential_savings)}</span>
									<span className='text-xs text-muted-foreground hidden sm:block'>{t('potentialSavings')}</span>
								</div>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
