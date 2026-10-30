'use client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'
import { Amount } from '@/components/shared/Amount'
import { FormDialog } from '@/components/shared/FormDialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useReconcileAccountMutation } from '@/hooks/queries/useAccountsQuery'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { hasAtMostDecimals } from '@/lib/money-validation'
import { CreditCard } from '@/types/creditcard'

type ReconcileCardModalProps = {
	open: boolean
	setOpen: (_v: boolean) => void
	card: CreditCard | null
}

/** Below this the app and bank debts count as equal (no adjustment). */
const MATCH_EPSILON = 1e-6

/**
 * "Reconcile with statement": the user types the debt the bank shows (a
 * positive number); the card account is reconciled to minus that debt, so one
 * adjustment covers whatever was never recorded.
 */
export function ReconcileCardModal({ open, setOpen, card }: ReconcileCardModalProps) {
	const t = useTranslations('creditCards.item')
	const formatCurrency = useFormatCurrency()
	const reconcile = useReconcileAccountMutation()
	const [submitError, setSubmitError] = useState<string | null>(null)
	const balances = card?.balances ?? []

	const schema = useMemo(
		() =>
			z.object({
				currency: z.string().min(1),
				bank_debt: z
					.string()
					.trim()
					.min(1, t('reconcileDebtRequired'))
					.refine((v) => Number.isFinite(Number(v)), t('reconcileDebtRequired'))
					.refine((v) => hasAtMostDecimals(v), t('reconcileDebtRequired')),
				notes: z.string().trim().max(500),
			}),
		[t],
	)
	type ReconcileCardValues = z.infer<typeof schema>

	const form = useForm<ReconcileCardValues>({
		resolver: zodResolver(schema),
		defaultValues: { currency: '', bank_debt: '', notes: '' },
	})

	const firstCurrency = balances[0]?.currency ?? 'DOP'
	// A fresh form every time the dialog opens, on the card's first currency.
	useEffect(() => {
		if (open) form.reset({ currency: firstCurrency, bank_debt: '', notes: '' })
	}, [open, firstCurrency, form])

	const currency = useWatch({ control: form.control, name: 'currency' }) || firstCurrency
	const typed = useWatch({ control: form.control, name: 'bank_debt' })
	const balance = balances.find((b) => b.currency === currency)
	// The card balance is negative while it owes money.
	const appDebt = -(balance?.current_balance ?? 0)
	const typedNumber = typed?.trim() ? Number(typed) : Number.NaN
	// Change of the card balance: more debt is a negative adjustment.
	const difference = Number.isFinite(typedNumber) ? appDebt - typedNumber : null
	const matches = difference !== null && Math.abs(difference) < MATCH_EPSILON

	function handleOpenChange(next: boolean) {
		if (!next) setSubmitError(null)
		setOpen(next)
	}

	async function onSubmit(values: ReconcileCardValues) {
		if (!card?.id) return
		setSubmitError(null)
		const debt = Number(values.bank_debt)
		try {
			await reconcile.mutateAsync({
				id: card.id,
				bank_balance: -debt,
				currency: values.currency,
				notes: values.notes || undefined,
			})
			toast.success(t('reconcileSuccess', { amount: formatCurrency(debt, values.currency) }))
			setOpen(false)
		} catch {
			setSubmitError(t('reconcileError'))
		}
	}

	return (
		<FormDialog
			open={open}
			onOpenChange={handleOpenChange}
			title={t('reconcileTitle', { name: card?.name ?? '' })}
			description={t('reconcileDescription')}
			submitLabel={t('reconcileSubmit')}
			loading={reconcile.isPending || form.formState.isSubmitting}
			error={submitError}
			onSubmit={form.handleSubmit(onSubmit)}
		>
			<Form {...form}>
				<div className='space-y-4'>
					{balances.length > 1 ? (
						<FormField
							control={form.control}
							name='currency'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('reconcileCurrency')}</FormLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<FormControl>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{balances.map((b) => (
												<SelectItem key={b.id} value={b.currency}>
													{b.currency}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</FormItem>
							)}
						/>
					) : null}
					<div className='flex items-baseline justify-between gap-2 rounded-md bg-muted/50 px-3 py-2'>
						<span className='text-sm text-muted-foreground'>{t('reconcileAppDebt')}</span>
						<Amount value={appDebt} currency={currency} className='font-semibold' />
					</div>
					<FormField
						control={form.control}
						name='bank_debt'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('reconcileBankDebt')}</FormLabel>
								<FormControl>
									<Input {...field} type='number' inputMode='decimal' step='0.01' autoComplete='off' />
								</FormControl>
								<FormDescription>{t('reconcileBankDebtHint')}</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
					{difference !== null ? (
						<div className='flex items-baseline justify-between gap-2 text-sm' aria-live='polite'>
							<span className='text-muted-foreground'>{t('reconcileDifference')}</span>
							{matches ? (
								<span className='font-medium text-success'>{t('reconcileMatches')}</span>
							) : (
								<Amount value={difference} currency={currency} tone='auto' signed className='font-semibold' />
							)}
						</div>
					) : null}
					<FormField
						control={form.control}
						name='notes'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('reconcileNotes')}</FormLabel>
								<FormControl>
									<Input {...field} autoComplete='off' maxLength={500} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
			</Form>
		</FormDialog>
	)
}
