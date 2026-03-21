import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRightLeft, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useFundBrokerMutation, useGetInvestmentFundingBalances } from '@/hooks/queries/useInvestmentsQuery'

interface InvestmentFundingModalProps {
	isOpen: boolean
	onClose: () => void
}

const SUPPORTED_CURRENCIES = ['USD', 'DOP']

const fundingSchema = z.object({
	sourceAccountID: z.string().min(1, 'Select a source account'),
	sourceAmount: z.coerce.number().positive('Source amount must be greater than 0'),
	targetCurrency: z.string().min(1),
	exchangeRate: z.coerce.number().min(0),
	feeAmount: z.coerce.number().min(0),
	notes: z.string().optional().default(''),
})

type FundingFormValues = z.infer<typeof fundingSchema>

export function InvestmentFundingModal({ isOpen, onClose }: InvestmentFundingModalProps) {
	const { data: accounts = [] } = useGetAccounts()
	const { data: balances = [] } = useGetInvestmentFundingBalances()
	const fundMutation = useFundBrokerMutation()
	const [error, setError] = useState<string | null>(null)

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
			setError('Exchange rate is required when currencies differ')
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
			setError(submitError instanceof Error ? submitError.message : 'Failed to fund broker balance')
		}
	}

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className='sm:max-w-[560px]'>
				<DialogHeader>
					<DialogTitle>Fund broker balance</DialogTitle>
					<DialogDescription>Move funds from a bank account into your investment wallet.</DialogDescription>
				</DialogHeader>

				<div className='rounded-md border p-3 text-sm'>
					<p className='font-medium'>Current wallet balances</p>
					<div className='mt-1 space-y-1 text-muted-foreground'>
						{balances.length === 0 && <p>No funding yet.</p>}
						{balances.map((balance) => (
							<p key={balance.currency}>
								{balance.currency}: {balance.available.toFixed(2)}
							</p>
						))}
					</div>
				</div>

				{error && (
					<Alert variant='destructive'>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
						<FormField
							control={form.control}
							name='sourceAccountID'
							render={({ field }) => (
								<FormItem>
									<FormLabel>Source account</FormLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder='Select account' />
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
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className='grid gap-3 md:grid-cols-2'>
							<FormField
								control={form.control}
								name='sourceAmount'
								render={({ field }) => (
									<FormItem>
										<FormLabel>Amount from account ({sourceCurrency})</FormLabel>
										<FormControl>
											<Input type='number' step='any' {...field} />
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
										<FormLabel>Target wallet currency</FormLabel>
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
											Exchange rate ({sourceCurrency} per {watchedValues.targetCurrency})
										</FormLabel>
										<FormControl>
											<Input type='number' step='any' {...field} disabled={!requiresExchangeRate} />
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
										<FormLabel>Bank/FX fees ({sourceCurrency})</FormLabel>
										<FormControl>
											<Input type='number' step='any' {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className='rounded-md border p-3 text-sm text-muted-foreground'>
							<p className='font-medium text-foreground'>Estimated credit</p>
							<div className='mt-1 flex items-center gap-2'>
								<span>
									{(Number(watchedValues.sourceAmount) || 0).toFixed(2)} {sourceCurrency}
								</span>
								<ArrowRightLeft className='h-4 w-4' />
								<span>
									{estimatedTargetAmount.toFixed(2)} {watchedValues.targetCurrency}
								</span>
							</div>
						</div>

						<FormField
							control={form.control}
							name='notes'
							render={({ field }) => (
								<FormItem>
									<FormLabel>Notes (optional)</FormLabel>
									<FormControl>
										<Input {...field} placeholder='Transfer to broker account' />
									</FormControl>
								</FormItem>
							)}
						/>

						<DialogFooter>
							<Button type='submit' disabled={fundMutation.isPending}>
								{fundMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
								Fund broker
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
