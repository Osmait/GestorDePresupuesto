'use client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'
import { Amount } from '@/components/shared/Amount'
import { FormDialog } from '@/components/shared/FormDialog'
import { MoneyInput } from '@/components/shared/MoneyInput'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useReconcileAccountMutation } from '@/hooks/queries/useAccountsQuery'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { moneyInputToNumber, moneyMessages, moneySchema } from '@/lib/money-input'
import { DEFAULT_CURRENCY } from '@/lib/utils'
import { Account } from '@/types/account'

type ReconcileAccountModalProps = {
	open: boolean
	setOpen: (_v: boolean) => void
	account: Account | null
}

/** Below this the app and bank balances count as equal (no adjustment). */
const MATCH_EPSILON = 1e-6

/**
 * "Reconcile balance": the user types the balance the bank shows now; the
 * backend writes one adjustment for the difference (neutral in reports).
 */
export function ReconcileAccountModal({ open, setOpen, account }: ReconcileAccountModalProps) {
	const t = useTranslations('accounts')
	const tForms = useTranslations('forms')
	const formatCurrency = useFormatCurrency()
	const reconcile = useReconcileAccountMutation()
	const [submitError, setSubmitError] = useState<string | null>(null)

	const currency = account?.currency || DEFAULT_CURRENCY
	const appBalance = account?.current_balance ?? account?.initial_balance ?? 0

	const schema = useMemo(
		() =>
			z.object({
				// A negative bank balance (overdraft) is valid.
				bank_balance: moneySchema(moneyMessages(tForms, { required: t('reconcileBalanceRequired') })),
				notes: z.string().trim().max(500),
			}),
		[t, tForms],
	)
	type ReconcileFormValues = z.infer<typeof schema>
	type ReconcileFormInput = z.input<typeof schema>

	const form = useForm<ReconcileFormInput, unknown, ReconcileFormValues>({
		resolver: zodResolver(schema),
		defaultValues: { bank_balance: '', notes: '' },
	})

	// A fresh form every time the dialog opens (on whichever account).
	useEffect(() => {
		if (open) form.reset({ bank_balance: '', notes: '' })
	}, [open, form])

	const typed = useWatch({ control: form.control, name: 'bank_balance' })
	const typedNumber = moneyInputToNumber(typed)
	const difference = Number.isFinite(typedNumber) ? typedNumber - appBalance : null
	const matches = difference !== null && Math.abs(difference) < MATCH_EPSILON

	function handleOpenChange(next: boolean) {
		if (!next) setSubmitError(null)
		setOpen(next)
	}

	async function onSubmit(values: ReconcileFormValues) {
		if (!account?.id) return
		setSubmitError(null)
		try {
			const result = await reconcile.mutateAsync({
				id: account.id,
				bank_balance: values.bank_balance,
				currency,
				notes: values.notes || undefined,
			})
			toast.success(
				result.adjusted
					? t('reconcileSuccessAdjusted', {
							amount: formatCurrency(result.difference, currency, { signDisplay: 'exceptZero' }),
						})
					: t('reconcileSuccessMatched'),
			)
			setOpen(false)
		} catch {
			setSubmitError(t('reconcileError'))
		}
	}

	return (
		<FormDialog
			open={open}
			onOpenChange={handleOpenChange}
			title={t('reconcileTitle', { name: account?.name ?? '' })}
			description={t('reconcileDescription')}
			submitLabel={t('reconcileSubmit')}
			loading={reconcile.isPending || form.formState.isSubmitting}
			error={submitError}
			onSubmit={form.handleSubmit(onSubmit)}
		>
			<Form {...form}>
				<div className='space-y-4'>
					<div className='flex items-baseline justify-between gap-2 rounded-md bg-muted/50 px-3 py-2'>
						<span className='text-sm text-muted-foreground'>{t('reconcileAppBalance')}</span>
						<Amount value={appBalance} currency={currency} className='font-semibold' />
					</div>
					<FormField
						control={form.control}
						name='bank_balance'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('reconcileBankBalance')}</FormLabel>
								<FormControl>
									<MoneyInput {...field} />
								</FormControl>
								<FormDescription>{t('reconcileBankBalanceHint')}</FormDescription>
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
									<Input {...field} placeholder={t('reconcileNotesPlaceholder')} autoComplete='off' maxLength={500} />
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
