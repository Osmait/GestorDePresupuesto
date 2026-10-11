'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { FormDialog } from '@/components/shared/FormDialog'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
	useCreateInvestmentMutation,
	useGetInvestmentFundingBalances,
	useUpdateInvestmentMutation,
} from '@/hooks/queries/useInvestmentsQuery'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { getSafeErrorDetail } from '@/lib/api-error'
import { getInvestmentRepository } from '@/lib/repositoryConfig'
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
		type: z.enum(InvestmentType),
		quantity: z.coerce.number<number>().min(0, t('errors.minZero')),
		purchase_price: z.coerce.number<number>().min(0, t('errors.minZero')),
		current_price: z.coerce.number<number>().min(0, t('errors.minZero')),
		settlement_currency: z
			.string()
			.min(1, t('errors.currencyRequired'))
			.transform((v) => v.toUpperCase()),
	})
}

type InvestmentFormValues = z.infer<ReturnType<typeof createInvestmentSchema>>

type InvestmentFormInput = z.input<ReturnType<typeof createInvestmentSchema>>

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
	const formatCurrency = useFormatCurrency()
	const investmentSchema = useMemo(() => createInvestmentSchema(t), [t])
	const [error, setError] = useState<string | null>(null)
	const [fetchLoading, setFetchLoading] = useState(false)
	const createMutation = useCreateInvestmentMutation()
	const updateMutation = useUpdateInvestmentMutation()
	const { data: balances = [] } = useGetInvestmentFundingBalances()

	const form = useForm<InvestmentFormInput, unknown, InvestmentFormValues>({
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

	// Free-text currency field: only format as money once it looks like an ISO 4217 code
	// (formatCurrency would otherwise fall back to DOP while the user is still typing).
	const isIsoCode = /^[A-Z]{3}$/.test(settlementCurrency)
	const formatSettlement = (amount: number) => (isIsoCode ? formatCurrency(amount, settlementCurrency) : '—')

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
					required: formatSettlement(requiredAmount),
					available: formatSettlement(availableBalance),
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
			setError(getSafeErrorDetail(submitError) ?? t('errors.saveFailed'))
		}
	}

	const isLoading = createMutation.isPending || updateMutation.isPending

	return (
		<FormDialog
			open={isOpen}
			onOpenChange={(open) => !open && onClose()}
			title={investmentToEdit ? t('editTitle') : t('addTitle')}
			description={investmentToEdit ? t('editDescription') : t('addDescription')}
			submitLabel={investmentToEdit ? t('update') : t('create')}
			loading={isLoading}
			error={error}
			onSubmit={form.handleSubmit(onSubmit)}
		>
			<Form {...form}>
				<div className='space-y-4'>
					<div className='rounded-md bg-muted/50 p-3 text-sm'>
						<p className='font-medium'>{t('brokerBalance')}</p>
						<p className='text-muted-foreground tabular-nums'>
							{settlementCurrency}: {formatSettlement(availableBalance)}
						</p>
						<p className='text-muted-foreground tabular-nums'>
							{t('requiredForPurchase', { amount: formatSettlement(requiredAmount) })}
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

					<FormField
						control={form.control}
						name='symbol'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('symbol')}</FormLabel>
								<div className='flex gap-2'>
									<FormControl>
										<Input
											{...field}
											onChange={(e) => field.onChange(e.target.value.toUpperCase())}
											placeholder={t('symbolPlaceholder')}
										/>
									</FormControl>
									<Button
										type='button'
										size='icon'
										variant='outline'
										className='shrink-0'
										aria-label={t('fetchPrice')}
										title={t('fetchPrice')}
										onClick={handleFetchPrice}
										disabled={fetchLoading || !watchedValues.symbol}
									>
										{fetchLoading ? (
											<Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
										) : (
											<Search className='h-4 w-4' aria-hidden='true' />
										)}
									</Button>
								</div>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
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
										<Input type='number' step='any' inputMode='decimal' {...field} />
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
										<Input type='number' step='any' inputMode='decimal' {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name='current_price'
							render={({ field }) => (
								<FormItem className='sm:col-span-2'>
									<FormLabel>{t('currentPrice')}</FormLabel>
									<FormControl>
										<Input type='number' step='any' inputMode='decimal' {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</div>
			</Form>
		</FormDialog>
	)
}
