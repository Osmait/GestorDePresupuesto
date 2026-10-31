'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Amount } from '@/components/shared/Amount'
import { FormDialog } from '@/components/shared/FormDialog'
import { MoneyInput } from '@/components/shared/MoneyInput'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getSafeErrorDetail } from '@/lib/api-error'
import { type MoneyParseResult, parseMoneyInput, toMoneyInputText } from '@/lib/money-input'
import {
	CreateBalanceDTO,
	CreateCreditCardDTO,
	CreditCard,
	CreditLimitChange,
	UpdateCreditCardInput,
} from '@/types/creditcard'

interface CreditCardFormModalProps {
	open: boolean
	onClose: () => void
	/** Creates a card (no `card` given). */
	onSubmit: (data: CreateCreditCardDTO) => Promise<void>
	/**
	 * Saves an edited card: the card fields and the credit limits that changed. Balances
	 * cannot be added or removed here, and the debt only changes by reconciling the card.
	 */
	onUpdate?: (data: UpdateCreditCardInput) => Promise<void>
	card?: CreditCard | null
}

const CURRENCIES = ['DOP', 'USD', 'EUR']

type Translator = (key: string, values?: Record<string, string | number>) => string

/** Mirrors the API's CreateCreditCardRequest binding so mistakes are field errors, not a failed save. */
function createCreditCardSchema(t: Translator) {
	const day = z.coerce
		.number<number>()
		.int(t('errors.dayMin', { min: 1 }))
		.min(1, t('errors.dayMin', { min: 1 }))
		.max(28, t('errors.dayMax', { max: 28 }))
	// name and bank: required,min=2,max=100.
	const text = (required: string) =>
		z
			.string()
			.trim()
			.min(1, required)
			.min(2, t('errors.textLength', { min: 2, max: 100 }))
			.max(100, t('errors.textLength', { min: 2, max: 100 }))
	return z.object({
		name: text(t('errors.nameRequired')),
		bank: text(t('errors.bankRequired')),
		// last_four_digits: omitempty,len=4.
		lastFourDigits: z
			.string()
			.regex(/^(\d{4})?$/, t('errors.lastFourDigits'))
			.optional()
			.default(''),
		cutDay: day,
		dueDay: day,
	})
}

type CreditCardFormValues = z.infer<ReturnType<typeof createCreditCardSchema>>

type CreditCardFormInput = z.input<ReturnType<typeof createCreditCardSchema>>

/**
 * A balance row in the form. Amounts are the typed text (decimal comma or point), parsed on
 * submit. `key` keeps React state on the right row when one is removed; `id` is the saved
 * balance when editing.
 */
type BalanceRow = {
	key: string
	id?: string
	currency: string
	creditLimit: string
	initialDebt: string
	/** Current debt of a saved balance (shown read-only when editing). */
	currentDebt?: number
}

let balanceRowCount = 0
function toRow(row: Omit<BalanceRow, 'key'>): BalanceRow {
	balanceRowCount += 1
	return { ...row, key: `balance-${balanceRowCount}` }
}

function defaultRow(): BalanceRow {
	return toRow({ currency: 'DOP', creditLimit: '100000', initialDebt: '0' })
}

function balancesOf(card?: CreditCard | null): BalanceRow[] {
	if (!card?.balances?.length) return [defaultRow()]
	return card.balances.map((b) =>
		toRow({
			id: b.id,
			currency: b.currency,
			creditLimit: toMoneyInputText(b.credit_limit),
			initialDebt: '',
			// The balance is negative while the card owes money.
			currentDebt: Math.max(0, -b.current_balance),
		}),
	)
}

type ParsedBalance = CreateBalanceDTO & { id?: string }

