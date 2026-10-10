'use client'

import { PiggyBank, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppLocale } from '@/lib/i18n/date-locale'
import { formatCurrency } from '@/lib/utils'
import { CertificateSummary } from '@/types/certificate'

interface CertificateSummaryCardProps {
	summary: CertificateSummary | undefined
}

export function CertificateSummaryCard({ summary }: CertificateSummaryCardProps) {
	const t = useTranslations('certificates.summary')
	const locale = useAppLocale()
	// The summary endpoint aggregates without a currency; amounts are reported in DOP.
	const money = (value: number) => formatCurrency(value, 'DOP', { locale })

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
			key: 'totalCapital',
			title: t('totalCapital'),
			value: money(summary.total_capital),
			icon: Wallet,
			color: 'text-blue-500',
		},
		{
			key: 'netInterestEarned',
			title: t('netInterestEarned'),
			value: money(summary.total_net_interest),
			icon: TrendingUp,
			color: 'text-green-500',
		},
		{
			key: 'taxesWithheld',
			title: t('taxesWithheld'),
			value: money(summary.total_tax_withheld),
			icon: Receipt,
			color: 'text-orange-500',
		},
		{
			key: 'portfolioValue',
			title: t('portfolioValue'),
			value: money(summary.portfolio_value),
			icon: PiggyBank,
			color: 'text-primary',
		},
	]

	return (
		<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
			{cards.map((card) => (
				<Card key={card.key}>
					<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
						<CardTitle className='text-sm font-medium text-muted-foreground'>{card.title}</CardTitle>
						<card.icon className={`h-4 w-4 ${card.color}`} />
					</CardHeader>
					<CardContent>
						<div className='text-2xl font-bold'>{card.value}</div>
						{card.key === 'totalCapital' && (
							<p className='text-xs text-muted-foreground'>
								{t('activeCertificates', { count: summary.active_certificates })}
							</p>
						)}
					</CardContent>
				</Card>
			))}
		</div>
	)
}
