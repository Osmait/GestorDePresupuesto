'use client'

import { useState } from 'react'
import { CertificateWithHistory, CertificatePayment, formatCurrency } from '@/types/certificate'
import { useGetCertificate } from '@/hooks/queries/useCertificatesQuery'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CertificateChart } from './CertificateChart'

interface CertificatePaymentHistoryProps {
	certificateId: string | null
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function CertificatePaymentHistory({ certificateId, open, onOpenChange }: CertificatePaymentHistoryProps) {
	const { data: certificate, isLoading } = useGetCertificate(certificateId || '')
	const payments = certificate?.payments ?? []

	if (!certificateId) return null

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Payment History - {certificate?.bank || 'Loading...'}</DialogTitle>
				</DialogHeader>
				{isLoading ? (
					<div className="py-8 text-center text-muted-foreground">Loading...</div>
				) : certificate ? (
					<div className="space-y-4">
						<div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50">
							<div>
								<p className="text-xs text-muted-foreground">Total Gross Interest</p>
								<p className="text-lg font-semibold">{formatCurrency(certificate.summary?.total_gross_interest || 0)}</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">Total Tax Withheld</p>
								<p className="text-lg font-semibold text-orange-500">{formatCurrency(certificate.summary?.total_tax_withheld || 0)}</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">Total Net Interest</p>
								<p className="text-lg font-semibold text-green-500">{formatCurrency(certificate.summary?.total_net_interest || 0)}</p>
							</div>
						</div>

						<Tabs defaultValue="history">
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="history">History</TabsTrigger>
								<TabsTrigger value="chart">Chart</TabsTrigger>
							</TabsList>
							<TabsContent value="history" className="mt-4">
								{payments.length === 0 ? (
									<div className="py-8 text-center text-muted-foreground">No payments recorded yet.</div>
								) : (
									<ScrollArea className="h-[400px]">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Date</TableHead>
													<TableHead className="text-right">Capital</TableHead>
													<TableHead className="text-right">Rate</TableHead>
													<TableHead className="text-right">Gross</TableHead>
													<TableHead className="text-right">Tax</TableHead>
													<TableHead className="text-right">Net</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{payments.map((payment) => (
													<TableRow key={payment.id}>
														<TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
														<TableCell className="text-right">{formatCurrency(payment.applied_capital)}</TableCell>
														<TableCell className="text-right">{payment.applied_rate}%</TableCell>
														<TableCell className="text-right">{formatCurrency(payment.gross_interest)}</TableCell>
														<TableCell className="text-right text-orange-500">-{formatCurrency(payment.tax_withheld)}</TableCell>
														<TableCell className="text-right text-green-500 font-medium">{formatCurrency(payment.net_interest)}</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</ScrollArea>
								)}
							</TabsContent>
							<TabsContent value="chart" className="mt-4">
								<CertificateChart certificate={certificate} payments={payments} />
							</TabsContent>
						</Tabs>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	)
}
