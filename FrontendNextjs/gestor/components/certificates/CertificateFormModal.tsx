'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Calculator } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { FormDialog } from '@/components/shared/FormDialog'
import { MoneyInput } from '@/components/shared/MoneyInput'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { getSafeErrorDetail } from '@/lib/api-error'
import { moneyInputToNumber, moneyMessages, moneySchema } from '@/lib/money-input'
import { Certificate, CreateCertificateDTO, InterestType, UpdateCertificateDTO } from '@/types/certificate'

type Translator = (key: string, values?: Record<string, string | number>) => string

function createCertificateSchema(t: Translator, tForms: Translator) {
	// certificates.current_interest_rate / current_tax_rate are DECIMAL(5,2).
	const rate = (required: string) => moneySchema(moneyMessages(tForms, { required, number: true }))
	return z
		.object({
			bank: z.string().min(2, t('errors.bankMin')),
			// certificates.base_capital is DECIMAL(15,2): moneySchema rejects sub-cent amounts.
			base_capital: moneySchema(moneyMessages(tForms, { required: t('errors.capitalMin') })).pipe(
				z.number().min(0.01, t('errors.capitalMin')),
			),
			interest_type: z.enum(['simple', 'compound']),
			current_interest_rate: rate(t('errors.rateRange')).pipe(
				z.number().min(0.01, t('errors.rateRange')).max(100, t('errors.rateRange')),
			),
			current_tax_rate: rate(t('errors.taxRange')).pipe(
				z.number().min(0, t('errors.taxRange')).max(100, t('errors.taxRange')),
			),
			cut_day: z.coerce.number<number>().min(1, t('errors.cutDayRange')).max(28, t('errors.cutDayRange')),
			reinvest_interest: z.boolean(),
			payout_account_id: z.string().optional(),
			maturity_date: z.string().optional(),
		})
		.refine(
			(data) => {
				if (data.interest_type === 'simple' && (!data.payout_account_id || data.payout_account_id.trim() === '')) {
					return false
				}
				return true
			},
			{
				message: t('errors.payoutRequired'),
				path: ['payout_account_id'],
				// Only once every field is valid (Zod 3 semantics; Zod 4 runs it alongside field errors).
				when: (payload) => payload.issues.length === 0,
			},
		)
}

type FormData = z.infer<ReturnType<typeof createCertificateSchema>>

type FormInput = z.input<ReturnType<typeof createCertificateSchema>>

const EMPTY_VALUES: FormInput = {
	bank: '',
	base_capital: 1000,
	interest_type: 'simple',
	current_interest_rate: 5,
	current_tax_rate: 10,
	cut_day: 19,
	reinvest_interest: false,
	payout_account_id: '',
	maturity_date: '',
}

interface CertificateFormModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	certificate?: Certificate | null
	accounts: { id: string; name: string; bank: string }[]
	onSubmit: (data: CreateCertificateDTO | UpdateCertificateDTO) => Promise<void>
	onSimulate?: (data: {
		capital: number
		rate: number
		taxRate: number
		interestType: InterestType
		reinvestInterest: boolean
	}) => void
}