/** An emptied "initial debt" field means no debt. */
function parseDebt(text: string): MoneyParseResult {
	return text.trim() ? parseMoneyInput(text) : { ok: true, value: 0 }
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

export function CreditCardFormModal({ open, onClose, onSubmit, onUpdate, card }: CreditCardFormModalProps) {
	const t = useTranslations('creditCards.form')
	const tForms = useTranslations('forms')
	const creditCardSchema = useMemo(() => createCreditCardSchema(t), [t])
	const idPrefix = useId()
	const [loading, setLoading] = useState(false)
	const [balancesError, setBalancesError] = useState<string | null>(null)
	const [submitError, setSubmitError] = useState<{ detail: string | null } | null>(null)
	const [balances, setBalances] = useState<BalanceRow[]>(() => balancesOf(card))

	const form = useForm<CreditCardFormInput, unknown, CreditCardFormValues>({
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

	const isEditing = Boolean(card)

	/** Parses the rows; sets the inline error and returns null when one is not valid. */
	function parseBalances(): ParsedBalance[] | null {
		let problem: string | null = null
		const parsed: ParsedBalance[] = []
		for (const b of balances) {
			const limit = parseMoneyInput(b.creditLimit)
			// The debt of a saved card is not edited here: it changes by reconciling the card.
			const debt = isEditing ? null : parseDebt(b.initialDebt)
			// card_balances.credit_limit / current_balance are DECIMAL(15,2): the API rejects sub-cent amounts.
			if ((!limit.ok && limit.error === 'decimals') || (debt && !debt.ok && debt.error === 'decimals')) {
				problem ??= tForms('maxTwoDecimals')
			} else if (!limit.ok || limit.value <= 0) {
				problem ??= t('errors.limitRequired')
			} else if (debt && (!debt.ok || debt.value < 0)) {
				problem ??= tForms('invalidAmount')
			} else {
				parsed.push({
					id: b.id,
					currency: b.currency,
					credit_limit: limit.value,
					initial_debt: debt?.ok ? debt.value : 0,
				})
			}
		}
		setBalancesError(problem)
		return problem ? null : parsed
	}

	const handleFormSubmit = async (values: CreditCardFormValues) => {
		const parsed = parseBalances()
		if (!parsed) return
		setLoading(true)
		setSubmitError(null)
		try {
			const fields = {
				name: values.name,
				bank: values.bank,
				last_four_digits: values.lastFourDigits || undefined,
				cut_day: values.cutDay,
				due_day: values.dueDay,
			}
			if (card) {
				// PUT /credit-cards/:id ignores balances: send only the limits that changed.
				const creditLimits: CreditLimitChange[] = parsed.flatMap((b) => {
					const saved = card.balances.find((s) => s.id === b.id)
					return saved && saved.credit_limit !== b.credit_limit
						? [{ balanceId: saved.id, credit_limit: b.credit_limit }]
						: []
				})
				await onUpdate?.({ card: fields, creditLimits })
			} else {
				await onSubmit({ ...fields, balances: parsed.map(({ id: _id, ...b }) => b) })
			}
			onClose()
		} catch (error) {
			// Keep the dialog open with the user's input and say why it failed.
			setSubmitError({ detail: getSafeErrorDetail(error) })
		} finally {
			setLoading(false)
		}
	}

	const addBalance = () => {
		setBalances([...balances, defaultRow()])
	}

	const removeBalance = (index: number) => {
		setBalances(balances.filter((_, i) => i !== index))
	}

	const updateBalance = (index: number, field: 'currency' | 'creditLimit' | 'initialDebt', value: string) => {
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
										{isEditing ? (
											// A saved balance keeps its currency; balances are added/removed only on create.
											<span className='text-sm font-medium'>{balance.currency}</span>
										) : (
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
										)}
										{!isEditing && balances.length > 1 && (
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
											<MoneyInput
												id={limitId}
												aria-label={`${t('creditLimit')} ${balance.currency}`}
												value={balance.creditLimit}
												onChange={(e) => updateBalance(index, 'creditLimit', e.target.value)}
												required
											/>
										</div>
										{isEditing ? (
											<div className='space-y-1'>
												<p className='text-xs font-medium'>{t('currentDebt')}</p>
												<p className='flex h-10 items-center text-sm font-semibold'>
													<Amount value={balance.currentDebt ?? 0} currency={balance.currency} />
												</p>
											</div>
										) : (
											<div className='space-y-1'>
												<Label htmlFor={debtId} className='text-xs'>
													{t('initialDebt')}
												</Label>
												<MoneyInput
													id={debtId}
													aria-label={`${t('initialDebt')} ${balance.currency}`}
													value={balance.initialDebt}
													onChange={(e) => updateBalance(index, 'initialDebt', e.target.value)}
												/>
											</div>
										)}
									</div>
									{isEditing ? <p className='text-xs text-muted-foreground'>{t('debtReadOnlyHint')}</p> : null}
								</div>
							)
						})}
						{isEditing ? null : (
							<Button type='button' variant='outline' size='sm' onClick={addBalance}>
								<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
								{t('addCurrency')}
							</Button>
						)}
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
