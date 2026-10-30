'use client'

import { Plus, Receipt, Target, Wallet } from 'lucide-react'
import Link from 'next/link'
import { AccountCard } from '@/components/accounts/AccountCard'
import { AccountCardSkeleton } from '@/components/accounts/AccountCardSkeleton'
import { BudgetCard } from '@/components/budgets/BudgetCard'
import { BudgetCardSkeleton } from '@/components/budgets/BudgetCardSkeleton'
import { CardDebtCard } from '@/components/creditcards/CardDebtCard'
import { DashboardTransactionItem } from '@/components/dashboard/DashboardTransactionItem'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useGetBudgets } from '@/hooks/queries/useBudgetsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { useGetCreditCards } from '@/hooks/queries/useCreditCardsQuery'
import { useGetTransactions } from '@/hooks/queries/useTransactionsQuery'
import type { Account } from '@/types/account'

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

const CARD_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
const SKELETON_KEYS = ['sk-1', 'sk-2', 'sk-3']

/**
 * Read-only account cards (same component as /app/accounts, without the
 * edit/delete menu), then the credit cards as debt (never as a negative
 * account balance).
 */
export function DashboardAccountsTab({
	labels,
}: {
	labels: { noAccounts: string; addAccount: string; creditCards: string }
}) {
	const { data, isPending } = useGetAccounts()
	if (isPending) {
		return (
			<div className={CARD_GRID}>
				{SKELETON_KEYS.map((key) => (
					<AccountCardSkeleton key={key} />
				))}
			</div>
		)
	}
	const accounts = apiOrder(data)

	if (accounts.length === 0) {
		return (
			<EmptyState
				icon={Wallet}
				title={labels.noAccounts}
				action={
					<Button asChild>
						<Link href='/app/accounts'>
							<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
							{labels.addAccount}
						</Link>
					</Button>
				}
			/>
		)
	}

	const bankAccounts = accounts.filter((account) => (account.type || 'bank') !== 'credit_card')
	const cardAccounts = accounts.filter((account) => account.type === 'credit_card')

	return (
		<div className='space-y-6'>
			{bankAccounts.length > 0 ? (
				<div className={CARD_GRID}>
					{bankAccounts.map((account) => (
						<AccountCard key={account.id} account={account} />
					))}
				</div>
			) : null}
			{cardAccounts.length > 0 ? (
				<section className='space-y-3' aria-label={labels.creditCards}>
					<h3 className='text-sm font-medium text-muted-foreground'>{labels.creditCards}</h3>
					<DashboardCardDebts cardAccounts={cardAccounts} />
				</section>
			) : null}
		</div>
	)
}

/** Credit cards with their limits (credit card API), else the account balance alone. */
function DashboardCardDebts({ cardAccounts }: { cardAccounts: Account[] }) {
	const { data: cards } = useGetCreditCards()
	return (
		<div className={CARD_GRID}>
			{cardAccounts.map((account) => {
				const card = cards?.find((c) => c.id === account.id)
				const balances = card?.balances?.length
					? card.balances
					: [
							{
								currency: account.currency || 'DOP',
								current_balance: account.current_balance ?? 0,
								credit_limit: 0,
							},
						]
				return <CardDebtCard key={account.id} name={account.name} bank={account.bank} balances={balances} />
			})}
		</div>
	)
}

/** Read-only compact budget cards (same component as /app/budget). */
export function DashboardBudgetsTab({
	labels,
}: {
	labels: { noBudgetsConfigured: string; createBudgetHint: string; createBudget: string }
}) {
	const { data, isPending } = useGetBudgets()
	const { data: categories = [] } = useGetCategories()
	if (isPending) {
		return (
			<div className={CARD_GRID}>
				{SKELETON_KEYS.map((key) => (
					<BudgetCardSkeleton key={key} />
				))}
			</div>
		)
	}
	const budgets = apiOrder(data)

	if (budgets.length === 0) {
		return (
			<EmptyState
				icon={Target}
				title={labels.noBudgetsConfigured}
				description={labels.createBudgetHint}
				action={
					<Button asChild>
						<Link href='/app/budget?create=1'>
							<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
							{labels.createBudget}
						</Link>
					</Button>
				}
			/>
		)
	}

	return (
		<div className={CARD_GRID}>
			{budgets.map((budget) => (
				<BudgetCard
					key={budget.id}
					budget={budget}
					category={categories.find((c) => c.id === budget.category_id)}
					compact
				/>
			))}
		</div>
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
	if (isPending) {
		return (
			<div className='space-y-4'>
				{SKELETON_KEYS.map((key) => (
					<Skeleton key={key} className='h-[76px] w-full rounded-lg' />
				))}
			</div>
		)
	}

	const transactions = data?.transactions ?? []
	const viewAllParams = dateFrom && dateTo ? `?${new URLSearchParams({ dateFrom, dateTo })}` : ''

	if (transactions.length === 0) {
		return <EmptyState compact icon={Receipt} title={labels.noData} />
	}

	return (
		<div className='space-y-4'>
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
