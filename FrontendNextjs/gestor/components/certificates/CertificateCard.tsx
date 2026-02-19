'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Certificate, formatCurrency, getInterestTypeLabel, getStatusLabel } from '@/types/certificate'
import { Calendar, Percent, DollarSign, Landmark, TrendingUp, Calculator } from 'lucide-react'

interface CertificateCardProps {
	certificate: Certificate
	onEdit: (certificate: Certificate) => void
	onDelete: (id: string) => void
	onViewHistory: (id: string) => void
	onSimulate: (certificate: Certificate) => void
}

export function CertificateCard({ certificate, onEdit, onDelete, onViewHistory, onSimulate }: CertificateCardProps) {
	const statusColors = {
		active: 'bg-green-500/10 text-green-500',
		matured: 'bg-blue-500/10 text-blue-500',
		cancelled: 'bg-red-500/10 text-red-500',
	}

	return (
		<Card className="hover:border-primary/50 transition-colors">
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<div className="space-y-1">
						<CardTitle className="text-lg font-semibold flex items-center gap-2">
							<Landmark className="h-5 w-5 text-primary" />
							{certificate.bank}
						</CardTitle>
						<Badge className={statusColors[certificate.status]}>{getStatusLabel(certificate.status)}</Badge>
					</div>
					<div className="text-right">
						<p className="text-2xl font-bold">{formatCurrency(certificate.effective_capital, certificate.currency)}</p>
						<p className="text-xs text-muted-foreground">Effective Capital</p>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-2 gap-4 text-sm">
					<div className="flex items-center gap-2">
						<TrendingUp className="h-4 w-4 text-muted-foreground" />
						<div>
							<p className="text-muted-foreground">Interest Type</p>
							<p className="font-medium">{getInterestTypeLabel(certificate.interest_type)}</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Percent className="h-4 w-4 text-muted-foreground" />
						<div>
							<p className="text-muted-foreground">Rate</p>
							<p className="font-medium">{certificate.current_interest_rate}%</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Calendar className="h-4 w-4 text-muted-foreground" />
						<div>
							<p className="text-muted-foreground">Cut Day</p>
							<p className="font-medium">Day {certificate.cut_day}</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<DollarSign className="h-4 w-4 text-muted-foreground" />
						<div>
							<p className="text-muted-foreground">Tax Rate</p>
							<p className="font-medium">{certificate.current_tax_rate}%</p>
						</div>
					</div>
				</div>

				{certificate.projected_payment && certificate.status === 'active' && (
					<div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
						<p className="text-xs text-muted-foreground mb-1">Next Payment Projection</p>
						<div className="flex justify-between items-center">
							<span className="text-sm">Net Interest:</span>
							<span className="font-semibold text-green-500">{formatCurrency(certificate.projected_payment.net_interest, certificate.currency)}</span>
						</div>
						{certificate.next_payment_date && (
							<p className="text-xs text-muted-foreground mt-1">
								Expected: {new Date(certificate.next_payment_date).toLocaleDateString()}
							</p>
						)}
					</div>
				)}

				<div className="flex gap-2 pt-2 flex-wrap">
					<Button variant="outline" size="sm" onClick={() => onSimulate(certificate)}>
						<Calculator className="h-3 w-3 mr-1" />
						Simulate
					</Button>
					<Button variant="outline" size="sm" onClick={() => onEdit(certificate)} disabled={certificate.status === 'cancelled'}>
						Edit
					</Button>
					<Button variant="outline" size="sm" onClick={() => onViewHistory(certificate.id)}>
						History
					</Button>
					<Button variant="destructive" size="sm" onClick={() => onDelete(certificate.id)} disabled={certificate.status === 'cancelled'}>
						Cancel
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
