'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useGetCertificate, useUpdateCertificatePaymentMutation } from '@/hooks/queries/useCertificatesQuery'
import { CertificatePayment, formatCurrency } from '@/types/certificate'
import { CertificateChart } from './CertificateChart'

const editPaymentSchema = z.object({
	gross_interest: z.coerce.number().min(0, 'Must be >= 0'),
	tax_withheld: z.coerce.number().min(0, 'Must be >= 0'),
	net_interest: z.coerce.number().min(0, 'Must be >= 0'),
	applied_rate: z.coerce.number().min(0.01).max(100),
	applied_tax_rate: z.coerce.number().min(0).max(100),
	applied_capital: z.coerce.number().min(0.01, 'Must be > 0'),
})

type EditPaymentFormData = z.infer<typeof editPaymentSchema>

interface CertificatePaymentHistoryProps {
	certificateId: string | null
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function CertificatePaymentHistory({ certificateId, open, onOpenChange }: CertificatePaymentHistoryProps) {
	const { data: certificate, isLoading } = useGetCertificate(certificateId || '')
	const payments = certificate?.payments ?? []
	const [editingPayment, setEditingPayment] = useState<CertificatePayment | null>(null)
	const updatePaymentMutation = useUpdateCertificatePaymentMutation()

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
				<DialogContent className='sm:max-w-[800px] max-h-[90vh] overflow-y-auto'>
					<DialogHeader>
						<DialogTitle>Payment History - {certificate?.bank || 'Loading...'}</DialogTitle>
					</DialogHeader>
					{isLoading ? (
						<div className='py-8 text-center text-muted-foreground'>Loading...</div>
					) : certificate ? (
						<div className='space-y-4'>
							<div className='grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50'>
								<div>
									<p className='text-xs text-muted-foreground'>Total Gross Interest</p>
									<p className='text-lg font-semibold'>
										{formatCurrency(certificate.summary?.total_gross_interest || 0)}
									</p>
								</div>
								<div>
									<p className='text-xs text-muted-foreground'>Total Tax Withheld</p>
									<p className='text-lg font-semibold text-orange-500'>
										{formatCurrency(certificate.summary?.total_tax_withheld || 0)}
									</p>
								</div>
								<div>
									<p className='text-xs text-muted-foreground'>Total Net Interest</p>
									<p className='text-lg font-semibold text-green-500'>
										{formatCurrency(certificate.summary?.total_net_interest || 0)}
									</p>
								</div>
							</div>

							<Tabs defaultValue='history'>
								<TabsList className='grid w-full grid-cols-2'>
									<TabsTrigger value='history'>History</TabsTrigger>
									<TabsTrigger value='chart'>Chart</TabsTrigger>
								</TabsList>
								<TabsContent value='history' className='mt-4'>
									{payments.length === 0 ? (
										<div className='py-8 text-center text-muted-foreground'>No payments recorded yet.</div>
									) : (
										<ScrollArea className='h-[400px]'>
											<Table>
												<TableHeader>
													<TableRow>
														<TableHead>Date</TableHead>
														<TableHead className='text-right'>Capital</TableHead>
														<TableHead className='text-right'>Rate</TableHead>
														<TableHead className='text-right'>Gross</TableHead>
														<TableHead className='text-right'>Tax</TableHead>
														<TableHead className='text-right'>Net</TableHead>
														<TableHead className='w-[50px]'>Actions</TableHead>
													</TableRow>
												</TableHeader>
												<TableBody>
													{payments.map((payment) => (
														<TableRow key={payment.id}>
															<TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
															<TableCell className='text-right'>{formatCurrency(payment.applied_capital)}</TableCell>
															<TableCell className='text-right'>{payment.applied_rate}%</TableCell>
															<TableCell className='text-right'>{formatCurrency(payment.gross_interest)}</TableCell>
															<TableCell className='text-right text-orange-500'>
																-{formatCurrency(payment.tax_withheld)}
															</TableCell>
															<TableCell className='text-right text-green-500 font-medium'>
																{formatCurrency(payment.net_interest)}
															</TableCell>
															<TableCell>
																<Button
																	variant='ghost'
																	size='icon'
																	className='h-7 w-7'
																	onClick={() => openEditDialog(payment)}
																	aria-label='Edit payment'
																>
																	<Pencil className='h-4 w-4' />
																</Button>
															</TableCell>
														</TableRow>
													))}
												</TableBody>
											</Table>
										</ScrollArea>
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
				<DialogContent className='sm:max-w-[450px]'>
					<DialogHeader>
						<DialogTitle>Edit Payment</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleSubmit(onEditSubmit)} className='space-y-4'>
						<div className='grid gap-4 py-4'>
							<div className='grid grid-cols-4 items-center gap-4'>
								<Label htmlFor='edit_gross_interest' className='text-right'>
									Gross Interest
								</Label>
								<Input
									id='edit_gross_interest'
									type='number'
									step='0.01'
									className='col-span-3'
									{...register('gross_interest')}
								/>
								{errors.gross_interest && (
									<p className='col-span-4 text-right text-sm text-red-500'>{errors.gross_interest.message}</p>
								)}
							</div>
							<div className='grid grid-cols-4 items-center gap-4'>
								<Label htmlFor='edit_tax_withheld' className='text-right'>
									Tax Withheld
								</Label>
								<Input
									id='edit_tax_withheld'
									type='number'
									step='0.01'
									className='col-span-3'
									{...register('tax_withheld')}
								/>
								{errors.tax_withheld && (
									<p className='col-span-4 text-right text-sm text-red-500'>{errors.tax_withheld.message}</p>
								)}
							</div>
							<div className='grid grid-cols-4 items-center gap-4'>
								<Label htmlFor='edit_net_interest' className='text-right'>
									Net Interest
								</Label>
								<Input
									id='edit_net_interest'
									type='number'
									step='0.01'
									className='col-span-3'
									{...register('net_interest')}
								/>
								{errors.net_interest && (
									<p className='col-span-4 text-right text-sm text-red-500'>{errors.net_interest.message}</p>
								)}
							</div>
							<div className='grid grid-cols-4 items-center gap-4'>
								<Label htmlFor='edit_applied_rate' className='text-right'>
									Rate (%)
								</Label>
								<Input
									id='edit_applied_rate'
									type='number'
									step='0.01'
									className='col-span-3'
									{...register('applied_rate')}
								/>
								{errors.applied_rate && (
									<p className='col-span-4 text-right text-sm text-red-500'>{errors.applied_rate.message}</p>
								)}
							</div>
							<div className='grid grid-cols-4 items-center gap-4'>
								<Label htmlFor='edit_applied_tax_rate' className='text-right'>
									Tax Rate (%)
								</Label>
								<Input
									id='edit_applied_tax_rate'
									type='number'
									step='0.01'
									className='col-span-3'
									{...register('applied_tax_rate')}
								/>
								{errors.applied_tax_rate && (
									<p className='col-span-4 text-right text-sm text-red-500'>{errors.applied_tax_rate.message}</p>
								)}
							</div>
							<div className='grid grid-cols-4 items-center gap-4'>
								<Label htmlFor='edit_applied_capital' className='text-right'>
									Capital
								</Label>
								<Input
									id='edit_applied_capital'
									type='number'
									step='0.01'
									className='col-span-3'
									{...register('applied_capital')}
								/>
								{errors.applied_capital && (
									<p className='col-span-4 text-right text-sm text-red-500'>{errors.applied_capital.message}</p>
								)}
							</div>
						</div>
						<DialogFooter className='gap-2'>
							<Button type='button' variant='outline' onClick={() => setEditingPayment(null)}>
								Cancel
							</Button>
							<Button type='submit' disabled={updatePaymentMutation.isPending}>
								{updatePaymentMutation.isPending ? 'Saving...' : 'Save'}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	)
}
