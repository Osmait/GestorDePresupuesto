'use client'

import { AnimatePresence, domAnimation, LazyMotion, m } from 'framer-motion'
import { CreditCard, TrendingDown, TrendingUp } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatedTabs } from '@/components/common/animated-tabs'
import TransactionItem from '@/components/transactions/TransactionItem'
import TransactionSummaryCard from '@/components/transactions/TransactionSummaryCard'
import { TransactionsPageSkeleton } from '@/components/transactions/TransactionsPageSkeleton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { getSignedAmount, getTransactionTypeKey, isInflowTransaction } from '@/lib/transaction-utils'
import { formatCurrency } from '@/lib/utils'
import { Category } from '@/types/category'
import { Transaction, TypeTransaction } from '@/types/transaction'
import { useTransactionActions, useTransactionContext } from './TransactionContext'
import { TransactionSort } from './TransactionSort'

interface TransactionRowProps {
	transaction: Transaction
	category?: Category
	highlighted: boolean
	onOpenDetails: (_transaction: Transaction) => void
	onDelete: (_id: string) => Promise<void>
}

const ROW_INITIAL = { opacity: 0, scale: 0.95 }
const ROW_ANIMATE = { opacity: 1, scale: 1 }
const ROW_TRANSITION = { duration: 0.2, ease: 'easeOut' } as const

/**
 * Memoized row: with stable callbacks from the list, a row only re-renders when
 * its own transaction/category/highlight changes (not on every filter change or
 * when other rows change).
 */
const TransactionRow = memo(function TransactionRow({
	transaction,
	category,
	highlighted,
	onOpenDetails,
	onDelete,
}: TransactionRowProps) {
	const transactionId = transaction.id!
	const handleDeleted = useCallback(() => onDelete(transactionId), [onDelete, transactionId])

	return (
		<m.li
			id={`transaction-item-${transactionId}`}
			initial={ROW_INITIAL}
			animate={ROW_ANIMATE}
			exit={ROW_INITIAL}
			transition={ROW_TRANSITION}
			className={
				highlighted ? 'list-none rounded-xl ring-2 ring-primary/70 ring-offset-2 ring-offset-background' : 'list-none'
			}
		>
			<TransactionItem
				transaction={transaction}
				category={category}
				onOpenDetails={onOpenDetails}
				onTransactionDeleted={handleDeleted}
			/>
		</m.li>
	)
})

// m + LazyMotion(domAnimation) instead of motion: the full feature bundle (layout,
// drag) is not needed for fades.
export default function TransactionsList() {
	return (
		<LazyMotion features={domAnimation}>
			<TransactionsListView />
		</LazyMotion>
	)
}

