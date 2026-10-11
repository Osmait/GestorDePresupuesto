'use client'

import { ArrowLeft, Receipt } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AccountAnalytics } from '@/components/accounts/AccountAnalytics'
import { Amount } from '@/components/shared/Amount'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PageShell } from '@/components/shared/PageShell'
import { StatGridSkeleton } from '@/components/shared/StatGrid'
import TransactionItem from '@/components/transactions/TransactionItem'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetAccount } from '@/hooks/queries/useAccountsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { useDeleteTransactionMutation, useGetTransactions } from '@/hooks/queries/useTransactionsQuery'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { DEFAULT_CURRENCY } from '@/lib/utils'

/** Back to the accounts list: a 40px icon button in PageHeader's `leading` slot. */
function BackButton({ label }: { label: string }) {
	return (
		<Button asChild variant='ghost' size='icon' className='mt-0.5'>
			<Link href='/app/accounts' aria-label={label} title={label}>
				<ArrowLeft className='h-4 w-4' aria-hidden='true' />
			</Link>
		</Button>
	)
}

export default function AccountDetailsPage() {
	const params = useParams()
	const id = params.id as string
	const t = useTranslations('accounts')
	const locale = useAppLocale()

	const { data: account, isLoading: isLoadingAccount, isError, refetch } = useGetAccount(id)

	const { data: transactionData, isLoading: isLoadingTx } = useGetTransactions({
		account_id: id,
		limit: 100, // Last 100 transactions for this account
	})
	const deleteTransaction = useDeleteTransactionMutation()

	const { data: categories = [] } = useGetCategories()

	const transactions = transactionData?.transactions || []

	if (isLoadingAccount || isLoadingTx) {
		return (
			<PageShell aria-busy='true'>
				<div className='flex items-start gap-3'>
					<Skeleton className='h-10 w-10 shrink-0 rounded-md' />
					<div className='space-y-2'>
						<Skeleton className='h-9 w-64' />
						<Skeleton className='h-5 w-40' />
					</div>
				</div>
				<StatGridSkeleton count={3} />
				<div className='grid gap-4 lg:grid-cols-2'>
					<Skeleton className='h-[260px]' />
					<Skeleton className='h-[260px]' />
				</div>
				<Skeleton className='h-[400px]' />
			</PageShell>
		)
	}

	if (isError || !account) {
		return (
			<PageShell>
				<ErrorState
					title={t('detail.notFoundTitle')}
					description={t('detail.notFoundDescription')}
					onRetry={() => void refetch()}
					action={
						<Button asChild>
							<Link href='/app/accounts'>{t('detail.back')}</Link>
						</Button>
					}
				/>
			</PageShell>
		)
	}

	const currency = account.currency || DEFAULT_CURRENCY
	const currentBalance = account.current_balance ?? account.initial_balance

	return (
		<PageShell>
			<PageHeader
				leading={<BackButton label={t('detail.back')} />}
				title={account.name}
				description={account.bank}
				className='break-words'
			/>

			<AccountAnalytics
				transactions={transactions}
				categories={categories}
				currentBalance={currentBalance}
				currency={currency}
			/>

			<div className='grid gap-6 md:grid-cols-3'>
				<div className='min-w-0 md:col-span-2'>
					<Card>
						<CardHeader>
							<h2 className='text-xl font-semibold leading-none tracking-tight'>{t('detail.recentTransactions')}</h2>
						</CardHeader>
						<CardContent className='px-3 sm:px-6'>
							{transactions.length > 0 ? (
								<ul className='space-y-4'>
									{transactions.map((tx) => {
										const category = categories.find((c) => c.id === tx.category_id)
										return (
											<li key={tx.id}>
												<TransactionItem
													transaction={tx}
													category={category}
													onTransactionDeleted={async () => {
														// Invalidates the account (balance), its transactions and analytics.
														await deleteTransaction.mutateAsync(tx.id)
													}}
												/>
											</li>
										)
									})}
								</ul>
							) : (
								<EmptyState compact icon={Receipt} title={t('detail.noTransactions')} />
							)}
						</CardContent>
					</Card>
				</div>

				<div className='min-w-0'>
					<Card>
						<CardHeader>
							<h2 className='text-xl font-semibold leading-none tracking-tight'>{t('detail.details')}</h2>
						</CardHeader>
						<CardContent>
							<dl className='divide-y'>
								<div className='pb-4'>
									<dt className='text-sm font-medium text-muted-foreground'>{t('detail.accountType')}</dt>
									<dd className='font-medium'>
										{account.type === 'credit_card' ? t('detail.typeCreditCard') : t('detail.typeBank')}
									</dd>
								</div>
								<div className='py-4'>
									<dt className='text-sm font-medium text-muted-foreground'>{t('detail.currency')}</dt>
									<dd className='font-medium'>{currency}</dd>
								</div>
								<div className='py-4'>
									<dt className='text-sm font-medium text-muted-foreground'>{t('initialBalance')}</dt>
									<dd className='font-medium'>
										<Amount value={account.initial_balance ?? 0} currency={currency} />
									</dd>
								</div>
								{account.created_at && (
									<div className='pt-4'>
										<dt className='text-sm font-medium text-muted-foreground'>{t('detail.createdAt')}</dt>
										<dd className='font-medium'>
											{formatLocalDate(account.created_at, locale, { dateStyle: 'long' })}
										</dd>
									</div>
								)}
							</dl>
						</CardContent>
					</Card>
				</div>
			</div>
		</PageShell>
	)
}
