'use client'

import { Receipt } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Amount } from '@/components/shared/Amount'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import type { AnalyticsQueryFilters } from '@/types/analytics'
import { CategoryDot, SectionCard } from './SectionCard'
import type { TopExpense } from './useAnalysisReport'

/** Transactions page with the report's period/account, expenses only, biggest first. */
export function buildTransactionsHref(filters: AnalyticsQueryFilters): string {
	const params = new URLSearchParams({ type: 'BILL', sortBy: 'amount', sortOrder: 'desc' })
	if (filters.date_from) params.set('dateFrom', filters.date_from)
	if (filters.date_to) params.set('dateTo', filters.date_to)
	if (filters.account_id) params.set('account', filters.account_id)
	return `/app/transactions?${params.toString()}`
}

/** "Gastos más grandes": the five biggest expenses of the period (in DOP), marking plan payments. */
export function TopExpenses({
	expenses,
	loading,
	filters,
}: {
	expenses: TopExpense[]
	loading?: boolean
	filters: AnalyticsQueryFilters
}) {
	const t = useTranslations('analysis')
	const locale = useAppLocale()

	return (
		<SectionCard
			id='analysis-top-title'
			title={t('topTitle')}
			link={{ href: buildTransactionsHref(filters), label: t('viewTransactions') }}
			className='gap-2.5'
		>
			{loading ? (
				<div className='space-y-2' aria-busy='true'>
					{[0, 1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className='h-11 w-full' />
					))}
				</div>
			) : expenses.length === 0 ? (
				<EmptyState compact icon={Receipt} title={t('topEmpty')} />
			) : (
				<ol className='flex flex-col'>
					{expenses.map((expense) => {
						const date = formatLocalDate(expense.created_at, locale, { day: 'numeric', month: 'short' })
						const category = expense.categoryName || t('noCategory')
						return (
							<li
								key={expense.id}
								className='grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t py-1.5 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:gap-3'
							>
								<span className='hidden text-sm text-muted-foreground tabular-nums sm:block'>{date}</span>
								<span className='min-w-0'>
									<span className='block truncate font-medium'>{expense.name}</span>
									<span className='flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground'>
										<span className='tabular-nums sm:hidden'>{date} ·</span>
										<CategoryDot color={expense.categoryColor} />
										<span className='truncate'>
											{category}
											{expense.fromPlan ? ` · ${t('topFromPlan')}` : ''}
										</span>
									</span>
								</span>
								<span className='font-semibold tabular-nums'>
									<Amount value={-expense.amount} currency={expense.currency} />
								</span>
							</li>
						)
					})}
				</ol>
			)}
		</SectionCard>
	)
}
