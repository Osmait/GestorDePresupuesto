'use client'

import { AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AccountAnalytics } from '@/components/accounts/AccountAnalytics'
import TransactionItem from '@/components/transactions/TransactionItem'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetAccount } from '@/hooks/queries/useAccountsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { useDeleteTransactionMutation, useGetTransactions } from '@/hooks/queries/useTransactionsQuery'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { DEFAULT_CURRENCY, formatCurrency } from '@/lib/utils'

export default function AccountDetailsPage() {
	const params = useParams()
	const id = params.id as string
	const t = useTranslations('accounts')
	const locale = useAppLocale()

	const { data: account, isLoading: isLoadingAccount, isError } = useGetAccount(id)

	const { data: transactionData, isLoading: isLoadingTx } = useGetTransactions({
		account_id: id,
		limit: 100, // Last 100 transactions for this account
	})
	const deleteTransaction = useDeleteTransactionMutation()

	const { data: categories = [] } = useGetCategories()

	const transactions = transactionData?.transactions || []

	if (isLoadingAccount || isLoadingTx) {
		return (
			<div className='container mx-auto px-4 py-8 space-y-8'>
				<Skeleton className='h-12 w-1/3' />
				<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
					<Skeleton className='h-32' />
					<Skeleton className='h-32' />
					<Skeleton className='h-32 md:col-span-2' />
				</div>
				<Skeleton className='h-[400px]' />
			</div>
		)
	}

	if (isError || !account) {
		return (
			<div className='container mx-auto px-4 py-8 text-center flex flex-col items-center justify-center min-h-[50vh]'>
				<AlertCircle className='h-12 w-12 text-destructive mb-4' aria-hidden='true' />
				<h2 className='text-2xl font-bold mb-2'>{t('detail.notFoundTitle')}</h2>
				<p className='text-muted-foreground mb-4'>{t('detail.notFoundDescription')}</p>
				<Button asChild>
					<Link href='/app/accounts'>{t('detail.back')}</Link>
				</Button>
			</div>
		)
	}

	const currency = account.currency || DEFAULT_CURRENCY
	const currentBalance = account.current_balance ?? account.initial_balance

	return (
		<div className='min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20'>
			<div className='container mx-auto px-4 py-8'>
				<div className='mb-6'>
					<Link
						href='/app/accounts'
						className='text-sm text-muted-foreground hover:text-foreground inline-flex items-center mb-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
					>
						<ArrowLeft className='mr-2 h-4 w-4' aria-hidden='true' /> {t('detail.back')}
					</Link>
					<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
						<div className='min-w-0'>
							<h1 className='text-3xl sm:text-4xl font-bold tracking-tight text-foreground break-words'>
								{account.name}
							</h1>
							<p className='text-lg sm:text-xl text-muted-foreground mt-1'>{account.bank}</p>
						</div>
						<div className='sm:text-right'>
							<p className='text-sm text-muted-foreground'>{t('currentBalance')}</p>
							<p className='text-2xl sm:text-3xl font-bold text-primary tabular-nums break-words'>
								{formatCurrency(currentBalance, currency, { locale })}
							</p>
						</div>
					</div>
				</div>

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
								<CardTitle>{t('detail.recentTransactions')}</CardTitle>
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
									<div className='text-center py-8 text-muted-foreground'>{t('detail.noTransactions')}</div>
								)}
							</CardContent>
						</Card>
					</div>

					<div className='min-w-0'>
						<Card>
							<CardHeader>
								<CardTitle>{t('detail.details')}</CardTitle>
							</CardHeader>
							<CardContent className='space-y-4'>
								<div>
									<p className='text-sm font-medium text-muted-foreground'>{t('detail.accountType')}</p>
									<p className='font-medium'>
										{account.type === 'credit_card' ? t('detail.typeCreditCard') : t('detail.typeBank')}
									</p>
								</div>
								<div className='pt-4 border-t'>
									<p className='text-sm font-medium text-muted-foreground'>{t('detail.currency')}</p>
									<p className='font-medium'>{currency}</p>
								</div>
								<div className='pt-4 border-t'>
									<p className='text-sm font-medium text-muted-foreground'>{t('initialBalance')}</p>
									<p className='font-medium tabular-nums'>
										{formatCurrency(account.initial_balance ?? 0, currency, { locale })}
									</p>
								</div>
								{account.created_at && (
									<div className='pt-4 border-t'>
										<p className='text-sm font-medium text-muted-foreground'>{t('detail.createdAt')}</p>
										<p className='font-medium'>{formatLocalDate(account.created_at, locale, { dateStyle: 'long' })}</p>
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	)
}
