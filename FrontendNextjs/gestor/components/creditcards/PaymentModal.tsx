'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useExchangeRateQuery } from '@/hooks/queries/useExchangeRateQuery'
import { accountRepository } from '@/lib/repositoryConfig'
import { Account } from '@/types/account'
import { CreatePaymentDTO, CreditCard } from '@/types/creditcard'

interface PaymentModalProps {
	open: boolean
	onClose: () => void
	onSubmit: (data: CreatePaymentDTO) => Promise<void>
	card: CreditCard | null
}

const paymentSchema = z.object({
	fromAccountId: z.string().min(1, 'Select an account'),
	currency: z.string().min(1),
	amount: z.coerce.number().positive('Amount must be greater than 0'),
	exchangeRate: z.string().optional().default(''),
	includesInterest: z.boolean().default(false),
	interestAmount: z.coerce.number().min(0).default(0),
	notes: z.string().optional().default(''),
})

type PaymentFormValues = z.infer<typeof paymentSchema>

export function PaymentModal({ open, onClose, onSubmit, card }: PaymentModalProps) {
	const [loading, setLoading] = useState(false)
	const [accounts, setAccounts] = useState<Account[]>([])
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
		try {
			const data = await accountRepository.findAll()
			setAccounts(data.filter((a: Account) => a.type === 'bank'))
		} catch (error) {
			console.error('Error loading accounts:', error)
		}
	}, [accountRepository])

	useEffect(() => {
		if (open) {
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

	useEffect(() => {
		if (!open || !selectedBalance) return
		form.setValue('amount', Math.max(0, -selectedBalance.current_balance))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [watchedValues.currency, open])

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
			console.error('Error making payment:', error)
		} finally {
			setLoading(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className='max-w-md'>
				<DialogHeader>
					<DialogTitle>Pay Credit Card</DialogTitle>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(handleFormSubmit)} className='space-y-4'>
						<FormField
							control={form.control}
							name='fromAccountId'
							render={({ field }) => (
								<FormItem>
									<FormLabel>Pay From Account</FormLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder='Select account' />
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
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name='currency'
							render={({ field }) => (
								<FormItem>
									<FormLabel>Currency</FormLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<FormControl>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{card?.balances.map((b) => (
												<SelectItem key={b.currency} value={b.currency}>
													{b.currency} (Debt: {Math.max(0, -b.current_balance).toLocaleString()})
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
									<FormLabel>Amount to Pay</FormLabel>
									<FormControl>
										<Input type='number' step='0.01' placeholder={currentDebt.toString()} {...field} />
									</FormControl>
									<p className='text-xs text-muted-foreground'>
										Current debt: {currentDebt.toLocaleString()} {watchedValues.currency}
									</p>
									{exceedsDebt ? (
										<p className='text-xs text-amber-600'>
											Payment exceeds current debt by{' '}
											{overpayAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {watchedValues.currency}.
											The extra will be credited to the card.
										</p>
									) : null}
									<FormMessage />
								</FormItem>
							)}
						/>

						{hasValidAmount && (
							<div className='rounded-md border border-dashed p-3 space-y-1'>
								<p className='text-xs text-muted-foreground'>
									Debit from account:{' '}
									<span className='font-medium text-foreground'>
										{debitPreview.toLocaleString(undefined, { maximumFractionDigits: 2 })} {sourceCurrency}
									</span>
								</p>
								{watchedValues.currency === 'USD' && dopEquivalent !== null && (
									<p className='text-xs text-muted-foreground'>
										Equivalent in DOP:{' '}
										<span className='font-medium text-foreground'>
											{dopEquivalent.toLocaleString(undefined, { maximumFractionDigits: 2 })} DOP
										</span>
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
										<FormLabel>
											Exchange Rate ({watchedValues.currency} to {sourceCurrency})
										</FormLabel>
										<FormControl>
											<Input
												type='number'
												step='0.0001'
												placeholder={recommendedRate ? recommendedRate.toFixed(4) : 'Enter rate'}
												{...field}
											/>
										</FormControl>
										{recommendedRate ? (
											<p className='text-xs text-muted-foreground'>
												Recommended rate from API: {recommendedRate.toFixed(4)}
											</p>
										) : (
											<p className='text-xs text-muted-foreground'>
												Could not fetch recommended rate. Enter custom rate.
											</p>
										)}
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						<div className='space-y-2'>
							<div className='flex items-center justify-between'>
								<Label htmlFor='interest'>Includes Interest</Label>
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
												<Input type='number' step='0.01' placeholder='Interest amount' {...field} />
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
									<FormLabel>Notes (Optional)</FormLabel>
									<FormControl>
										<Input {...field} placeholder='Payment notes' />
									</FormControl>
								</FormItem>
							)}
						/>

						<DialogFooter>
							<Button type='button' variant='outline' onClick={onClose}>
								Cancel
							</Button>
							<Button
								type='submit'
								disabled={loading || !watchedValues.fromAccountId || !exchangeRateValid || !hasValidAmount}
							>
								{loading ? 'Processing…' : 'Make Payment'}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