function TransactionsListView() {
	const t = useTranslations('transactions')
	const tCommon = useTranslations('common')
	const locale = useAppLocale()
	const { transactions, pagination, summary, isLoading: isLoadingTx } = useTransactionContext()
	const { deleteTransaction, clearFilters } = useTransactionActions()

	const { data: categories = [], isLoading: isLoadingCat } = useGetCategories()
	const { data: accounts = [], isLoading: isLoadingAcc } = useGetAccounts()
	const searchParams = useSearchParams()
	const highlightedTransactionId = searchParams.get('highlight') || ''
	const shouldOpenDetails = searchParams.get('open') === 'details'

	const [currentFilter, setCurrentFilter] = useState('all')
	const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
	// Deep link (`?highlight=<id>&open=details`): open the details once per id, so
	// closing the dialog does not reopen it while the parameters stay in the URL.
	const autoOpenedIdRef = useRef<string | null>(null)

	const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])

	const handleDelete = useCallback(
		async (id: string) => {
			// The delete mutation invalidates every list/balance query.
			await deleteTransaction(id)
			setSelectedTransaction((current) => (current?.id === id ? null : current))
		},
		[deleteTransaction],
	)

	const incomeTransactions = useMemo(
		() => transactions.filter((t) => t.type_transation === TypeTransaction.INCOME),
		[transactions],
	)
	const expenseTransactions = useMemo(
		() =>
			transactions.filter(
				(t) =>
					t.type_transation === TypeTransaction.BILL ||
					t.type_transation === TypeTransaction.LOAN_DISBURSEMENT ||
					t.type_transation === TypeTransaction.INVESTMENT_PURCHASE ||
					t.type_transation === TypeTransaction.INVESTMENT_FUNDING,
			),
		[transactions],
	)

	const filteredTransactions = useMemo(() => {
		switch (currentFilter) {
			case 'income':
				return incomeTransactions
			case 'expense':
				return expenseTransactions
			default:
				return transactions
		}
	}, [currentFilter, transactions, incomeTransactions, expenseTransactions])

	const renderTransactionList = (transactionList: Transaction[]) => (
		<ul className='space-y-4 min-h-[50vh]'>
			{/* AnimatePresence mode="sync" is cheaper than "popLayout":
                "popLayout" measures every sibling's layout on each change (O(n)),
                while "sync" only animates the entering/exiting element.
                The `layout` prop is intentionally omitted for the same reason. */}
			<AnimatePresence mode='sync' initial={false}>
				{transactionList.map((transaction) => (
					<TransactionRow
						key={transaction.id}
						transaction={transaction}
						category={categoriesById.get(transaction.category_id)}
						highlighted={highlightedTransactionId === transaction.id}
						onOpenDetails={setSelectedTransaction}
						onDelete={handleDelete}
					/>
				))}
			</AnimatePresence>
			{transactionList.length === 0 && (
				<m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className='text-center py-10 text-muted-foreground'>
					{t('noTransactions')}
				</m.div>
			)}
		</ul>
	)

	const tabsConfig = [
		{ value: 'all', label: t('all'), icon: <CreditCard className='h-4 w-4' />, content: <></> },
		{ value: 'income', label: t('income'), icon: <TrendingUp className='h-4 w-4' />, content: <></> },
		{ value: 'expense', label: t('expense'), icon: <TrendingDown className='h-4 w-4' />, content: <></> },
	]

	useEffect(() => {
		if (!highlightedTransactionId) return
		const element = document.getElementById(`transaction-item-${highlightedTransactionId}`)
		if (!element) return
		element.scrollIntoView({ behavior: 'smooth', block: 'center' })
	}, [highlightedTransactionId])

	useEffect(() => {
		if (!shouldOpenDetails || !highlightedTransactionId || autoOpenedIdRef.current === highlightedTransactionId) return
		const match = transactions.find((item) => item.id === highlightedTransactionId)
		if (match) {
			autoOpenedIdRef.current = highlightedTransactionId
			setSelectedTransaction(match)
		}
	}, [shouldOpenDetails, highlightedTransactionId, transactions])

	if (isLoadingTx || isLoadingCat || isLoadingAcc) {
		return <TransactionsPageSkeleton />
	}

	return (
		<m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
			<div className='mb-8'>
				<TransactionSummaryCard transactions={transactions} summary={summary} />
			</div>

			<div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4'>
				{pagination && (
					<div className='flex flex-wrap items-center gap-2 text-sm text-muted-foreground'>
						<span>
							{t('showing')} {transactions.length} {t('of')} {pagination.total_records} {t('transactionsCount')}
							{pagination.total_pages > 1 &&
								` (${t('page')} ${pagination.current_page} ${t('of')} ${pagination.total_pages})`}
						</span>
						{searchParams.toString().length > 0 && (
							<Button variant='link' size='sm' onClick={clearFilters} className='h-auto p-0 ml-2'>
								{tCommon('actions.viewAll')}
							</Button>
						)}
					</div>
				)}
				<div className='ml-auto'>
					<TransactionSort />
				</div>
			</div>

			<div className='space-y-6'>
				<AnimatedTabs defaultValue='all' onValueChange={setCurrentFilter} tabs={tabsConfig} noContent={true} />

				{renderTransactionList(filteredTransactions)}
			</div>

			<Dialog open={Boolean(selectedTransaction)} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{selectedTransaction?.name}</DialogTitle>
						<DialogDescription className={selectedTransaction?.description?.trim() ? undefined : 'italic'}>
							{selectedTransaction?.description?.trim() || t('noDescription')}
						</DialogDescription>
					</DialogHeader>
					{selectedTransaction && (
						<div className='space-y-3 text-sm'>
							<div className='grid grid-cols-2 gap-3'>
								<div className='min-w-0'>
									<p className='text-xs text-muted-foreground'>{t('amount')}</p>
									<p
										className={`font-semibold tabular-nums break-words ${isInflowTransaction(selectedTransaction.type_transation) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
									>
										{formatCurrency(getSignedAmount(selectedTransaction), selectedTransaction.currency, {
											locale,
											signDisplay: 'exceptZero',
										})}
									</p>
								</div>
								<div className='min-w-0'>
									<p className='text-xs text-muted-foreground'>{t('type')}</p>
									<p className='font-semibold'>{t(getTransactionTypeKey(selectedTransaction.type_transation))}</p>
								</div>
							</div>
							<div className='grid grid-cols-2 gap-3'>
								<div className='min-w-0'>
									<p className='text-xs text-muted-foreground'>{t('account')}</p>
									<p className='font-semibold break-words'>
										{accounts.find((acc) => acc.id === selectedTransaction.account_id)?.name ||
											selectedTransaction.account_id}
									</p>
								</div>
								<div className='min-w-0'>
									<p className='text-xs text-muted-foreground'>{t('category')}</p>
									<p className='font-semibold break-words'>
										{categories.find((cat) => cat.id === selectedTransaction.category_id)?.name || '-'}
									</p>
								</div>
							</div>
							<div>
								<p className='text-xs text-muted-foreground'>{t('date')}</p>
								<p className='font-semibold'>
									{formatLocalDate(selectedTransaction.created_at, locale, {
										dateStyle: 'long',
										timeStyle: 'short',
									})}
								</p>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</m.div>
	)
}
