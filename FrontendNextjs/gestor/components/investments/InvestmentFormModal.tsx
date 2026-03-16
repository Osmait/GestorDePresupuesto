import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Loader2, AlertCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form'
import { useCreateInvestmentMutation, useGetInvestmentFundingBalances, useUpdateInvestmentMutation } from '@/hooks/queries/useInvestmentsQuery'
import { investmentRepository } from '@/lib/repositoryConfig'
import { Investment, InvestmentType } from '@/types/investment'

interface InvestmentFormModalProps {
	isOpen: boolean
	onClose: () => void
	investmentToEdit?: Investment | null
}

const investmentSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	symbol: z.string().min(1, 'Symbol is required').transform(v => v.toUpperCase()),
	type: z.nativeEnum(InvestmentType),
	quantity: z.coerce.number().min(0, 'Must be >= 0'),
	purchase_price: z.coerce.number().min(0, 'Must be >= 0'),
	current_price: z.coerce.number().min(0, 'Must be >= 0'),
	settlement_currency: z.string().min(1).transform(v => v.toUpperCase()),
})

type InvestmentFormValues = z.infer<typeof investmentSchema>

const defaultValues: InvestmentFormValues = {
	name: '',
	symbol: '',
	type: InvestmentType.STOCK,
	quantity: 0,
	purchase_price: 0,
	current_price: 0,
	settlement_currency: 'USD',
}

export function InvestmentFormModal({ isOpen, onClose, investmentToEdit }: InvestmentFormModalProps) {
	const [error, setError] = useState<string | null>(null)
	const [fetchLoading, setFetchLoading] = useState(false)
	const createMutation = useCreateInvestmentMutation()
	const updateMutation = useUpdateInvestmentMutation()
	const { data: balances = [] } = useGetInvestmentFundingBalances()

	const form = useForm<InvestmentFormValues>({
		resolver: zodResolver(investmentSchema),
		defaultValues,
	})

	useEffect(() => {
		setError(null)
		if (investmentToEdit) {
			form.reset({
				name: investmentToEdit.name,
				symbol: investmentToEdit.symbol,
				type: investmentToEdit.type,
				quantity: investmentToEdit.quantity,
				purchase_price: investmentToEdit.purchase_price,
				current_price: investmentToEdit.current_price,
				settlement_currency: investmentToEdit.settlement_currency || 'USD',
			})
			return
		}
		form.reset(defaultValues)
	}, [investmentToEdit, isOpen, form])

	const watchedValues = form.watch()
	const settlementCurrency = (watchedValues.settlement_currency || 'USD').toUpperCase()
	const requiredAmount = Math.max(watchedValues.quantity, 0) * Math.max(watchedValues.purchase_price, 0)
	const availableBalance = useMemo(() => {
		const match = balances.find((balance) => balance.currency === settlementCurrency)
		return match?.available || 0
	}, [balances, settlementCurrency])

	const handleFetchPrice = async () => {
		const symbol = form.getValues('symbol')
		if (!symbol) return
		setFetchLoading(true)
		try {
			const quote = await investmentRepository.getQuote(symbol)
			if (quote) {
				const currentName = form.getValues('name')
				const currentPurchasePrice = form.getValues('purchase_price')
				form.setValue('current_price', quote.regular_market_price)
				if ((!currentName || currentName === '') && quote.name) {
					form.setValue('name', quote.name)
				}
				if (currentPurchasePrice === 0) {
					form.setValue('purchase_price', quote.regular_market_price)
				}
				setError(null)
				return
			}
			setError('Could not fetch price for this symbol')
		} catch {
			setError('Failed to fetch price')
		} finally {
			setFetchLoading(false)
		}
	}

	const onSubmit = async (values: InvestmentFormValues) => {
		setError(null)

		if (!investmentToEdit && requiredAmount > availableBalance) {
			setError(`Insufficient broker balance in ${settlementCurrency}. Required: ${requiredAmount.toFixed(2)}, available: ${availableBalance.toFixed(2)}`)
			return
		}

		try {
			if (investmentToEdit) {
				await updateMutation.mutateAsync({ id: investmentToEdit.id, ...values })
			} else {
				await createMutation.mutateAsync(values)
			}
			onClose()
		} catch (submitError: unknown) {
			const errorMessage = submitError instanceof Error ? submitError.message : 'Failed to save investment. Please try again.'
			setError(errorMessage)
		}
	}

	const isLoading = createMutation.isPending || updateMutation.isPending

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-[560px]'>
				<DialogHeader>
					<DialogTitle>{investmentToEdit ? 'Edit investment' : 'Add investment'}</DialogTitle>
					<DialogDescription>
						{investmentToEdit
							? 'Update the details of your investment.'
							: 'Use your broker funding balance to add a new investment.'}
					</DialogDescription>
				</DialogHeader>

				{error && (
					<Alert variant='destructive'>
						<AlertCircle className='h-4 w-4' />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
						<div className='rounded-md border p-3 text-sm'>
							<p className='font-medium'>Broker balance</p>
							<p className='text-muted-foreground'>
								{settlementCurrency}: {availableBalance.toFixed(2)}
							</p>
							<p className='text-muted-foreground'>
								Required for this purchase: {requiredAmount.toFixed(2)}
							</p>
						</div>

						<FormField
							control={form.control}
							name='name'
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className='space-y-1.5'>
							<FormField
								control={form.control}
								name='symbol'
								render={({ field }) => (
									<FormItem>
										<FormLabel>Symbol</FormLabel>
										<FormControl>
											<div className='flex gap-2'>
												<Input
													{...field}
													onChange={(e) => field.onChange(e.target.value.toUpperCase())}
													placeholder='e.g. AAPL, BTC-USD'
												/>
												<Button type='button' size='icon' variant='outline' onClick={handleFetchPrice} disabled={fetchLoading || !watchedValues.symbol}>
													{fetchLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : <Search className='h-4 w-4' />}
												</Button>
											</div>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className='grid gap-3 md:grid-cols-2'>
							<FormField
								control={form.control}
								name='type'
								render={({ field }) => (
									<FormItem>
										<FormLabel>Type</FormLabel>
										<Select value={field.value} onValueChange={field.onChange}>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder='Select type' />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value={InvestmentType.STOCK}>Stock</SelectItem>
												<SelectItem value={InvestmentType.CRYPTO}>Crypto</SelectItem>
												<SelectItem value={InvestmentType.FIXED_INCOME}>Fixed income</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name='settlement_currency'
								render={({ field }) => (
									<FormItem>
										<FormLabel>Purchase currency</FormLabel>
										<FormControl>
											<Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} maxLength={10} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name='quantity'
								render={({ field }) => (
									<FormItem>
										<FormLabel>Quantity</FormLabel>
										<FormControl>
											<Input type='number' step='any' {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name='purchase_price'
								render={({ field }) => (
									<FormItem>
										<FormLabel>Purchase price</FormLabel>
										<FormControl>
											<Input type='number' step='any' {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name='current_price'
								render={({ field }) => (
									<FormItem className='md:col-span-2'>
										<FormLabel>Current price</FormLabel>
										<FormControl>
											<Input type='number' step='any' {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<DialogFooter>
							<Button type='submit' disabled={isLoading}>
								{isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
								{investmentToEdit ? 'Update' : 'Create'}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
