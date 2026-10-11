'use client'

import { CalendarClock, Edit, MoreHorizontal, Plus, Trash } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Amount } from '@/components/shared/Amount'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import {
	useDeleteRecurringTransactionMutation,
	useRecurringTransactionsQuery,
} from '@/hooks/queries/useRecurringTransactionsQuery'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { RecurringTransaction } from '@/types/recurringTransaction'
import { useRecurringTransactionContext } from './RecurringTransactionContext'

export function RecurringTransactionList() {
	const t = useTranslations('recurring')
	const tCommon = useTranslations('common')
	const locale = useAppLocale()
	const { data: transactions, isLoading, isError, refetch } = useRecurringTransactionsQuery()
	const { data: accounts = [] } = useGetAccounts()
	const deleteMutation = useDeleteRecurringTransactionMutation()
	const { setEditingTransaction, setModalOpen } = useRecurringTransactionContext()
	const [toDelete, setToDelete] = useState<RecurringTransaction | null>(null)

	// Recurring items have no currency of their own: they post in their account's currency.
	const currencyByAccount = useMemo(
		() => new Map(accounts.map((account) => [account.id, account.currency])),
		[accounts],
	)

	const handleNew = () => {
		setEditingTransaction(null)
		setModalOpen(true)
	}

	const handleEdit = (item: RecurringTransaction) => {
		setEditingTransaction(item)
		setModalOpen(true)
	}

	const handleConfirmDelete = async () => {
		if (!toDelete) return
		try {
			await deleteMutation.mutateAsync(toDelete.id)
		} catch (error) {
			toast.error(t('deleteError'))
			throw error
		}
	}

	if (isLoading) {
		return (
			<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3' aria-busy='true'>
				{[1, 2, 3].map((i) => (
					<Skeleton key={i} className='h-32 w-full rounded-lg' />
				))}
			</div>
		)
	}

	if (isError && !transactions) {
		return <ErrorState onRetry={() => refetch()} />
	}

	if (!transactions || transactions.length === 0) {
		return (
			<EmptyState
				icon={CalendarClock}
				title={t('emptyTitle')}
				description={t('emptyDescription')}
				action={
					<Button onClick={handleNew}>
						<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
						{t('newRecurring')}
					</Button>
				}
			/>
		)
	}

	return (
		<>
			<ul className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
				{transactions.map((item) => {
					const isIncome = item.type === 'income'
					return (
						<li key={item.id}>
							<Card className='h-full'>
								<CardHeader className='flex flex-row items-center justify-between gap-2 space-y-0 pb-2'>
									<CardTitle className='min-w-0 truncate text-sm font-medium'>{item.name}</CardTitle>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant='ghost'
												size='icon'
												className='-mr-2 shrink-0'
												aria-label={tCommon('actions.rowMenu', { name: item.name })}
											>
												<MoreHorizontal className='h-4 w-4' aria-hidden='true' />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align='end'>
											<DropdownMenuItem onSelect={() => handleEdit(item)}>
												<Edit className='mr-2 h-4 w-4' aria-hidden='true' /> {t('edit')}
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												onSelect={() => setToDelete(item)}
												className='text-destructive focus:text-destructive'
											>
												<Trash className='mr-2 h-4 w-4' aria-hidden='true' /> {t('delete')}
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</CardHeader>
								<CardContent className='space-y-2'>
									<p className='text-2xl font-semibold'>
										<span className='sr-only'>{isIncome ? t('typeIncome') : t('typeBill')}: </span>
										<Amount
											value={isIncome ? item.amount : -item.amount}
											currency={currencyByAccount.get(item.account_id)}
											tone='auto'
											icon
										/>
									</p>
									<div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground'>
										<span className='flex items-center'>
											<CalendarClock className='mr-1 h-3 w-3' aria-hidden='true' />
											{t('dayOfEveryMonth', { day: item.day_of_month })}
										</span>
										{item.last_execution_date && (
											<span>{t('lastRun', { date: formatLocalDate(item.last_execution_date, locale) })}</span>
										)}
									</div>
								</CardContent>
							</Card>
						</li>
					)
				})}
			</ul>

			<ConfirmDialog
				open={toDelete !== null}
				onOpenChange={(open) => !open && setToDelete(null)}
				title={t('confirmDelete', { name: toDelete?.name ?? '' })}
				description={tCommon('confirm.irreversible')}
				destructive
				onConfirm={handleConfirmDelete}
			/>
		</>
	)
}
