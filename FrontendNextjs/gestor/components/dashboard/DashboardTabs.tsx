'use client'

import { CreditCard, Target } from 'lucide-react'
import Link from 'next/link'
import { DashboardTransactionItem } from '@/components/dashboard/DashboardTransactionItem'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useGetBudgets } from '@/hooks/queries/useBudgetsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { useGetTransactions } from '@/hooks/queries/useTransactionsQuery'
import { DEFAULT_CURRENCY, formatCurrency } from '@/lib/utils'
import type { Account } from '@/types/account'
import type { Budget } from '@/types/budget'
import type { Category } from '@/types/category'

/**
 * Hidden dashboard tabs. They render on the client from the TanStack cache,
 * which the dashboard seeds with the server's accounts, categories and budgets
 * (HydrationBoundary): the page payload carries those lists once, and the
 * tabs only fetch what is not already cached (the transactions tab, when
 * first opened).
 */

/** Rows of the transactions tab: the newest page of the period; the full list lives on /app/transactions. */
export const DASHBOARD_TRANSACTIONS_TAB_LIMIT = 50

// The cached lists are newest first (client query functions); the dashboard shows API order.
function apiOrder<T>(items: T[] | undefined): T[] {
	return items ? [...items].reverse() : []
}

function TabSkeleton() {
	return <div className='h-40 w-full rounded-lg bg-muted/20 animate-pulse' />
}

export function DashboardAccountsTab({
	locale,
	labels,
}: {
	locale: string
	labels: { high: string; medium: string; low: string; initial: string }
}) {
	const { data, isPending } = useGetAccounts()
	if (isPending) return <TabSkeleton />

	return (
		<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
			{apiOrder(data).map((account) => (
				<AccountCard key={account.id} account={account} locale={locale} labels={labels} />
			))}
		</div>
	)
}

