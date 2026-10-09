'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { getSafeErrorDetail } from '@/lib/api-error'
import { hasAtMostDecimals } from '@/lib/money-validation'
import { Certificate, CreateCertificateDTO, InterestType, UpdateCertificateDTO } from '@/types/certificate'

function createCertificateSchema(t: (key: string) => string, tForms: (key: string) => string) {
	return z
		.object({
			bank: z.string().min(2, t('errors.bankMin')),
			// certificates.base_capital is DECIMAL(15,2): the API rejects sub-cent amounts.
			base_capital: z.coerce
				.number()
				.min(0.01, t('errors.capitalMin'))
				.refine((value) => hasAtMostDecimals(value), tForms('maxTwoDecimals')),
			interest_type: z.enum(['simple', 'compound']),
			current_interest_rate: z.coerce.number().min(0.01, t('errors.rateRange')).max(100, t('errors.rateRange')),
			current_tax_rate: z.coerce.number().min(0, t('errors.taxRange')).max(100, t('errors.taxRange')),
			cut_day: z.coerce.number().min(1, t('errors.cutDayRange')).max(28, t('errors.cutDayRange')),
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
			},
		)
}

type FormData = z.infer<ReturnType<typeof createCertificateSchema>>

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

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { errors },
	} = useForm<FormData>({
		resolver: zodResolver(certificateSchema),
		defaultValues: {
			bank: '',
			base_capital: 1000,
			interest_type: 'simple',
			current_interest_rate: 5,
			current_tax_rate: 10,
			cut_day: 19,
			reinvest_interest: false,
			payout_account_id: '',
			maturity_date: '',
		},
	})

	const interestType = watch('interest_type')
	const reinvestInterest = watch('reinvest_interest')

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
			reset({
				bank: '',
				base_capital: 1000,
				interest_type: 'simple',
				current_interest_rate: 5,
				current_tax_rate: 10,
				cut_day: 19,
				reinvest_interest: false,
				payout_account_id: '',
				maturity_date: '',
			})
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
				base_capital: Number(data.base_capital),
				interest_type: data.interest_type as InterestType,
				current_interest_rate: Number(data.current_interest_rate),
				current_tax_rate: Number(data.current_tax_rate),
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

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='w-[95vw] max-h-[90vh] overflow-y-auto sm:max-w-[500px]'>
				<DialogHeader>
					<DialogTitle>{isEditing ? t('editTitle') : t('newTitle')}</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit(onFormSubmit)} className='space-y-4'>
					<div className='grid gap-4 py-4'>
						<div className='grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4'>
							<Label htmlFor='bank' className='sm:text-right'>
								{t('bank')}
							</Label>
							<Input id='bank' className='sm:col-span-3' {...register('bank')} placeholder={t('bankPlaceholder')} />
							{errors.bank && <p className='text-sm text-red-500 sm:col-span-4 sm:text-right'>{errors.bank.message}</p>}
						</div>

						<div className='grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4'>
							<Label htmlFor='base_capital' className='sm:text-right'>
								{t('capital')}
							</Label>
							<Input
								id='base_capital'
								type='number'
								step='0.01'
								className='sm:col-span-3'
								{...register('base_capital', { valueAsNumber: true })}
								placeholder='0.00'
							/>
							{errors.base_capital && (
								<p className='text-sm text-red-500 sm:col-span-4 sm:text-right'>{errors.base_capital.message}</p>
							)}
						</div>

						<div className='grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4'>
							<Label htmlFor='interest_type' className='sm:text-right'>
								{t('type')}
							</Label>
							<Select value={interestType} onValueChange={(value) => setValue('interest_type', value as InterestType)}>
								<SelectTrigger className='sm:col-span-3'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='simple'>{t('simpleInterest')}</SelectItem>
									<SelectItem value='compound'>{t('compoundInterest')}</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{showReinvestToggle && (
							<div className='grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4'>
								<Label htmlFor='reinvest_interest' className='sm:text-right'>
									{t('reinvest')}
								</Label>
								<div className='flex items-center gap-2 sm:col-span-3'>
									<Switch
										id='reinvest_interest'
										checked={reinvestInterest}
										onCheckedChange={(checked) => setValue('reinvest_interest', checked)}
									/>
									<span className='text-sm text-muted-foreground'>{t('reinvestHelp')}</span>
								</div>
							</div>
						)}

						{showPayoutAccount && (
							<div className='grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4'>
								<Label htmlFor='payout_account_id' className='sm:text-right'>
									{t('payoutAccount')}
								</Label>
								<div className='space-y-1 sm:col-span-3'>
									<Select
										value={watch('payout_account_id') || ''}
										onValueChange={(value) => setValue('payout_account_id', value)}
									>
										<SelectTrigger>
											<SelectValue placeholder={t('selectAccount')} />
										</SelectTrigger>
										<SelectContent>
											{accounts.map((account) => (
												<SelectItem key={account.id} value={account.id}>
													{account.name} - {account.bank}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{errors.payout_account_id && (
										<p className='text-sm text-red-500'>{errors.payout_account_id.message}</p>
									)}
								</div>
							</div>
						)}

						<div className='grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4'>
							<Label htmlFor='current_interest_rate' className='sm:text-right'>
								{t('rate')}
							</Label>
							<Input
								id='current_interest_rate'
								type='number'
								step='0.01'
								className='sm:col-span-3'
								{...register('current_interest_rate', { valueAsNumber: true })}
								placeholder='4.55'
							/>
							{errors.current_interest_rate && (
								<p className='text-sm text-red-500 sm:col-span-4 sm:text-right'>
									{errors.current_interest_rate.message}
								</p>
							)}
						</div>

						<div className='grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4'>
							<Label htmlFor='current_tax_rate' className='sm:text-right'>
								{t('tax')}
							</Label>
							<Input
								id='current_tax_rate'
								type='number'
								step='0.01'
								className='sm:col-span-3'
								{...register('current_tax_rate', { valueAsNumber: true })}
								placeholder='10.00'
							/>
							{errors.current_tax_rate && (
								<p className='text-sm text-red-500 sm:col-span-4 sm:text-right'>{errors.current_tax_rate.message}</p>
							)}
						</div>

						<div className='grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4'>
							<Label htmlFor='cut_day' className='sm:text-right'>
								{t('cutDay')}
							</Label>
							<Input
								id='cut_day'
								type='number'
								min={1}
								max={28}
								className='sm:col-span-3'
								{...register('cut_day', { valueAsNumber: true })}
								placeholder='19'
							/>
							{errors.cut_day && (
								<p className='text-sm text-red-500 sm:col-span-4 sm:text-right'>{errors.cut_day.message}</p>
							)}
						</div>

						<div className='grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4'>
							<Label htmlFor='maturity_date' className='sm:text-right'>
								{t('maturity')}
							</Label>
							<Input id='maturity_date' type='date' className='sm:col-span-3' {...register('maturity_date')} />
						</div>
					</div>

					{submitError && (
						<Alert variant='destructive'>
							<AlertDescription>
								<p>{t('errors.saveFailed')}</p>
								{submitError.detail && <p className='text-xs opacity-90'>{submitError.detail}</p>}
							</AlertDescription>
						</Alert>
					)}

					<DialogFooter className='gap-2'>
						<Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
							{t('cancel')}
						</Button>
						{onSimulate && (
							<Button
								type='button'
								variant='secondary'
								onClick={() =>
									onSimulate({
										capital: watch('base_capital'),
										rate: watch('current_interest_rate'),
										taxRate: watch('current_tax_rate'),
										interestType: watch('interest_type'),
										reinvestInterest: watch('reinvest_interest'),
									})
								}
							>
								{t('simulate')}
							</Button>
						)}
						<Button type='submit' disabled={isSubmitting}>
							{isSubmitting ? t('saving') : isEditing ? t('update') : t('create')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
