'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { hasAtMostDecimals } from '@/lib/money-validation'
import { CreateBalanceDTO, CreateCreditCardDTO, CreditCard } from '@/types/creditcard'

interface CreditCardFormModalProps {
	open: boolean
	onClose: () => void
	onSubmit: (data: CreateCreditCardDTO) => Promise<void>
	card?: CreditCard | null
}

const CURRENCIES = ['DOP', 'USD', 'EUR']

type Translator = (key: string, values?: Record<string, string | number>) => string

function createCreditCardSchema(t: Translator) {
	const day = z.coerce
		.number()
		.min(1, t('errors.dayMin', { min: 1 }))
		.max(28, t('errors.dayMax', { max: 28 }))
	return z.object({
		name: z.string().min(1, t('errors.nameRequired')),
		bank: z.string().min(1, t('errors.bankRequired')),
		lastFourDigits: z
			.string()
			.max(4)
			.regex(/^\d{0,4}$/, t('errors.digitsOnly'))
			.optional()
			.default(''),
		cutDay: day,
		dueDay: day,
	})
}

type CreditCardFormValues = z.infer<ReturnType<typeof createCreditCardSchema>>

export function CreditCardFormModal({ open, onClose, onSubmit, card }: CreditCardFormModalProps) {
	const t = useTranslations('creditCards.form')
	const tCards = useTranslations('creditCards')
	const tForms = useTranslations('forms')
	const creditCardSchema = useMemo(() => createCreditCardSchema(t), [t])
	const [loading, setLoading] = useState(false)
	const [balancesError, setBalancesError] = useState<string | null>(null)
	const [balances, setBalances] = useState<CreateBalanceDTO[]>(
		card?.balances?.map((b) => ({
			currency: b.currency,
			credit_limit: b.credit_limit,
			initial_debt: Math.abs(b.current_balance),
		})) || [{ currency: 'DOP', credit_limit: 100000, initial_debt: 0 }],
	)

	const form = useForm<CreditCardFormValues>({
		resolver: zodResolver(creditCardSchema),
		defaultValues: {
			name: card?.name || '',
			bank: card?.bank || '',
			lastFourDigits: card?.last_four_digits || '',
			cutDay: card?.cut_day || 20,
			dueDay: card?.due_day || 10,
		},
	})

	const handleFormSubmit = async (values: CreditCardFormValues) => {
		// card_balances.credit_limit / current_balance are DECIMAL(15,2): the API rejects sub-cent amounts.
		const subCent = balances.some((b) => !hasAtMostDecimals(b.credit_limit) || !hasAtMostDecimals(b.initial_debt ?? 0))
		setBalancesError(subCent ? tForms('maxTwoDecimals') : null)
		if (subCent) return
		setLoading(true)
		try {
			await onSubmit({
				name: values.name,
				bank: values.bank,
				last_four_digits: values.lastFourDigits || undefined,
				cut_day: values.cutDay,
				due_day: values.dueDay,
				balances,
			})
			onClose()
		} catch (error) {
			console.error('Error saving card:', error)
		} finally {
			setLoading(false)
		}
	}

	const addBalance = () => {
		setBalances([...balances, { currency: 'DOP', credit_limit: 100000, initial_debt: 0 }])
	}

	const removeBalance = (index: number) => {
		setBalances(balances.filter((_, i) => i !== index))
	}

	const updateBalance = (index: number, field: keyof CreateBalanceDTO, value: string | number) => {
		const newBalances = [...balances]
		newBalances[index] = { ...newBalances[index], [field]: value }
		setBalances(newBalances)
	}

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className='max-h-[90vh] w-[95vw] max-w-md overflow-y-auto'>
				<DialogHeader>
					<DialogTitle>{card ? t('editTitle') : t('addTitle')}</DialogTitle>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(handleFormSubmit)} className='space-y-4'>
						<FormField
							control={form.control}
							name='name'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('cardName')}</FormLabel>
									<FormControl>
										<Input {...field} placeholder={t('cardNamePlaceholder')} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
							<FormField
								control={form.control}
								name='bank'
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('bank')}</FormLabel>
										<FormControl>
											<Input {...field} placeholder={t('bankPlaceholder')} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name='lastFourDigits'
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('lastFourDigits')}</FormLabel>
										<FormControl>
											<Input
												{...field}
												onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
												placeholder='1234'
												maxLength={4}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
							<FormField
								control={form.control}
								name='cutDay'
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('cutDay')}</FormLabel>
										<FormControl>
											<Input type='number' min={1} max={28} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name='dueDay'
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('dueDay')}</FormLabel>
										<FormControl>
											<Input type='number' min={1} max={28} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className='space-y-2'>
							<div className='flex items-center justify-between'>
								<Label>{t('balances')}</Label>
								<Button type='button' variant='outline' size='sm' onClick={addBalance}>
									<Plus className='h-4 w-4 mr-1' />
									{t('addCurrency')}
								</Button>
							</div>
							{balances.map((balance, index) => (
								<div key={index} className='p-3 border rounded-lg space-y-2'>
									<div className='flex items-center justify-between'>
										<Select value={balance.currency} onValueChange={(v) => updateBalance(index, 'currency', v)}>
											<SelectTrigger className='w-24' aria-label={t('currency')}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{CURRENCIES.map((c) => (
													<SelectItem key={c} value={c}>
														{c}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{balances.length > 1 && (
											<Button
												type='button'
												variant='ghost'
												size='icon'
												aria-label={t('removeCurrency')}
												onClick={() => removeBalance(index)}
											>
												<Trash2 className='h-4 w-4 text-destructive' />
											</Button>
										)}
									</div>
									<div className='grid grid-cols-2 gap-2'>
										<div>
											<Label className='text-xs'>{t('creditLimit')}</Label>
											<Input
												type='number'
												step='0.01'
												aria-label={`${t('creditLimit')} ${balance.currency}`}
												value={balance.credit_limit}
												onChange={(e) => updateBalance(index, 'credit_limit', parseFloat(e.target.value))}
												required
											/>
										</div>
										<div>
											<Label className='text-xs'>{t('initialDebt')}</Label>
											<Input
												type='number'
												step='0.01'
												aria-label={`${t('initialDebt')} ${balance.currency}`}
												value={balance.initial_debt}
												onChange={(e) => updateBalance(index, 'initial_debt', parseFloat(e.target.value))}
											/>
										</div>
									</div>
								</div>
							))}
							{balancesError && (
								<p role='alert' className='text-sm font-medium text-destructive'>
									{balancesError}
								</p>
							)}
						</div>

						<DialogFooter>
							<Button type='button' variant='outline' onClick={onClose}>
								{tCards('cancel')}
							</Button>
							<Button type='submit' disabled={loading}>
								{loading ? t('saving') : card ? t('update') : t('create')}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
