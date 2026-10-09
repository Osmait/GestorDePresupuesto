'use client'

import { Calculator, Calendar, DollarSign, Landmark, Percent, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { formatCurrency } from '@/lib/utils'
import { Certificate } from '@/types/certificate'

interface CertificateCardProps {
	certificate: Certificate
	onEdit: (certificate: Certificate) => void
	onDelete: (id: string) => void
	onViewHistory: (id: string) => void
	onSimulate: (certificate: Certificate) => void
}

export function CertificateCard({ certificate, onEdit, onDelete, onViewHistory, onSimulate }: CertificateCardProps) {
	const t = useTranslations('certificates')
	const locale = useAppLocale()
	const statusColors = {
		active: 'bg-green-500/10 text-green-500',
		matured: 'bg-blue-500/10 text-blue-500',
		cancelled: 'bg-red-500/10 text-red-500',
	}

	return (
		<Card className='hover:border-primary/50 transition-colors'>
			<CardHeader className='pb-3'>
				<div className='flex flex-wrap items-start justify-between gap-2'>
					<div className='min-w-0 space-y-1'>
						<CardTitle className='text-lg font-semibold flex items-center gap-2'>
							<Landmark className='h-5 w-5 text-primary' />
							{certificate.bank}
						</CardTitle>
						<Badge className={statusColors[certificate.status]}>{t(`status.${certificate.status}`)}</Badge>
					</div>
					<div className='text-right'>
						<p className='text-2xl font-bold'>
							{formatCurrency(certificate.effective_capital, certificate.currency, { locale })}
						</p>
						<p className='text-xs text-muted-foreground'>{t('card.effectiveCapital')}</p>
					</div>
				</div>
			</CardHeader>
			<CardContent className='space-y-4'>
				<div className='grid grid-cols-2 gap-4 text-sm'>
					<div className='flex items-center gap-2'>
						<TrendingUp className='h-4 w-4 text-muted-foreground' />
						<div>
							<p className='text-muted-foreground'>{t('card.interestType')}</p>
							<p className='font-medium'>{t(`interestType.${certificate.interest_type}`)}</p>
						</div>
					</div>
					<div className='flex items-center gap-2'>
						<Percent className='h-4 w-4 text-muted-foreground' />
						<div>
							<p className='text-muted-foreground'>{t('card.rate')}</p>
							<p className='font-medium'>{certificate.current_interest_rate}%</p>
						</div>
					</div>
					<div className='flex items-center gap-2'>
						<Calendar className='h-4 w-4 text-muted-foreground' />
						<div>
							<p className='text-muted-foreground'>{t('card.cutDay')}</p>
							<p className='font-medium'>{t('card.dayValue', { day: certificate.cut_day })}</p>
						</div>
					</div>
					<div className='flex items-center gap-2'>
						<DollarSign className='h-4 w-4 text-muted-foreground' />
						<div>
							<p className='text-muted-foreground'>{t('card.taxRate')}</p>
							<p className='font-medium'>{certificate.current_tax_rate}%</p>
						</div>
					</div>
				</div>

				{certificate.projected_payment && certificate.status === 'active' && (
					<div className='p-3 rounded-lg bg-primary/5 border border-primary/10'>
						<p className='text-xs text-muted-foreground mb-1'>{t('card.nextPaymentProjection')}</p>
						<div className='flex justify-between items-center'>
							<span className='text-sm'>{t('card.netInterest')}</span>
							<span className='font-semibold text-green-500'>
								{formatCurrency(certificate.projected_payment.net_interest, certificate.currency, { locale })}
							</span>
						</div>
						{certificate.next_payment_date && (
							<p className='text-xs text-muted-foreground mt-1'>
								{t('card.expected', { date: formatLocalDate(certificate.next_payment_date, locale) })}
							</p>
						)}
					</div>
				)}

				<div className='flex gap-2 pt-2 flex-wrap'>
					<Button variant='outline' size='sm' onClick={() => onSimulate(certificate)}>
						<Calculator className='h-3 w-3 mr-1' />
						{t('card.simulate')}
					</Button>
					<Button
						variant='outline'
						size='sm'
						onClick={() => onEdit(certificate)}
						disabled={certificate.status === 'cancelled'}
					>
						{t('card.edit')}
					</Button>
					<Button variant='outline' size='sm' onClick={() => onViewHistory(certificate.id)}>
						{t('card.history')}
					</Button>
					<Button
						variant='destructive'
						size='sm'
						onClick={() => onDelete(certificate.id)}
						disabled={certificate.status === 'cancelled'}
					>
						{t('card.cancel')}
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
