'use client'

import { PiggyBank, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CertificateSummary, formatCurrency } from '@/types/certificate'

interface CertificateSummaryCardProps {
	summary: CertificateSummary | undefined
}

export function CertificateSummaryCard({ summary }: CertificateSummaryCardProps) {
	if (!summary) {
		return (
			<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
				{[1, 2, 3, 4].map((i) => (
					<Card key={i} className='animate-pulse'>
						<CardHeader className='pb-2'>
							<div className='h-4 w-24 bg-muted rounded' />
						</CardHeader>
						<CardContent>
							<div className='h-8 w-32 bg-muted rounded' />
						</CardContent>
					</Card>
				))}
			</div>
		)
	}

	const cards = [
		{
			title: 'Total Capital',
			value: formatCurrency(summary.total_capital),
			icon: Wallet,
			color: 'text-blue-500',
		},
		{
			title: 'Net Interest Earned',
			value: formatCurrency(summary.total_net_interest),
			icon: TrendingUp,
			color: 'text-green-500',
		},
		{
			title: 'Taxes Withheld',
			value: formatCurrency(summary.total_tax_withheld),
			icon: Receipt,
			color: 'text-orange-500',
		},
		{
			title: 'Portfolio Value',
			value: formatCurrency(summary.portfolio_value),
			icon: PiggyBank,
			color: 'text-primary',
		},
	]

	return (
		<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
			{cards.map((card) => (
				<Card key={card.title}>
					<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
						<CardTitle className='text-sm font-medium text-muted-foreground'>{card.title}</CardTitle>
						<card.icon className={`h-4 w-4 ${card.color}`} />
					</CardHeader>
					<CardContent>
						<div className='text-2xl font-bold'>{card.value}</div>
						{card.title === 'Total Capital' && (
							<p className='text-xs text-muted-foreground'>{summary.active_certificates} active certificates</p>
						)}
					</CardContent>
				</Card>
			))}
		</div>
	)
}
