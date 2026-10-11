'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormDialog } from '@/components/shared/FormDialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useExchangeRateQuery } from '@/hooks/queries/useExchangeRateQuery'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { getInsufficientFundsMessage, getSafeErrorDetail } from '@/lib/api-error'
import { useAppLocale } from '@/lib/i18n/date-locale'
import { hasAtMostDecimals } from '@/lib/money-validation'
import { getAccountRepository } from '@/lib/repositoryConfig'
import { Account } from '@/types/account'
import { CreatePaymentDTO, CreditCard } from '@/types/creditcard'

interface PaymentModalProps {
	open: boolean
	onClose: () => void
	onSubmit: (data: CreatePaymentDTO) => Promise<void>
	card: CreditCard | null
}

type Translator = (key: string, values?: Record<string, string | number>) => string

function createPaymentSchema(t: Translator, tForms: Translator) {
	// card_payments.amount / interest_amount are DECIMAL(15,2): the API rejects sub-cent amounts.
	const maxTwoDecimals = tForms('maxTwoDecimals')
	return z.object({
		fromAccountId: z.string().min(1, t('errors.selectAccount')),
		currency: z.string().min(1),
		amount: z.coerce
			.number()
			.positive(t('errors.amountPositive'))
			.refine((value) => hasAtMostDecimals(value), maxTwoDecimals),
		exchangeRate: z.string().optional().default(''),
		includesInterest: z.boolean().default(false),
		interestAmount: z.coerce
			.number()
			.min(0)
			.refine((value) => hasAtMostDecimals(value), maxTwoDecimals)
			.default(0),
		notes: z.string().optional().default(''),
	})
}

type PaymentFormValues = z.infer<ReturnType<typeof createPaymentSchema>>

