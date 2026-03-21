'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Certificate, CreateCertificateDTO, InterestType, UpdateCertificateDTO } from '@/types/certificate'

const certificateSchema = z
	.object({
		bank: z.string().min(2, 'Bank name must be at least 2 characters'),
		base_capital: z.coerce.number().min(0.01, 'Capital must be greater than 0'),
		interest_type: z.enum(['simple', 'compound']),
		current_interest_rate: z.coerce.number().min(0.01).max(100),
		current_tax_rate: z.coerce.number().min(0).max(100),
		cut_day: z.coerce.number().min(1).max(28),
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
			message: 'Payout account is required for simple interest type',
			path: ['payout_account_id'],
		},
	)

type FormData = z.infer<typeof certificateSchema>

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
	const [isSubmitting, setIsSubmitting] = useState(false)
	const isEditing = !!certificate

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

			console.log('Submitting certificate data:', submitData)
			await onSubmit(submitData)
			onOpenChange(false)
		} catch (error) {
			console.error('Error submitting certificate:', error)
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-[500px]'>
				<DialogHeader>
					<DialogTitle>{isEditing ? 'Edit Certificate' : 'New Certificate'}</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit(onFormSubmit)} className='space-y-4'>
					<div className='grid gap-4 py-4'>
						<div className='grid grid-cols-4 items-center gap-4'>
							<Label htmlFor='bank' className='text-right'>
								Bank
							</Label>
							<Input id='bank' className='col-span-3' {...register('bank')} placeholder='Bank name' />
							{errors.bank && <p className='col-span-4 text-right text-sm text-red-500'>{errors.bank.message}</p>}
						</div>

						<div className='grid grid-cols-4 items-center gap-4'>
							<Label htmlFor='base_capital' className='text-right'>
								Capital
							</Label>
							<Input
								id='base_capital'
								type='number'
								step='0.01'
								className='col-span-3'
								{...register('base_capital', { valueAsNumber: true })}
								placeholder='0.00'
							/>
							{errors.base_capital && (
								<p className='col-span-4 text-right text-sm text-red-500'>{errors.base_capital.message}</p>
							)}
						</div>

						<div className='grid grid-cols-4 items-center gap-4'>
							<Label htmlFor='interest_type' className='text-right'>
								Type
							</Label>
							<Select value={interestType} onValueChange={(value) => setValue('interest_type', value as InterestType)}>
								<SelectTrigger className='col-span-3'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='simple'>Simple Interest</SelectItem>
									<SelectItem value='compound'>Compound Interest</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{showReinvestToggle && (
							<div className='grid grid-cols-4 items-center gap-4'>
								<Label htmlFor='reinvest_interest' className='text-right'>
									Reinvest
								</Label>
								<div className='col-span-3 flex items-center gap-2'>
									<Switch
										id='reinvest_interest'
										checked={reinvestInterest}
										onCheckedChange={(checked) => setValue('reinvest_interest', checked)}
									/>
									<span className='text-sm text-muted-foreground'>Reinvest net interest</span>
								</div>
							</div>
						)}

						{showPayoutAccount && (
							<div className='grid grid-cols-4 items-center gap-4'>
								<Label htmlFor='payout_account_id' className='text-right'>
									Payout Account *
								</Label>
								<div className='col-span-3 space-y-1'>
									<Select
										value={watch('payout_account_id') || ''}
										onValueChange={(value) => setValue('payout_account_id', value)}
									>
										<SelectTrigger>
											<SelectValue placeholder='Select account' />
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

						<div className='grid grid-cols-4 items-center gap-4'>
							<Label htmlFor='current_interest_rate' className='text-right'>
								Rate (%)
							</Label>
							<Input
								id='current_interest_rate'
								type='number'
								step='0.01'
								className='col-span-3'
								{...register('current_interest_rate', { valueAsNumber: true })}
								placeholder='4.55'
							/>
							{errors.current_interest_rate && (
								<p className='col-span-4 text-right text-sm text-red-500'>{errors.current_interest_rate.message}</p>
							)}
						</div>

						<div className='grid grid-cols-4 items-center gap-4'>
							<Label htmlFor='current_tax_rate' className='text-right'>
								Tax (%)
							</Label>
							<Input
								id='current_tax_rate'
								type='number'
								step='0.01'
								className='col-span-3'
								{...register('current_tax_rate', { valueAsNumber: true })}
								placeholder='10.00'
							/>
							{errors.current_tax_rate && (
								<p className='col-span-4 text-right text-sm text-red-500'>{errors.current_tax_rate.message}</p>
							)}
						</div>

						<div className='grid grid-cols-4 items-center gap-4'>
							<Label htmlFor='cut_day' className='text-right'>
								Cut Day
							</Label>
							<Input
								id='cut_day'
								type='number'
								min={1}
								max={28}
								className='col-span-3'
								{...register('cut_day', { valueAsNumber: true })}
								placeholder='19'
							/>
							{errors.cut_day && <p className='col-span-4 text-right text-sm text-red-500'>{errors.cut_day.message}</p>}
						</div>

						<div className='grid grid-cols-4 items-center gap-4'>
							<Label htmlFor='maturity_date' className='text-right'>
								Maturity
							</Label>
							<Input id='maturity_date' type='date' className='col-span-3' {...register('maturity_date')} />
						</div>
					</div>

					<DialogFooter className='gap-2'>
						<Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
							Cancel
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
								Simulate
							</Button>
						)}
						<Button type='submit' disabled={isSubmitting}>
							{isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Create'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