function AccountCard({
	account,
	locale,
	labels,
}: {
	account: Account
	locale: string
	labels: { high: string; medium: string; low: string; initial: string }
}) {
	const currentBalance = account.current_balance ?? account.initial_balance ?? 0
	const isPositive = currentBalance > 0
	const currency = account.currency || DEFAULT_CURRENCY

	return (
		<Card className='border-border/50 dark:border-border/20 hover:bg-accent/40 dark:hover:bg-accent/40 transition-all duration-200'>
			<CardContent className='p-6'>
				<div className='flex items-center justify-between gap-2 mb-4'>
					<div className='min-w-0'>
						<h3 className='font-semibold text-foreground truncate'>{account.name}</h3>
						<p className='text-sm text-muted-foreground truncate'>{account.bank}</p>
					</div>
					<CreditCard className='h-5 w-5 shrink-0 text-muted-foreground' aria-hidden='true' />
				</div>
				<div className='space-y-2'>
					<p
						className={`text-xl sm:text-2xl font-bold tabular-nums break-words ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
					>
						{formatCurrency(currentBalance, currency, { locale })}
					</p>
					<div className='flex flex-wrap gap-2'>
						<Badge variant='outline' className='text-xs'>
							{currentBalance > 10000 ? labels.high : currentBalance > 5000 ? labels.medium : labels.low}
						</Badge>
						{account.current_balance !== account.initial_balance && (
							<Badge variant='secondary' className='text-xs'>
								{labels.initial}: {formatCurrency(account.initial_balance, currency, { locale })}
							</Badge>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

export function DashboardBudgetsTab({
	locale,
	labels,
}: {
	locale: string
	labels: { noCategory: string; of: string; noBudgetsConfigured: string; createBudgetHint: string }
}) {
	const { data, isPending } = useGetBudgets()
	const { data: categories = [] } = useGetCategories()
	if (isPending) return <TabSkeleton />
	const budgets = apiOrder(data)

	return (
		<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
			{budgets.length > 0 ? (
				budgets.map((budget) => (
					<BudgetCard
						key={budget.id}
						budget={budget}
						category={categories.find((c) => c.id === budget.category_id)}
						locale={locale}
						labels={labels}
					/>
				))
			) : (
				<div className='col-span-full text-center py-12 text-muted-foreground'>
					<Target className='h-12 w-12 mx-auto mb-4 opacity-50' />
					<h3 className='text-lg font-semibold mb-2'>{labels.noBudgetsConfigured}</h3>
					<p className='text-sm'>{labels.createBudgetHint}</p>
				</div>
			)}
		</div>
	)
}

function BudgetCard({
	budget,
	category,
	locale,
	labels,
}: {
	budget: Budget
	category?: Category
	locale: string
	labels: { noCategory: string; of: string }
}) {
	const spentAmount = budget.current_amount
	const percentage = budget.amount > 0 ? (spentAmount / budget.amount) * 100 : 0
	const isOverBudget = spentAmount > budget.amount

	return (
		<Card className='border-border/50 dark:border-border/20'>
			<CardContent className='p-6'>
				<div className='flex items-center justify-between gap-2 mb-4'>
					<div className='flex min-w-0 items-center gap-3'>
						<div
							className='w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm'
							style={{ backgroundColor: category?.color || '#6B7280' }}
						>
							{category?.icon || '📊'}
						</div>
						<div className='min-w-0'>
							<h3 className='font-medium text-foreground truncate'>{category?.name || labels.noCategory}</h3>
							<p className='text-sm text-muted-foreground tabular-nums'>
								{formatCurrency(spentAmount, 'DOP', { locale })} {labels.of}{' '}
								{formatCurrency(budget.amount, 'DOP', { locale })}
							</p>
						</div>
					</div>
					<Badge variant={isOverBudget ? 'destructive' : percentage > 80 ? 'secondary' : 'outline'} className='text-xs'>
						{percentage.toFixed(1)}%
					</Badge>
				</div>
				<div className='relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700'>
					<div
						className='h-full transition-all duration-500 rounded-full'
						style={{
							width: `${Math.max(Math.min(percentage, 100), percentage > 0 ? 5 : 0)}%`,
							minWidth: percentage > 0 ? '8px' : '0px',
							backgroundColor: percentage > 80 ? '#ef4444' : percentage > 60 ? '#eab308' : '#22c55e',
						}}
					/>
				</div>
			</CardContent>
		</Card>
	)
}

export function DashboardTransactionsTab({
	dateFrom,
	dateTo,
	locale,
	labels,
}: {
	dateFrom?: string
	dateTo?: string
	locale: string
	labels: { viewAll: string; noData: string }
}) {
	const { data, isPending } = useGetTransactions({
		...(dateFrom && dateTo ? { date_from: dateFrom, date_to: dateTo } : {}),
		page: 1,
		limit: DASHBOARD_TRANSACTIONS_TAB_LIMIT,
		sort_by: 'created_at',
		sort_order: 'desc',
	})
	const { data: categories = [] } = useGetCategories()
	if (isPending) return <TabSkeleton />

	const transactions = data?.transactions ?? []
	const viewAllParams = dateFrom && dateTo ? `?${new URLSearchParams({ dateFrom, dateTo })}` : ''

	return (
		<div className='space-y-4'>
			{transactions.length === 0 && <p className='py-8 text-center text-sm text-muted-foreground'>{labels.noData}</p>}
			{transactions.map((transaction) => (
				<DashboardTransactionItem
					key={transaction.id}
					transaction={transaction}
					category={categories.find((c) => c.id === transaction.category_id)}
					locale={locale}
				/>
			))}
			{data?.pagination?.has_next_page && (
				<div className='pt-2 text-center'>
					<Link href={`/app/transactions${viewAllParams}`} className='text-sm font-medium text-primary hover:underline'>
						{labels.viewAll}
					</Link>
				</div>
			)}
		</div>
	)
}
