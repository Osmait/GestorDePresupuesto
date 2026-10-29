'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Receipt } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Amount } from '@/components/shared/Amount'
import { EmptyState } from '@/components/shared/EmptyState'
import { FormDialog } from '@/components/shared/FormDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useGetCertificate, useUpdateCertificatePaymentMutation } from '@/hooks/queries/useCertificatesQuery'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { getSafeErrorDetail } from '@/lib/api-error'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { hasAtMostDecimals } from '@/lib/money-validation'
import { CertificatePayment } from '@/types/certificate'

// The chart lives in a secondary tab of the dialog: load Nivo only when it is shown.
const CertificateChart = dynamic(() => import('./CertificateChart').then((mod) => mod.CertificateChart), {
	ssr: false,
	loading: () => <Skeleton className='h-[300px] w-full' />,
})

function createEditPaymentSchema(t: (key: string) => string, tForms: (key: string) => string) {
	// certificate_payments money columns are DECIMAL(15,2): the API rejects sub-cent amounts.
	const cents = (schema: z.ZodNumber) => schema.refine((value) => hasAtMostDecimals(value), tForms('maxTwoDecimals'))
	return z.object({
		gross_interest: cents(z.coerce.number<number>().min(0, t('errors.nonNegative'))),
		tax_withheld: cents(z.coerce.number<number>().min(0, t('errors.nonNegative'))),
		net_interest: cents(z.coerce.number<number>().min(0, t('errors.nonNegative'))),
		applied_rate: z.coerce.number<number>().min(0.01, t('errors.rateRange')).max(100, t('errors.rateRange')),
		applied_tax_rate: z.coerce.number<number>().min(0, t('errors.taxRange')).max(100, t('errors.taxRange')),
		applied_capital: cents(z.coerce.number<number>().min(0.01, t('errors.positive'))),
	})
}

type EditPaymentFormData = z.infer<ReturnType<typeof createEditPaymentSchema>>

type EditPaymentFormInput = z.input<ReturnType<typeof createEditPaymentSchema>>

const EDIT_FIELDS = [
	{ name: 'gross_interest', labelKey: 'grossInterest' },
	{ name: 'tax_withheld', labelKey: 'taxWithheld' },
	{ name: 'net_interest', labelKey: 'netInterest' },
	{ name: 'applied_rate', labelKey: 'ratePercent' },
	{ name: 'applied_tax_rate', labelKey: 'taxRatePercent' },
	{ name: 'applied_capital', labelKey: 'capital' },
] as const

interface CertificatePaymentHistoryProps {
	certificateId: string | null
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function CertificatePaymentHistory({ certificateId, open, onOpenChange }: CertificatePaymentHistoryProps) {
	const t = useTranslations('certificates.history')
	const tForms = useTranslations('forms')
	const formatPercent = useFormatPercent()
	const locale = useAppLocale()
	const editPaymentSchema = useMemo(() => createEditPaymentSchema(t, tForms), [t, tForms])
	const { data: certificate, isLoading } = useGetCertificate(certificateId || '')
	const payments = certificate?.payments ?? []
	const [editingPayment, setEditingPayment] = useState<CertificatePayment | null>(null)
	const [editError, setEditError] = useState<string | null>(null)
	const updatePaymentMutation = useUpdateCertificatePaymentMutation()
	const currency = certificate?.currency || 'DOP'

	const form = useForm<EditPaymentFormInput, unknown, EditPaymentFormData>({
		resolver: zodResolver(editPaymentSchema),
	})

	function openEditDialog(payment: CertificatePayment) {
		form.reset({
			gross_interest: payment.gross_interest,
			tax_withheld: payment.tax_withheld,
			net_interest: payment.net_interest,
			applied_rate: payment.applied_rate,
			applied_tax_rate: payment.applied_tax_rate,
			applied_capital: payment.applied_capital,
		})
		setEditError(null)
		setEditingPayment(payment)
	}

	async function onEditSubmit(data: EditPaymentFormData) {
		if (!editingPayment) return
		setEditError(null)
		try {
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
		} catch (error) {
			setEditError(getSafeErrorDetail(error) ?? t('errors.saveFailed'))
		}
	}

	if (!certificateId) return null

	const totals = [
		{
			key: 'gross',
			label: t('totalGrossInterest'),
			value: certificate?.summary?.total_gross_interest || 0,
			tone: 'neutral',
		},
		{ key: 'tax', label: t('totalTaxWithheld'), value: certificate?.summary?.total_tax_withheld || 0, tone: 'neutral' },
		{ key: 'net', label: t('totalNetInterest'), value: certificate?.summary?.total_net_interest || 0, tone: 'auto' },
	] as const

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className='max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-[800px]'>
					<DialogHeader>
						<DialogTitle>{t('title', { bank: certificate?.bank || t('loading') })}</DialogTitle>
					</DialogHeader>
					{isLoading ? (
						<div className='space-y-4' aria-busy='true'>
							<Skeleton className='h-20 w-full' />
							<Skeleton className='h-10 w-full' />
							<Skeleton className='h-40 w-full' />
						</div>
					) : certificate ? (
						<div className='space-y-4'>
							<dl className='grid grid-cols-1 gap-4 rounded-lg bg-muted/50 p-4 sm:grid-cols-3'>
								{totals.map((item) => (
									<div key={item.key}>
										<dt className='text-xs text-muted-foreground'>{item.label}</dt>
										<dd className='text-lg font-semibold'>
											<Amount value={item.value} currency={currency} tone={item.tone} />
										</dd>
									</div>
								))}
							</dl>

							<Tabs defaultValue='history'>
								<TabsList className='grid w-full grid-cols-2'>
									<TabsTrigger value='history'>{t('historyTab')}</TabsTrigger>
									<TabsTrigger value='chart'>{t('chartTab')}</TabsTrigger>
								</TabsList>
								<TabsContent value='history' className='mt-4'>
									{payments.length === 0 ? (
										<EmptyState compact icon={Receipt} title={t('empty')} />
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
														<TableHead className='sticky right-0 w-[56px] bg-background'>
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
																<Amount value={payment.applied_capital} currency={currency} />
															</TableCell>
															<TableCell className='text-right tabular-nums'>
																{formatPercent(payment.applied_rate, { maximumFractionDigits: 2 })}
															</TableCell>
															<TableCell className='text-right'>
																<Amount value={payment.gross_interest} currency={currency} />
															</TableCell>
															<TableCell className='text-right'>
																<Amount value={-payment.tax_withheld} currency={currency} tone='auto' />
															</TableCell>
															<TableCell className='text-right font-medium'>
																<Amount value={payment.net_interest} currency={currency} tone='auto' />
															</TableCell>
															<TableCell className='sticky right-0 bg-background py-1'>
																<Button
																	variant='ghost'
																	size='icon'
																	onClick={() => openEditDialog(payment)}
																	aria-label={t('editPayment')}
																>
																	<Pencil className='h-4 w-4' aria-hidden='true' />
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

			<FormDialog
				open={!!editingPayment}
				onOpenChange={(next) => {
					if (!next) setEditingPayment(null)
				}}
				title={t('editPayment')}
				size='sm'
				loading={updatePaymentMutation.isPending}
				error={editError}
				onSubmit={form.handleSubmit(onEditSubmit)}
			>
				<Form {...form}>
					<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
						{EDIT_FIELDS.map((item) => (
							<FormField
								key={item.name}
								control={form.control}
								name={item.name}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t(item.labelKey)}</FormLabel>
										<FormControl>
											<Input type='number' step='0.01' inputMode='decimal' {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						))}
					</div>
				</Form>
			</FormDialog>
		</>
	)
}
