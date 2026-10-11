'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { FormDialog } from '@/components/shared/FormDialog'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getSafeErrorDetail } from '@/lib/api-error'
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

const DEFAULT_BALANCE: CreateBalanceDTO = { currency: 'DOP', credit_limit: 100000, initial_debt: 0 }

/** A balance row in the form; `key` keeps React state on the right row when one is removed. */
type BalanceRow = CreateBalanceDTO & { key: string }

let balanceRowCount = 0
function toRow(balance: CreateBalanceDTO): BalanceRow {
	balanceRowCount += 1
	return { ...balance, key: `balance-${balanceRowCount}` }
}

function balancesOf(card?: CreditCard | null): BalanceRow[] {
	return (
		card?.balances?.map((b) =>
			toRow({
				currency: b.currency,
				credit_limit: b.credit_limit,
				initial_debt: Math.abs(b.current_balance),
			}),
		) || [toRow(DEFAULT_BALANCE)]
	)
}

function valuesOf(card?: CreditCard | null): CreditCardFormValues {
	return {
		name: card?.name || '',
		bank: card?.bank || '',
		lastFourDigits: card?.last_four_digits || '',
		cutDay: card?.cut_day || 20,
		dueDay: card?.due_day || 10,
	}
}

export function CreditCardFormModal({ open, onClose, onSubmit, card }: CreditCardFormModalProps) {
	const t = useTranslations('creditCards.form')
	const tForms = useTranslations('forms')
	const creditCardSchema = useMemo(() => createCreditCardSchema(t), [t])
	const idPrefix = useId()
	const [loading, setLoading] = useState(false)
	const [balancesError, setBalancesError] = useState<string | null>(null)
	const [submitError, setSubmitError] = useState<{ detail: string | null } | null>(null)
	const [balances, setBalances] = useState<BalanceRow[]>(() => balancesOf(card))

	const form = useForm<CreditCardFormValues>({
		resolver: zodResolver(creditCardSchema),
		defaultValues: valuesOf(card),
	})

	// The modal stays mounted between opens: load the card being edited (or a blank form) on every open.
	useEffect(() => {
		if (!open) return
		form.reset(valuesOf(card))
		setBalances(balancesOf(card))
		setBalancesError(null)
		setSubmitError(null)
	}, [open, card, form])

	const handleFormSubmit = async (values: CreditCardFormValues) => {
		// An emptied "initial debt" field means no debt.
		const normalized: CreateBalanceDTO[] = balances.map(({ key: _key, ...b }) => ({
			...b,
			initial_debt: Number.isFinite(b.initial_debt) ? b.initial_debt : 0,
		}))
		const missingLimit = normalized.some((b) => !Number.isFinite(b.credit_limit) || b.credit_limit < 0)
		// card_balances.credit_limit / current_balance are DECIMAL(15,2): the API rejects sub-cent amounts.
		const subCent = normalized.some(
			(b) => !hasAtMostDecimals(b.credit_limit) || !hasAtMostDecimals(b.initial_debt ?? 0),
		)
		const balanceProblem = missingLimit ? t('errors.limitRequired') : subCent ? tForms('maxTwoDecimals') : null
		setBalancesError(balanceProblem)
		if (balanceProblem) return
		setLoading(true)
		setSubmitError(null)
		try {
			await onSubmit({
				name: values.name,
				bank: values.bank,
				last_four_digits: values.lastFourDigits || undefined,
				cut_day: values.cutDay,
				due_day: values.dueDay,
				balances: normalized,
			})
			onClose()
		} catch (error) {
			// Keep the dialog open with the user's input and say why it failed.
			setSubmitError({ detail: getSafeErrorDetail(error) })
		} finally {
			setLoading(false)
		}
	}

	const addBalance = () => {
		setBalances([...balances, toRow(DEFAULT_BALANCE)])
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
		<FormDialog
			open={open}
			onOpenChange={(next) => !next && onClose()}
			title={card ? t('editTitle') : t('addTitle')}
			size='sm'
			submitLabel={card ? t('update') : t('create')}
			loading={loading}
			error={
				submitError ? (
					<>
						<p>{t('errors.saveFailed')}</p>
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
											inputMode='numeric'
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
										<Input type='number' min={1} max={28} inputMode='numeric' {...field} />
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
										<Input type='number' min={1} max={28} inputMode='numeric' {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<fieldset className='space-y-2'>
						<legend className='mb-2 text-sm font-medium'>{t('balances')}</legend>
						{balances.map((balance, index) => {
							const limitId = `${idPrefix}-limit-${index}`
							const debtId = `${idPrefix}-debt-${index}`
							return (
								<div key={balance.key} className='space-y-2 rounded-md border p-3'>
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
												<Trash2 className='h-4 w-4 text-destructive' aria-hidden='true' />
											</Button>
										)}
									</div>
									<div className='grid grid-cols-2 gap-2'>
										<div className='space-y-1'>
											<Label htmlFor={limitId} className='text-xs'>
												{t('creditLimit')}
											</Label>
											<Input
												id={limitId}
												type='number'
												step='0.01'
												inputMode='decimal'
												aria-label={`${t('creditLimit')} ${balance.currency}`}
												value={Number.isFinite(balance.credit_limit) ? balance.credit_limit : ''}
												onChange={(e) => updateBalance(index, 'credit_limit', parseFloat(e.target.value))}
												required
											/>
										</div>
										<div className='space-y-1'>
											<Label htmlFor={debtId} className='text-xs'>
												{t('initialDebt')}
											</Label>
											<Input
												id={debtId}
												type='number'
												step='0.01'
												inputMode='decimal'
												aria-label={`${t('initialDebt')} ${balance.currency}`}
												value={Number.isFinite(balance.initial_debt) ? balance.initial_debt : ''}
												onChange={(e) => updateBalance(index, 'initial_debt', parseFloat(e.target.value))}
											/>
										</div>
									</div>
								</div>
							)
						})}
						<Button type='button' variant='outline' size='sm' onClick={addBalance}>
							<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
							{t('addCurrency')}
						</Button>
						{balancesError && (
							<p role='alert' className='text-sm font-medium text-destructive'>
								{balancesError}
							</p>
						)}
					</fieldset>
				</div>
			</Form>
		</FormDialog>
	)
}
