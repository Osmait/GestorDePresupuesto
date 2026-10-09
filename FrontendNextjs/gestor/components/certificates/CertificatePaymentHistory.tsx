'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useGetCertificate, useUpdateCertificatePaymentMutation } from '@/hooks/queries/useCertificatesQuery'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { hasAtMostDecimals } from '@/lib/money-validation'
import { formatCurrency } from '@/lib/utils'
import { CertificatePayment } from '@/types/certificate'
import { CertificateChart } from './CertificateChart'

function createEditPaymentSchema(t: (key: string) => string, tForms: (key: string) => string) {
	// certificate_payments money columns are DECIMAL(15,2): the API rejects sub-cent amounts.
	const cents = (schema: z.ZodNumber) => schema.refine((value) => hasAtMostDecimals(value), tForms('maxTwoDecimals'))
	return z.object({
		gross_interest: cents(z.coerce.number().min(0, t('errors.nonNegative'))),
		tax_withheld: cents(z.coerce.number().min(0, t('errors.nonNegative'))),
		net_interest: cents(z.coerce.number().min(0, t('errors.nonNegative'))),
		applied_rate: z.coerce.number().min(0.01, t('errors.rateRange')).max(100, t('errors.rateRange')),
		applied_tax_rate: z.coerce.number().min(0, t('errors.taxRange')).max(100, t('errors.taxRange')),
		applied_capital: cents(z.coerce.number().min(0.01, t('errors.positive'))),
	})
}

type EditPaymentFormData = z.infer<ReturnType<typeof createEditPaymentSchema>>

