'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { FormDialog } from '@/components/shared/FormDialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { getSafeErrorDetail } from '@/lib/api-error'
import { hasAtMostDecimals } from '@/lib/money-validation'
import type { Account } from '@/types/account'
import type { Loan, RegisterLoanPaymentDTO } from '@/types/loan'

type Translate = (key: string, values?: Record<string, string | number>) => string

function createPaymentSchema(
	t: Translate,
	tForms: Translate,
	formatAmount: (value: number) => string,
	pending: number,
) {
	return z.object({
		destination_account_id: z.string().min(1, t('errors.destinationAccountRequired')),
		amount: z.coerce
			.number<number>({ error: t('invalidPaymentAmountDetailed') })
			.positive(t('invalidPaymentAmountDetailed'))
			// loan_payments.amount is DECIMAL(15,2): the API rejects sub-cent amounts.
			.refine((value) => hasAtMostDecimals(value), tForms('maxTwoDecimals'))
			.superRefine((value, ctx) => {
				if (value > pending) {
					ctx.addIssue({
						code: 'custom',
						message: t('paymentExceedsPendingDetailed', {
							entered: formatAmount(value),
							pending: formatAmount(pending),
						}),
					})
				}
			}),
		payment_date: z.string().min(1, t('errors.paymentDateRequired')),
		notes: z.string().optional().default(''),
	})
}

type LoanPaymentValues = z.infer<ReturnType<typeof createPaymentSchema>>

type LoanPaymentInput = z.input<ReturnType<typeof createPaymentSchema>>

function emptyValues(destinationAccountId = ''): LoanPaymentValues {
	return {
		destination_account_id: destinationAccountId,
		amount: '' as unknown as number,
		payment_date: format(new Date(), 'yyyy-MM-dd'),
		notes: '',
	}
}

interface LoanPaymentDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	/** Loan being paid (the borrower is shown as the description). */
	loan: Loan | null
	/** Cash accounts that can receive the payment. */
	accounts: Account[]
	/** Registers the payment. Throw to keep the dialog open with the reason shown inline. */
	onSubmit: (data: RegisterLoanPaymentDTO) => Promise<void>
}

/** "Register payment" form for an active loan. */
export function LoanPaymentDialog({ open, onOpenChange, loan, accounts, onSubmit }: LoanPaymentDialogProps) {
	const t = useTranslations('loans')
	const tForms = useTranslations('forms')
	const formatCurrency = useFormatCurrency()
	const currency = loan?.currency || 'DOP'
	const pending = Number(loan?.pending_amount || 0)
	const schema = useMemo(
		() => createPaymentSchema(t, tForms, (value) => formatCurrency(value, currency), pending),
		[t, tForms, formatCurrency, currency, pending],
	)
	const [submitting, setSubmitting] = useState(false)
	const [submitError, setSubmitError] = useState<string | null>(null)
	const defaultAccountId = accounts[0]?.id ?? ''

	const form = useForm<LoanPaymentInput, unknown, LoanPaymentValues>({
		resolver: zodResolver(schema),
		defaultValues: emptyValues(defaultAccountId),
	})

	// Start every open from a clean form (today's date, first account).
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the dialog opens, not when accounts refetch.
	useEffect(() => {
		if (!open) return
		form.reset(emptyValues(defaultAccountId))
		setSubmitError(null)
	}, [open, form])

	useEffect(() => {
		if (open && defaultAccountId && !form.getValues('destination_account_id')) {
			form.setValue('destination_account_id', defaultAccountId)
		}
	}, [open, defaultAccountId, form])

	async function handleValid(values: LoanPaymentValues) {
		setSubmitError(null)
		setSubmitting(true)
		try {
			await onSubmit({
				destination_account_id: values.destination_account_id,
				amount: values.amount,
				payment_date: values.payment_date,
				notes: values.notes,
			})
		} catch (error) {
			setSubmitError(getSafeErrorDetail(error) ?? t('paymentError'))
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<FormDialog
			open={open}
			onOpenChange={onOpenChange}
			title={t('registerPayment')}
			description={loan?.borrower_name}
			submitLabel={t('confirmPayment')}
			loading={submitting}
			error={submitError}
			onSubmit={form.handleSubmit(handleValid)}
		>
			<Form {...form}>
				<div className='space-y-4'>
					<FormField
						control={form.control}
						name='destination_account_id'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('destinationAccount')}</FormLabel>
								<Select value={field.value} onValueChange={field.onChange}>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder={t('selectAccount')} />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{accounts.map((account) => (
											<SelectItem key={account.id} value={account.id}>
												{account.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>
					<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
						<FormField
							control={form.control}
							name='amount'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('amount')}</FormLabel>
									<FormControl>
										<Input type='number' min={0.01} step='0.01' inputMode='decimal' {...field} />
									</FormControl>
									<FormDescription className='tabular-nums'>
										{t('pendingAmountLabel', { amount: formatCurrency(pending, currency) })}
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name='payment_date'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('paymentDate')}</FormLabel>
									<FormControl>
										<Input type='date' {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
					<FormField
						control={form.control}
						name='notes'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('notes')}</FormLabel>
								<FormControl>
									<Input {...field} />
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