export function PaymentModal({ open, onClose, onSubmit, card }: PaymentModalProps) {
	const t = useTranslations('creditCards.payment')
	const tForms = useTranslations('forms')
	const locale = useAppLocale()
	const formatCurrency = useFormatCurrency()
	const paymentSchema = useMemo(() => createPaymentSchema(t, tForms), [t, tForms])
	const [loading, setLoading] = useState(false)
	const [submitError, setSubmitError] = useState<{ detail: string | null } | null>(null)
	const [accounts, setAccounts] = useState<Account[]>([])
	const [accountsError, setAccountsError] = useState(false)
	const { data: rateData } = useExchangeRateQuery()

	const form = useForm<PaymentFormValues>({
		resolver: zodResolver(paymentSchema),
		defaultValues: {
			fromAccountId: '',
			currency: card?.balances[0]?.currency || 'DOP',
			amount: 0,
			exchangeRate: '',
			includesInterest: false,
			interestAmount: 0,
			notes: '',
		},
	})

	const watchedValues = form.watch()

	const loadAccounts = useCallback(async () => {
		setAccountsError(false)
		try {
			const data = await getAccountRepository().findAll()
			setAccounts(data.filter((a: Account) => a.type === 'bank'))
		} catch {
			// Without source accounts the payment can't be made: say so and offer a retry.
			setAccountsError(true)
		}
	}, [])

	useEffect(() => {
		if (open) {
			setSubmitError(null)
			loadAccounts()
			if (card?.balances[0]) {
				form.setValue('currency', card.balances[0].currency)
				form.setValue('amount', Math.abs(card.balances[0].current_balance))
			}
		}
	}, [open, card, form.setValue, loadAccounts])

	const selectedBalance = card?.balances.find((b) => b.currency === watchedValues.currency)
	const currentDebt = selectedBalance ? Math.max(0, -selectedBalance.current_balance) : 0
	const selectedAccount = accounts.find((a) => a.id === watchedValues.fromAccountId)
	const sourceCurrency = selectedAccount?.currency || 'DOP'
	const needsExchangeRate = sourceCurrency !== watchedValues.currency
	const recommendedRate =
		needsExchangeRate && watchedValues.currency === 'USD' && sourceCurrency === 'DOP' ? rateData?.usd_to_dop : undefined

	// biome-ignore lint/correctness/useExhaustiveDependencies: prefill the amount only when the modal opens or the currency changes, not on every card refetch
	useEffect(() => {
		if (!open || !selectedBalance) return
		form.setValue('amount', Math.max(0, -selectedBalance.current_balance))
	}, [watchedValues.currency, open, form.setValue])

	useEffect(() => {
		if (!needsExchangeRate) {
			form.setValue('exchangeRate', '')
			return
		}
		if (recommendedRate && !watchedValues.exchangeRate) {
			form.setValue('exchangeRate', recommendedRate.toFixed(4))
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [needsExchangeRate, recommendedRate, form.setValue, watchedValues.exchangeRate])

	const parsedRate = parseFloat(watchedValues.exchangeRate || '0')
	const exchangeRateValid = !needsExchangeRate || (Number.isFinite(parsedRate) && parsedRate > 0)
	const paymentAmountNumber = Number(watchedValues.amount)
	const hasValidAmount = Number.isFinite(paymentAmountNumber) && paymentAmountNumber > 0
	const debitPreview = (() => {
		if (!hasValidAmount) return 0
		if (!needsExchangeRate) return paymentAmountNumber
		if (!exchangeRateValid) return 0
		if (watchedValues.currency === 'USD' && sourceCurrency === 'DOP') return paymentAmountNumber * parsedRate
		if (watchedValues.currency === 'DOP' && sourceCurrency === 'USD') return paymentAmountNumber / parsedRate
		return 0
	})()
	const dopEquivalent = (() => {
		if (!hasValidAmount) return null
		if (watchedValues.currency === 'DOP') return paymentAmountNumber
		const rate = parsedRate > 0 ? parsedRate : rateData?.usd_to_dop
		if (!rate || rate <= 0) return null
		return paymentAmountNumber * rate
	})()
	const exceedsDebt = hasValidAmount && currentDebt > 0 && paymentAmountNumber > currentDebt
	const overpayAmount = exceedsDebt ? paymentAmountNumber - currentDebt : 0

	const handleFormSubmit = async (values: PaymentFormValues) => {
		if (!card) return

		const parsedExchangeRate = parseFloat(values.exchangeRate || '0')

		setLoading(true)
		setSubmitError(null)
		try {
			await onSubmit({
				from_account_id: values.fromAccountId,
				currency: values.currency,
				amount: values.amount,
				exchange_rate: needsExchangeRate ? parsedExchangeRate : undefined,
				includes_interest: values.includesInterest,
				interest_amount: values.includesInterest ? values.interestAmount : 0,
				notes: values.notes || undefined,
			})
			onClose()
			form.reset()
		} catch (error) {
			// Keep the modal open with the user's input and say why it failed.
			setSubmitError({ detail: getInsufficientFundsMessage(error, tForms, locale) ?? getSafeErrorDetail(error) })
		} finally {
			setLoading(false)
		}
	}

	return (
		<FormDialog
			open={open}
			onOpenChange={(next) => !next && onClose()}
			title={t('title')}
			size='sm'
			submitLabel={t('submit')}
			loading={loading}
			submitDisabled={!watchedValues.fromAccountId || !exchangeRateValid || !hasValidAmount}
			error={
				submitError ? (
					<>
						<p>{t('errors.failed')}</p>
						{submitError.detail ? <p className='text-xs opacity-90'>{submitError.detail}</p> : null}
					</>
				) : null
			}
			onSubmit={form.handleSubmit(handleFormSubmit)}
		>
			<Form {...form}>
				<div className='space-y-4'>
					<FormField
						control={form.control}
						name='fromAccountId'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('fromAccount')}</FormLabel>
								{accountsError ? (
									<ErrorState
										compact
										className='rounded-md border py-4'
										title={t('errors.accountsLoad')}
										onRetry={() => void loadAccounts()}
									/>
								) : null}
								<Select value={field.value} onValueChange={field.onChange} disabled={accountsError}>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder={t('selectAccount')} />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{accounts.map((account) => (
											<SelectItem key={account.id} value={account.id}>
												{account.name} ({account.bank}) - {account.currency || 'DOP'}
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

					<FormField
						control={form.control}
						name='currency'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('currency')}</FormLabel>
								<Select value={field.value} onValueChange={field.onChange}>
									<FormControl>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{card?.balances.map((b) => (
											<SelectItem key={b.currency} value={b.currency}>
												{t('currencyOption', {
													currency: b.currency,
													debt: formatCurrency(Math.max(0, -b.current_balance), b.currency),
												})}
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
						name='amount'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('amount')}</FormLabel>
								<FormControl>
									<Input
										type='number'
										step='0.01'
										inputMode='decimal'
										placeholder={currentDebt.toString()}
										{...field}
									/>
								</FormControl>
								<p className='text-xs text-muted-foreground'>
									{t('currentDebt', { amount: formatCurrency(currentDebt, watchedValues.currency) })}
								</p>
								{exceedsDebt ? (
									<p className='text-xs text-warning'>
										{t('exceedsDebt', { amount: formatCurrency(overpayAmount, watchedValues.currency) })}
									</p>
								) : null}
								<FormMessage />
							</FormItem>
						)}
					/>

					{hasValidAmount && (
						<div className='space-y-1 rounded-md bg-muted/50 p-3 tabular-nums'>
							<p className='text-xs text-muted-foreground'>
								{t('debitFromAccount')}{' '}
								<span className='font-medium text-foreground'>{formatCurrency(debitPreview, sourceCurrency)}</span>
							</p>
							{watchedValues.currency === 'USD' && dopEquivalent !== null && (
								<p className='text-xs text-muted-foreground'>
									{t('equivalentInDop')}{' '}
									<span className='font-medium text-foreground'>{formatCurrency(dopEquivalent, 'DOP')}</span>
								</p>
							)}
						</div>
					)}

					{needsExchangeRate && (
						<FormField
							control={form.control}
							name='exchangeRate'
							render={({ field }) => (
								<FormItem className='rounded-md border p-3'>
									<FormLabel>{t('exchangeRate', { from: watchedValues.currency, to: sourceCurrency })}</FormLabel>
									<FormControl>
										<Input
											type='number'
											step='0.0001'
											placeholder={recommendedRate ? recommendedRate.toFixed(4) : t('enterRate')}
											{...field}
										/>
									</FormControl>
									{recommendedRate ? (
										<p className='text-xs text-muted-foreground'>
											{t('recommendedRate', { rate: recommendedRate.toFixed(4) })}
										</p>
									) : (
										<p className='text-xs text-muted-foreground'>{t('noRecommendedRate')}</p>
									)}
									<FormMessage />
								</FormItem>
							)}
						/>
					)}

					<div className='space-y-2'>
						<div className='flex items-center justify-between'>
							<Label htmlFor='interest'>{t('includesInterest')}</Label>
							<Switch
								id='interest'
								checked={watchedValues.includesInterest}
								onCheckedChange={(checked) => form.setValue('includesInterest', checked)}
							/>
						</div>
						{watchedValues.includesInterest && (
							<FormField
								control={form.control}
								name='interestAmount'
								render={({ field }) => (
									<FormItem>
										<FormControl>
											<Input
												type='number'
												step='0.01'
												placeholder={t('interestAmount')}
												aria-label={t('interestAmount')}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}
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
