import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
import {
	useCreateInvestmentMutation,
	useGetInvestmentFundingBalances,
	useUpdateInvestmentMutation,
} from '@/hooks/queries/useInvestmentsQuery'
import { useAppLocale } from '@/lib/i18n/date-locale'
import { getInvestmentRepository } from '@/lib/repositoryConfig'
import { formatCurrency } from '@/lib/utils'
import { Investment, InvestmentType } from '@/types/investment'

interface InvestmentFormModalProps {
	isOpen: boolean
	onClose: () => void
	investmentToEdit?: Investment | null
}

type FormTranslator = (key: string) => string

function createInvestmentSchema(t: FormTranslator) {
	return z.object({
		name: z.string().min(1, t('errors.nameRequired')),
		symbol: z
			.string()
			.min(1, t('errors.symbolRequired'))
			.transform((v) => v.toUpperCase()),
		type: z.nativeEnum(InvestmentType),
		quantity: z.coerce.number().min(0, t('errors.minZero')),
		purchase_price: z.coerce.number().min(0, t('errors.minZero')),
		current_price: z.coerce.number().min(0, t('errors.minZero')),
		settlement_currency: z
			.string()
			.min(1, t('errors.currencyRequired'))
			.transform((v) => v.toUpperCase()),
	})
}

type InvestmentFormValues = z.infer<ReturnType<typeof createInvestmentSchema>>

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
	const t = useTranslations('investments.form')
	const tTypes = useTranslations('investments.typeSingular')
	const locale = useAppLocale()
	const investmentSchema = useMemo(() => createInvestmentSchema(t), [t])
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
	}, [investmentToEdit, form])

	const watchedValues = form.watch()
	const settlementCurrency = (watchedValues.settlement_currency || 'USD').toUpperCase()
	const requiredAmount = Math.max(watchedValues.quantity, 0) * Math.max(watchedValues.purchase_price, 0)
	const availableBalance = useMemo(() => {
		const match = balances.find((balance) => balance.currency === settlementCurrency)
		return match?.available || 0
	}, [balances, settlementCurrency])

	// Free-text currency field: only format as money once it looks like an ISO 4217 code.
	const formatMoney = (amount: number) =>
		/^[A-Z]{3}$/.test(settlementCurrency)
			? formatCurrency(amount, settlementCurrency, { locale })
			: `${amount.toFixed(2)} ${settlementCurrency}`

	const handleFetchPrice = async () => {
		const symbol = form.getValues('symbol')
		if (!symbol) return
		setFetchLoading(true)
		try {
			const quote = await getInvestmentRepository().getQuote(symbol)
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
			setError(t('errors.quoteNotFound'))
		} catch {
			setError(t('errors.quoteFailed'))
		} finally {
			setFetchLoading(false)
		}
	}

	const onSubmit = async (values: InvestmentFormValues) => {
		setError(null)

		if (!investmentToEdit && requiredAmount > availableBalance) {
			setError(
				t('errors.insufficientBalance', {
					currency: settlementCurrency,
					required: formatMoney(requiredAmount),
					available: formatMoney(availableBalance),
				}),
			)
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
			const errorMessage = submitError instanceof Error ? submitError.message : t('errors.saveFailed')
			setError(errorMessage)
		}
	}

	const isLoading = createMutation.isPending || updateMutation.isPending

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-[560px]'>
				<DialogHeader>
					<DialogTitle>{investmentToEdit ? t('editTitle') : t('addTitle')}</DialogTitle>
					<DialogDescription>{investmentToEdit ? t('editDescription') : t('addDescription')}</DialogDescription>
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
							<p className='font-medium'>{t('brokerBalance')}</p>
							<p className='text-muted-foreground'>
								{settlementCurrency}: {formatMoney(availableBalance)}
							</p>
							<p className='text-muted-foreground'>
								{t('requiredForPurchase', { amount: formatMoney(requiredAmount) })}
							</p>
						</div>

						<FormField
							control={form.control}
							name='name'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('name')}</FormLabel>
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
										<FormLabel>{t('symbol')}</FormLabel>
										<FormControl>
											<div className='flex gap-2'>
												<Input
													{...field}
													onChange={(e) => field.onChange(e.target.value.toUpperCase())}
													placeholder={t('symbolPlaceholder')}
												/>
												<Button
													type='button'
													size='icon'
													variant='outline'
													aria-label={t('fetchPrice')}
													title={t('fetchPrice')}
													onClick={handleFetchPrice}
													disabled={fetchLoading || !watchedValues.symbol}
												>
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
										<FormLabel>{t('type')}</FormLabel>
										<Select value={field.value} onValueChange={field.onChange}>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder={t('selectType')} />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value={InvestmentType.STOCK}>{tTypes('stock')}</SelectItem>
												<SelectItem value={InvestmentType.CRYPTO}>{tTypes('crypto')}</SelectItem>
												<SelectItem value={InvestmentType.FIXED_INCOME}>{tTypes('fixed_income')}</SelectItem>
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
										<FormLabel>{t('purchaseCurrency')}</FormLabel>
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
										<FormLabel>{t('quantity')}</FormLabel>
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
										<FormLabel>{t('purchasePrice')}</FormLabel>
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
										<FormLabel>{t('currentPrice')}</FormLabel>
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
								{investmentToEdit ? t('update') : t('create')}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
