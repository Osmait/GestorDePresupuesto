'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRightLeft, Wallet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { EmptyState } from '@/components/shared/EmptyState'
import { FormDialog } from '@/components/shared/FormDialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useFundBrokerMutation, useGetInvestmentFundingBalances } from '@/hooks/queries/useInvestmentsQuery'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { isFundingAccount } from '@/lib/accounts'
import { getInsufficientFundsMessage, getSafeErrorDetail } from '@/lib/api-error'
import { useAppLocale } from '@/lib/i18n/date-locale'

interface InvestmentFundingModalProps {
	isOpen: boolean
	onClose: () => void
}

const SUPPORTED_CURRENCIES = ['USD', 'DOP']

function createFundingSchema(t: (key: string) => string) {
	return z.object({
		sourceAccountID: z.string().min(1, t('errors.sourceRequired')),
		sourceAmount: z.coerce.number().positive(t('errors.amountPositive')),
		targetCurrency: z.string().min(1),
		exchangeRate: z.coerce.number().min(0),
		feeAmount: z.coerce.number().min(0),
		notes: z.string().optional().default(''),
	})
}

type FundingFormValues = z.infer<ReturnType<typeof createFundingSchema>>

export function InvestmentFundingModal({ isOpen, onClose }: InvestmentFundingModalProps) {
	const t = useTranslations('investments.funding')
	const tForms = useTranslations('forms')
	const fundingSchema = useMemo(() => createFundingSchema(t), [t])
	const locale = useAppLocale()
	const formatCurrency = useFormatCurrency()
	const { data: allAccounts = [] } = useGetAccounts()
	// A credit card is debt, not cash: it cannot fund the broker wallet.
	const accounts = useMemo(() => allAccounts.filter(isFundingAccount), [allAccounts])
	const { data: balances = [] } = useGetInvestmentFundingBalances()
	const fundMutation = useFundBrokerMutation()
	const [error, setError] = useState<{ message: string; detail?: string | null } | null>(null)

	const form = useForm<FundingFormValues>({
		resolver: zodResolver(fundingSchema),
		defaultValues: {
			sourceAccountID: '',
			sourceAmount: 0,
			targetCurrency: 'USD',
			exchangeRate: 0,
			feeAmount: 0,
			notes: '',
		},
	})

	const watchedValues = form.watch()

	useEffect(() => {
		if (!watchedValues.sourceAccountID && accounts.length > 0) {
			form.setValue('sourceAccountID', accounts[0].id)
		}
	}, [accounts, watchedValues.sourceAccountID, form])

	useEffect(() => {
		if (isOpen) setError(null)
	}, [isOpen])

	const selectedAccount = useMemo(
		() => accounts.find((account) => account.id === watchedValues.sourceAccountID),
		[accounts, watchedValues.sourceAccountID],
	)
	const sourceCurrency = selectedAccount?.currency || 'DOP'
	const requiresExchangeRate = sourceCurrency !== watchedValues.targetCurrency
	const estimatedTargetAmount = useMemo(() => {
		const sourceAmount = Number(watchedValues.sourceAmount) || 0
		const exchangeRate = Number(watchedValues.exchangeRate) || 0
		if (sourceAmount <= 0) return 0
		if (!requiresExchangeRate) return sourceAmount
		if (exchangeRate <= 0) return 0
		return sourceAmount / exchangeRate
	}, [watchedValues.sourceAmount, requiresExchangeRate, watchedValues.exchangeRate])

	const onSubmit = async (values: FundingFormValues) => {
		setError(null)

		if (requiresExchangeRate && values.exchangeRate <= 0) {
			setError({ message: t('errors.exchangeRateRequired') })
			return
		}

		try {
			await fundMutation.mutateAsync({
				source_account_id: values.sourceAccountID,
				source_amount: values.sourceAmount,
				target_currency: values.targetCurrency,
				exchange_rate: requiresExchangeRate ? values.exchangeRate : undefined,
				fee_amount: values.feeAmount > 0 ? values.feeAmount : undefined,
				notes: values.notes,
			})
			onClose()
		} catch (submitError: unknown) {
			setError({
				message: t('errors.failed'),
				detail: getInsufficientFundsMessage(submitError, tForms, locale) ?? getSafeErrorDetail(submitError),
			})
		}
	}

	return (
		<FormDialog
			open={isOpen}
			onOpenChange={(open) => !open && onClose()}
			title={t('title')}
			description={t('description')}
			submitLabel={t('submit')}
			loading={fundMutation.isPending}
			error={
				error ? (
					<>
						<p>{error.message}</p>
						{error.detail ? <p className='text-xs opacity-90'>{error.detail}</p> : null}
					</>
				) : null
			}
			onSubmit={form.handleSubmit(onSubmit)}
		>
			<Form {...form}>
				<div className='space-y-4'>
					<div className='rounded-md bg-muted/50 p-3 text-sm'>
						<p className='font-medium'>{t('walletBalances')}</p>
						{balances.length === 0 ? (
							<EmptyState
								compact
								icon={Wallet}
								title={t('noFunding')}
								description={t('noFundingDescription')}
								className='py-4'
							/>
						) : (
							<div className='mt-1 space-y-1 text-muted-foreground tabular-nums'>
								{balances.map((balance) => (
									<p key={balance.currency}>
										{balance.currency}: {formatCurrency(balance.available, balance.currency)}
									</p>
								))}
							</div>
						)}
					</div>

					<FormField
						control={form.control}
						name='sourceAccountID'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('sourceAccount')}</FormLabel>
								<Select value={field.value} onValueChange={field.onChange}>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder={t('selectAccount')} />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{accounts.map((account) => (
											<SelectItem key={account.id} value={account.id}>
												{account.name} ({account.currency || 'DOP'})
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{selectedAccount?.current_balance !== undefined && (
									<p className='text-xs text-muted-foreground'>
										{tForms('availableBalance', {
											amount: formatCurrency(selectedAccount.current_balance, sourceCurrency),
										})}
									</p>
								)}
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
						<FormField
							control={form.control}
							name='sourceAmount'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('amountFromAccount', { currency: sourceCurrency })}</FormLabel>
									<FormControl>
										<Input type='number' step='any' inputMode='decimal' {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name='targetCurrency'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('targetCurrency')}</FormLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<FormControl>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{SUPPORTED_CURRENCIES.map((currency) => (
												<SelectItem key={currency} value={currency}>
													{currency}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name='exchangeRate'
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t('exchangeRate', { source: sourceCurrency, target: watchedValues.targetCurrency })}
									</FormLabel>
									<FormControl>
										<Input type='number' step='any' inputMode='decimal' {...field} disabled={!requiresExchangeRate} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name='feeAmount'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('fees', { currency: sourceCurrency })}</FormLabel>
									<FormControl>
										<Input type='number' step='any' inputMode='decimal' {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className='rounded-md bg-muted/50 p-3 text-sm text-muted-foreground'>
						<p className='font-medium text-foreground'>{t('estimatedCredit')}</p>
						<div className='mt-1 flex flex-wrap items-center gap-2 tabular-nums'>
							<span>{formatCurrency(Number(watchedValues.sourceAmount) || 0, sourceCurrency)}</span>
							<ArrowRightLeft className='h-4 w-4' aria-hidden='true' />
							<span>{formatCurrency(estimatedTargetAmount, watchedValues.targetCurrency)}</span>
						</div>
					</div>

					<FormField
						control={form.control}
						name='notes'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('notes')}</FormLabel>
								<FormControl>
									<Input {...field} placeholder={t('notesPlaceholder')} />
								</FormControl>
							</FormItem>
						)}
					/>
				</div>
			</Form>
		</FormDialog>
	)
}