export function CertificateFormModal({
	open,
	onOpenChange,
	certificate,
	accounts,
	onSubmit,
	onSimulate,
}: CertificateFormModalProps) {
	const t = useTranslations('certificates.form')
	const tForms = useTranslations('forms')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [submitError, setSubmitError] = useState<{ detail: string | null } | null>(null)
	const isEditing = !!certificate
	const certificateSchema = useMemo(() => createCertificateSchema(t, tForms), [t, tForms])

	const form = useForm<FormInput, unknown, FormData>({
		resolver: zodResolver(certificateSchema),
		defaultValues: EMPTY_VALUES,
	})
	const { watch, reset } = form

	const interestType = watch('interest_type')

	useEffect(() => {
		if (open) setSubmitError(null)
	}, [open])

	useEffect(() => {
		if (certificate) {
			reset({
				bank: certificate.bank,
				base_capital: certificate.base_capital,
				interest_type: certificate.interest_type,
				current_interest_rate: certificate.current_interest_rate,
				current_tax_rate: certificate.current_tax_rate,
				cut_day: certificate.cut_day,
				reinvest_interest: certificate.reinvest_interest,
				payout_account_id: certificate.payout_account_id || '',
				maturity_date: certificate.maturity_date ? certificate.maturity_date.split('T')[0] : '',
			})
		} else {
			reset(EMPTY_VALUES)
		}
	}, [certificate, reset])

	const showPayoutAccount = interestType === 'simple'
	const showReinvestToggle = interestType === 'compound'

	const onFormSubmit = async (data: FormData) => {
		setIsSubmitting(true)
		setSubmitError(null)
		try {
			const submitData: CreateCertificateDTO = {
				bank: data.bank,
				base_capital: data.base_capital,
				interest_type: data.interest_type as InterestType,
				current_interest_rate: data.current_interest_rate,
				current_tax_rate: data.current_tax_rate,
				cut_day: Number(data.cut_day),
				reinvest_interest: Boolean(data.reinvest_interest),
			}

			if (showPayoutAccount && data.payout_account_id && data.payout_account_id.trim() !== '') {
				submitData.payout_account_id = data.payout_account_id.trim()
			}

			if (data.maturity_date && data.maturity_date.trim() !== '') {
				submitData.maturity_date = data.maturity_date.trim()
			}

			await onSubmit(submitData)
			onOpenChange(false)
		} catch (error) {
			setSubmitError({ detail: getSafeErrorDetail(error) })
		} finally {
			setIsSubmitting(false)
		}
	}

	const numberField = (
		name: 'base_capital' | 'current_interest_rate' | 'current_tax_rate',
		label: string,
		placeholder: string,
	) => (
		<FormField
			control={form.control}
			name={name}
			render={({ field }) => (
				<FormItem>
					<FormLabel>{label}</FormLabel>
					<FormControl>
						<MoneyInput placeholder={placeholder} {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
	)

	return (
		<FormDialog
			open={open}
			onOpenChange={onOpenChange}
			title={isEditing ? t('editTitle') : t('newTitle')}
			submitLabel={isEditing ? t('update') : t('create')}
			loading={isSubmitting}
			error={
				submitError ? (
					<>
						<p>{t('errors.saveFailed')}</p>
						{submitError.detail ? <p className='text-xs opacity-90'>{submitError.detail}</p> : null}
					</>
				) : null
			}
			onSubmit={form.handleSubmit(onFormSubmit)}
		>
			<Form {...form}>
				<div className='space-y-4'>
					<FormField
						control={form.control}
						name='bank'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('bank')}</FormLabel>
								<FormControl>
									<Input placeholder={t('bankPlaceholder')} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
						{numberField('base_capital', t('capital'), '0.00')}

						<FormField
							control={form.control}
							name='interest_type'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('type')}</FormLabel>
									<Select value={field.value} onValueChange={(value) => field.onChange(value as InterestType)}>
										<FormControl>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value='simple'>{t('simpleInterest')}</SelectItem>
											<SelectItem value='compound'>{t('compoundInterest')}</SelectItem>
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					{showReinvestToggle && (
						<FormField
							control={form.control}
							name='reinvest_interest'
							render={({ field }) => (
								<FormItem className='flex items-center justify-between gap-4 space-y-0 rounded-md border p-3'>
									<div className='space-y-0.5'>
										<FormLabel>{t('reinvest')}</FormLabel>
										<FormDescription>{t('reinvestHelp')}</FormDescription>
									</div>
									<FormControl>
										<Switch checked={field.value} onCheckedChange={field.onChange} />
									</FormControl>
								</FormItem>
							)}
						/>
					)}

					{showPayoutAccount && (
						<FormField
							control={form.control}
							name='payout_account_id'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('payoutAccount')}</FormLabel>
									<Select value={field.value || ''} onValueChange={field.onChange}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder={t('selectAccount')} />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{accounts.map((account) => (
												<SelectItem key={account.id} value={account.id}>
													{account.name} - {account.bank}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
					)}

					<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
						{numberField('current_interest_rate', t('rate'), '4.55')}
						{numberField('current_tax_rate', t('tax'), '10.00')}

						<FormField
							control={form.control}
							name='cut_day'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('cutDay')}</FormLabel>
									<FormControl>
										<Input type='number' min={1} max={28} inputMode='numeric' placeholder='19' {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name='maturity_date'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('maturity')}</FormLabel>
									<FormControl>
										<Input type='date' {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					{onSimulate && (
						<Button
							type='button'
							variant='outline'
							size='sm'
							onClick={() =>
								onSimulate({
									capital: moneyInputToNumber(watch('base_capital')),
									rate: moneyInputToNumber(watch('current_interest_rate')),
									taxRate: moneyInputToNumber(watch('current_tax_rate')),
									interestType: watch('interest_type'),
									reinvestInterest: watch('reinvest_interest'),
								})
							}
						>
							<Calculator className='mr-2 h-4 w-4' aria-hidden='true' />
							{t('simulate')}
						</Button>
					)}
				</div>
			</Form>
		</FormDialog>
	)
}