interface CertificatePaymentHistoryProps {
	certificateId: string | null
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function CertificatePaymentHistory({ certificateId, open, onOpenChange }: CertificatePaymentHistoryProps) {
	const t = useTranslations('certificates.history')
	const tForms = useTranslations('forms')
	const locale = useAppLocale()
	const editPaymentSchema = useMemo(() => createEditPaymentSchema(t, tForms), [t, tForms])
	const { data: certificate, isLoading } = useGetCertificate(certificateId || '')
	const payments = certificate?.payments ?? []
	const [editingPayment, setEditingPayment] = useState<CertificatePayment | null>(null)
	const updatePaymentMutation = useUpdateCertificatePaymentMutation()
	const currency = certificate?.currency || 'DOP'

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<EditPaymentFormData>({
		resolver: zodResolver(editPaymentSchema),
	})

	function openEditDialog(payment: CertificatePayment) {
		reset({
			gross_interest: payment.gross_interest,
			tax_withheld: payment.tax_withheld,
			net_interest: payment.net_interest,
			applied_rate: payment.applied_rate,
			applied_tax_rate: payment.applied_tax_rate,
			applied_capital: payment.applied_capital,
		})
		setEditingPayment(payment)
	}

	async function onEditSubmit(data: EditPaymentFormData) {
		if (!editingPayment) return
		await updatePaymentMutation.mutateAsync({
			paymentId: editingPayment.id,
			data: {
				gross_interest: data.gross_interest,
				tax_withheld: data.tax_withheld,
				net_interest: data.net_interest,
				applied_rate: data.applied_rate,
				applied_tax_rate: data.applied_tax_rate,
				applied_capital: data.applied_capital,
			},
		})
		setEditingPayment(null)
	}

	if (!certificateId) return null

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className='w-[95vw] sm:max-w-[800px] max-h-[90vh] overflow-y-auto'>
					<DialogHeader>
						<DialogTitle>{t('title', { bank: certificate?.bank || t('loading') })}</DialogTitle>
					</DialogHeader>
					{isLoading ? (
						<div className='py-8 text-center text-muted-foreground'>{t('loading')}</div>
					) : certificate ? (
						<div className='space-y-4'>
							<div className='grid grid-cols-1 gap-4 p-4 rounded-lg bg-muted/50 sm:grid-cols-3'>
								<div>
									<p className='text-xs text-muted-foreground'>{t('totalGrossInterest')}</p>
									<p className='text-lg font-semibold'>
										{formatCurrency(certificate.summary?.total_gross_interest || 0, currency, { locale })}
									</p>
								</div>
								<div>
									<p className='text-xs text-muted-foreground'>{t('totalTaxWithheld')}</p>
									<p className='text-lg font-semibold text-orange-500'>
										{formatCurrency(certificate.summary?.total_tax_withheld || 0, currency, { locale })}
									</p>
								</div>
								<div>
									<p className='text-xs text-muted-foreground'>{t('totalNetInterest')}</p>
									<p className='text-lg font-semibold text-green-500'>
										{formatCurrency(certificate.summary?.total_net_interest || 0, currency, { locale })}
									</p>
								</div>
							</div>

							<Tabs defaultValue='history'>
								<TabsList className='grid w-full grid-cols-2'>
									<TabsTrigger value='history'>{t('historyTab')}</TabsTrigger>
									<TabsTrigger value='chart'>{t('chartTab')}</TabsTrigger>
								</TabsList>
								<TabsContent value='history' className='mt-4'>
									{payments.length === 0 ? (
										<div className='py-8 text-center text-muted-foreground'>{t('empty')}</div>
									) : (
										<div className='max-h-[400px] overflow-auto rounded-md border'>
											<Table className='min-w-[640px]'>
												<TableHeader>
													<TableRow>
														<TableHead className='whitespace-nowrap'>{t('date')}</TableHead>
														<TableHead className='text-right'>{t('capital')}</TableHead>
														<TableHead className='text-right'>{t('rate')}</TableHead>
														<TableHead className='text-right'>{t('gross')}</TableHead>
														<TableHead className='text-right'>{t('tax')}</TableHead>
														<TableHead className='text-right'>{t('net')}</TableHead>
														<TableHead className='sticky right-0 w-[50px] bg-background'>
															<span className='sr-only'>{t('actions')}</span>
														</TableHead>
													</TableRow>
												</TableHeader>
												<TableBody>
													{payments.map((payment) => (
														<TableRow key={payment.id}>
															<TableCell className='whitespace-nowrap'>
																{formatLocalDate(payment.payment_date, locale)}
															</TableCell>
															<TableCell className='text-right'>
																{formatCurrency(payment.applied_capital, currency, { locale })}
															</TableCell>
															<TableCell className='text-right'>{payment.applied_rate}%</TableCell>
															<TableCell className='text-right'>
																{formatCurrency(payment.gross_interest, currency, { locale })}
															</TableCell>
															<TableCell className='text-right text-orange-500'>
																-{formatCurrency(payment.tax_withheld, currency, { locale })}
															</TableCell>
															<TableCell className='text-right text-green-500 font-medium'>
																{formatCurrency(payment.net_interest, currency, { locale })}
															</TableCell>
															<TableCell className='sticky right-0 bg-background'>
																<Button
																	variant='ghost'
																	size='icon'
																	className='h-7 w-7'
																	onClick={() => openEditDialog(payment)}
																	aria-label={t('editPayment')}
																>
																	<Pencil className='h-4 w-4' />
																</Button>
															</TableCell>
														</TableRow>
													))}
												</TableBody>
											</Table>
										</div>
									)}
								</TabsContent>
								<TabsContent value='chart' className='mt-4'>
									<CertificateChart certificate={certificate} payments={payments} />
								</TabsContent>
							</Tabs>
						</div>
					) : null}
				</DialogContent>
			</Dialog>

			<Dialog
				open={!!editingPayment}
				onOpenChange={(open) => {
					if (!open) setEditingPayment(null)
				}}
			>
				<DialogContent className='w-[95vw] max-h-[90vh] overflow-y-auto sm:max-w-[450px]'>
					<DialogHeader>
						<DialogTitle>{t('editPayment')}</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleSubmit(onEditSubmit)} className='space-y-4'>
						<div className='grid gap-4 py-4'>
							<div className='grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4'>
								<Label htmlFor='edit_gross_interest' className='sm:text-right'>
									{t('grossInterest')}
								</Label>
								<Input
									id='edit_gross_interest'
									type='number'
									step='0.01'
									className='sm:col-span-3'
									{...register('gross_interest')}
								/>
								{errors.gross_interest && (
									<p className='text-sm text-red-500 sm:col-span-4 sm:text-right'>{errors.gross_interest.message}</p>
								)}
							</div>
							<div className='grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4'>
								<Label htmlFor='edit_tax_withheld' className='sm:text-right'>
									{t('taxWithheld')}
								</Label>
								<Input
									id='edit_tax_withheld'
									type='number'
									step='0.01'
									className='sm:col-span-3'
									{...register('tax_withheld')}
								/>
								{errors.tax_withheld && (
									<p className='text-sm text-red-500 sm:col-span-4 sm:text-right'>{errors.tax_withheld.message}</p>
								)}
							</div>
							<div className='grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4'>
								<Label htmlFor='edit_net_interest' className='sm:text-right'>
									{t('netInterest')}
								</Label>
								<Input
									id='edit_net_interest'
									type='number'
									step='0.01'
									className='sm:col-span-3'
									{...register('net_interest')}
								/>
								{errors.net_interest && (
									<p className='text-sm text-red-500 sm:col-span-4 sm:text-right'>{errors.net_interest.message}</p>
								)}
							</div>
							<div className='grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4'>
								<Label htmlFor='edit_applied_rate' className='sm:text-right'>
									{t('ratePercent')}
								</Label>
								<Input
									id='edit_applied_rate'
									type='number'
									step='0.01'
									className='sm:col-span-3'
									{...register('applied_rate')}
								/>
								{errors.applied_rate && (
									<p className='text-sm text-red-500 sm:col-span-4 sm:text-right'>{errors.applied_rate.message}</p>
								)}
							</div>
							<div className='grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4'>
								<Label htmlFor='edit_applied_tax_rate' className='sm:text-right'>
									{t('taxRatePercent')}
								</Label>
								<Input
									id='edit_applied_tax_rate'
									type='number'
									step='0.01'
									className='sm:col-span-3'
									{...register('applied_tax_rate')}
								/>
								{errors.applied_tax_rate && (
									<p className='text-sm text-red-500 sm:col-span-4 sm:text-right'>{errors.applied_tax_rate.message}</p>
								)}
							</div>
							<div className='grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4'>
								<Label htmlFor='edit_applied_capital' className='sm:text-right'>
									{t('capital')}
								</Label>
								<Input
									id='edit_applied_capital'
									type='number'
									step='0.01'
									className='sm:col-span-3'
									{...register('applied_capital')}
								/>
								{errors.applied_capital && (
									<p className='text-sm text-red-500 sm:col-span-4 sm:text-right'>{errors.applied_capital.message}</p>
								)}
							</div>
						</div>
						<DialogFooter className='gap-2'>
							<Button type='button' variant='outline' onClick={() => setEditingPayment(null)}>
								{t('cancel')}
							</Button>
							<Button type='submit' disabled={updatePaymentMutation.isPending}>
								{updatePaymentMutation.isPending ? t('saving') : t('save')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	)
}
