'use client'

import { ArrowDownCircle, ArrowUpCircle, CalendarClock, Edit, MoreHorizontal, Trash } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
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
import { formatCurrency } from '@/lib/utils'
import { RecurringTransaction } from '@/types/recurringTransaction'
import { useRecurringTransactionContext } from './RecurringTransactionContext'

export function RecurringTransactionList() {
	const t = useTranslations('recurring')
	const locale = useAppLocale()
	const { data: transactions, isLoading } = useRecurringTransactionsQuery()
	const { data: accounts = [] } = useGetAccounts()
	const deleteMutation = useDeleteRecurringTransactionMutation()
	const { setEditingTransaction, setModalOpen } = useRecurringTransactionContext()

	// Recurring items have no currency of their own: they post in their account's currency.
	const currencyByAccount = useMemo(
		() => new Map(accounts.map((account) => [account.id, account.currency])),
		[accounts],
	)

	if (isLoading) {
		return (
			<div className='space-y-4'>
				{[1, 2, 3].map((i) => (
					<Skeleton key={i} className='h-24 w-full' />
				))}
			</div>
		)
	}

	if (!transactions || transactions.length === 0) {
		return (
			<Card className='text-center py-12'>
				<CardContent>
					<CalendarClock className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
					<h3 className='text-lg font-semibold'>{t('emptyTitle')}</h3>
					<p className='text-muted-foreground'>{t('emptyDescription')}</p>
				</CardContent>
			</Card>
		)
	}

	const handleDelete = (item: RecurringTransaction) => {
		if (confirm(t('confirmDelete', { name: item.name }))) {
			deleteMutation.mutate(item.id)
		}
	}

	const handleEdit = (item: RecurringTransaction) => {
		setEditingTransaction(item)
		setModalOpen(true)
	}

	return (
		<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
			{transactions.map((item) => (
				<Card key={item.id} className='hover:shadow-md transition-shadow'>
					<CardHeader className='flex flex-row items-center justify-between gap-2 space-y-0 pb-2'>
						<CardTitle className='min-w-0 truncate text-sm font-medium'>{item.name}</CardTitle>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant='ghost' className='h-8 w-8 shrink-0 p-0'>
									<span className='sr-only'>{t('openMenu', { name: item.name })}</span>
									<MoreHorizontal className='h-4 w-4' />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align='end'>
								<DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
								<DropdownMenuItem onClick={() => handleEdit(item)}>
									<Edit className='mr-2 h-4 w-4' /> {t('edit')}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => handleDelete(item)} className='text-destructive'>
									<Trash className='mr-2 h-4 w-4' /> {t('delete')}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</CardHeader>
					<CardContent>
						<div className='flex items-center justify-between mb-2'>
							<div className='flex min-w-0 items-center space-x-2'>
								{item.type === 'income' ? (
									<ArrowUpCircle className='h-5 w-5 shrink-0 text-green-500' aria-label={t('typeIncome')} />
								) : (
									<ArrowDownCircle className='h-5 w-5 shrink-0 text-red-500' aria-label={t('typeBill')} />
								)}
								<span className='truncate text-2xl font-bold'>
									{formatCurrency(item.amount, currencyByAccount.get(item.account_id), { locale })}
								</span>
							</div>
						</div>
						<div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground'>
							<div className='flex items-center'>
								<CalendarClock className='mr-1 h-3 w-3' />
								{t('dayOfEveryMonth', { day: item.day_of_month })}
							</div>
							{item.last_execution_date && (
								<span>{t('lastRun', { date: formatLocalDate(item.last_execution_date, locale) })}</span>
							)}
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	)
}
