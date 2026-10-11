'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { FormDialog } from '@/components/shared/FormDialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { getInsufficientFundsMessage, getSafeErrorDetail } from '@/lib/api-error'
import { useAppLocale } from '@/lib/i18n/date-locale'
import { hasAtMostDecimals } from '@/lib/money-validation'
import type { Account } from '@/types/account'
import type { CreateLoanDTO } from '@/types/loan'

type Translate = (key: string, values?: Record<string, string | number>) => string

function createLoanSchema(t: Translate, tForms: Translate) {
	return z.object({
		borrower_name: z.string().trim().min(1, t('errors.borrowerRequired')),
		borrower_contact: z.string().optional().default(''),
		// loans.principal_amount is DECIMAL(15,2): the API rejects sub-cent amounts.
		principal_amount: z.coerce
			.number<number>({ error: t('errors.principalPositive') })
			.positive(t('errors.principalPositive'))
			.refine((value) => hasAtMostDecimals(value), tForms('maxTwoDecimals')),
		annual_rate: z.coerce.number<number>({ error: t('errors.rateMin') }).min(0, t('errors.rateMin')),
		term_months: z.coerce
			.number<number>({ error: t('errors.termRange') })
			.int(t('errors.termRange'))
			.min(1, t('errors.termRange'))
			.max(120, t('errors.termRange')),
		start_date: z.string().min(1, t('errors.startDateRequired')),
		source_account_id: z.string().min(1, t('errors.sourceAccountRequired')),
		notes: z.string().optional().default(''),
	})
}

type LoanFormValues = z.infer<ReturnType<typeof createLoanSchema>>

type LoanFormInput = z.input<ReturnType<typeof createLoanSchema>>

function emptyValues(sourceAccountId = ''): LoanFormValues {
	return {
		borrower_name: '',
		borrower_contact: '',
		principal_amount: 0,
		annual_rate: 0,
		term_months: 12,
		start_date: format(new Date(), 'yyyy-MM-dd'),
		source_account_id: sourceAccountId,
		notes: '',
	}
}

interface LoanFormDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	/** Cash accounts the loan can be disbursed from (no credit cards). */
	accounts: Account[]
	/**
	 * Creates the loan. Throw to keep the dialog open: an INSUFFICIENT_FUNDS
	 * answer and other API errors are shown inline.
	 */
	onSubmit: (data: CreateLoanDTO) => Promise<void>
}

/** "New loan" form: who borrows, how much, at what rate, and from which account it is disbursed. */
export function LoanFormDialog({ open, onOpenChange, accounts, onSubmit }: LoanFormDialogProps) {
	const t = useTranslations('loans')
	const tForms = useTranslations('forms')
	const locale = useAppLocale()
	const formatCurrency = useFormatCurrency()
	const schema = useMemo(() => createLoanSchema(t, tForms), [t, tForms])
	const [submitting, setSubmitting] = useState(false)
	const [submitError, setSubmitError] = useState<string | null>(null)
	const defaultAccountId = accounts[0]?.id ?? ''

	const form = useForm<LoanFormInput, unknown, LoanFormValues>({
		resolver: zodResolver(schema),
		defaultValues: emptyValues(defaultAccountId),
	})

	// Start every open from a clean form with the first account preselected.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the dialog opens, not when accounts refetch.
	useEffect(() => {
		if (!open) return
		form.reset(emptyValues(defaultAccountId))
		setSubmitError(null)
	}, [open, form])

	// Accounts can arrive after the dialog opened: preselect the first one without touching other fields.
	useEffect(() => {
		if (open && defaultAccountId && !form.getValues('source_account_id')) {
			form.setValue('source_account_id', defaultAccountId)
		}
	}, [open, defaultAccountId, form])

	const sourceAccountId = form.watch('source_account_id')
	const selectedSourceAccount = accounts.find((account) => account.id === sourceAccountId)

	async function handleValid(values: LoanFormValues) {
		setSubmitError(null)
		setSubmitting(true)
		try {
			await onSubmit({
				borrower_name: values.borrower_name.trim(),
				borrower_contact: values.borrower_contact,
				principal_amount: values.principal_amount,
				currency: 'DOP',
				interest_mode: 'fixed_total',
				annual_rate: values.annual_rate,
				term_months: values.term_months,
				start_date: values.start_date,
				source_account_id: values.source_account_id,
				notes: values.notes,
			})
		} catch (error) {
			// The disbursement would overdraw the source account, or the API refused it: say so inside the dialog.
			setSubmitError(
				getInsufficientFundsMessage(error, tForms, locale) ?? getSafeErrorDetail(error) ?? t('createError'),
			)
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<FormDialog
			open={open}
			onOpenChange={onOpenChange}
			title={t('newLoan')}
			description={t('newLoanDescription')}
			submitLabel={t('create')}
			loading={submitting}
			error={submitError}
			onSubmit={form.handleSubmit(handleValid)}
		>
			<Form {...form}>
				<div className='space-y-4'>
					<FormField
						control={form.control}
						name='borrower_name'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('borrower')}</FormLabel>
								<FormControl>
									<Input autoComplete='off' {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name='borrower_contact'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('contact')}</FormLabel>
								<FormControl>
									<Input autoComplete='off' {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
						<FormField
							control={form.control}
							name='principal_amount'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('principal')}</FormLabel>
									<FormControl>
										<Input type='number' min={0} step='0.01' inputMode='decimal' {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name='annual_rate'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('annualRate')}</FormLabel>
									<FormControl>
										<Input type='number' min={0} step='0.01' inputMode='decimal' {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name='term_months'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('termMonths')}</FormLabel>
									<FormControl>
										<Input type='number' min={1} max={120} inputMode='numeric' {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name='start_date'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('startDate')}</FormLabel>
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
						name='source_account_id'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('sourceAccount')}</FormLabel>
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
								{selectedSourceAccount?.current_balance !== undefined && (
									<p className='text-xs text-muted-foreground'>
										{tForms('availableBalance', {
											amount: formatCurrency(selectedSourceAccount.current_balance, selectedSourceAccount.currency),
										})}
									</p>
								)}
								<FormMessage />
							</FormItem>
						)}
					/>
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
