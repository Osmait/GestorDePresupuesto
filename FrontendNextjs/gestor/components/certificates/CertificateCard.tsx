'use client'

import {
	Ban,
	Calculator,
	Calendar,
	History,
	Landmark,
	MoreHorizontal,
	Pencil,
	Percent,
	Receipt,
	TrendingUp,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Amount } from '@/components/shared/Amount'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { Certificate } from '@/types/certificate'

interface CertificateCardProps {
	certificate: Certificate
	onEdit: (certificate: Certificate) => void
	onDelete: (id: string) => void
	onViewHistory: (id: string) => void
	onSimulate: (certificate: Certificate) => void
}

const STATUS_CLASS: Record<Certificate['status'], string> = {
	active: 'border-transparent bg-success/10 text-success',
	matured: 'border-transparent bg-info/10 text-info',
	cancelled: 'border-transparent bg-muted text-muted-foreground',
}

export function CertificateCard({ certificate, onEdit, onDelete, onViewHistory, onSimulate }: CertificateCardProps) {
	const t = useTranslations('certificates')
	const tCommon = useTranslations('common')
	const formatPercent = useFormatPercent()
	const locale = useAppLocale()
	const isCancelled = certificate.status === 'cancelled'

	const details = [
		{
			key: 'interestType',
			icon: TrendingUp,
			label: t('card.interestType'),
			value: t(`interestType.${certificate.interest_type}`),
		},
		{
			key: 'rate',
			icon: Percent,
			label: t('card.rate'),
			value: formatPercent(certificate.current_interest_rate, { maximumFractionDigits: 2 }),
		},
		{ key: 'cutDay', icon: Calendar, label: t('card.cutDay'), value: t('card.dayValue', { day: certificate.cut_day }) },
		{
			key: 'taxRate',
			icon: Receipt,
			label: t('card.taxRate'),
			value: formatPercent(certificate.current_tax_rate, { maximumFractionDigits: 2 }),
		},
	]

	return (
		<Card className='h-full'>
			<CardHeader className='flex flex-row items-start justify-between gap-2 space-y-0 pb-3'>
				<div className='min-w-0 space-y-1.5'>
					<CardTitle className='flex min-w-0 items-center gap-2 text-lg font-semibold'>
						<Landmark className='h-5 w-5 shrink-0 text-muted-foreground' aria-hidden='true' />
						<span className='truncate'>{certificate.bank}</span>
					</CardTitle>
					<Badge variant='outline' className={STATUS_CLASS[certificate.status]}>
						{t(`status.${certificate.status}`)}
					</Badge>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant='ghost'
							size='icon'
							className='-mr-2 -mt-1 shrink-0 text-muted-foreground'
							aria-label={tCommon('actions.rowMenu', { name: certificate.bank })}
						>
							<MoreHorizontal className='h-4 w-4' aria-hidden='true' />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end'>
						<DropdownMenuItem onSelect={() => onViewHistory(certificate.id)}>
							<History className='mr-2 h-4 w-4' aria-hidden='true' />
							{t('card.history')}
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => onSimulate(certificate)}>
							<Calculator className='mr-2 h-4 w-4' aria-hidden='true' />
							{t('card.simulate')}
						</DropdownMenuItem>
						<DropdownMenuItem disabled={isCancelled} onSelect={() => onEdit(certificate)}>
							<Pencil className='mr-2 h-4 w-4' aria-hidden='true' />
							{t('card.edit')}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							disabled={isCancelled}
							onSelect={() => onDelete(certificate.id)}
							className='text-destructive focus:text-destructive'
						>
							<Ban className='mr-2 h-4 w-4' aria-hidden='true' />
							{t('card.cancel')}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</CardHeader>
			<CardContent className='space-y-4'>
				<div>
					<Amount
						value={certificate.effective_capital}
						currency={certificate.currency}
						className='text-2xl font-semibold tracking-tight'
					/>
					<p className='text-xs text-muted-foreground'>{t('card.effectiveCapital')}</p>
				</div>

				<dl className='grid grid-cols-2 gap-4 text-sm'>
					{details.map((item) => (
						<div key={item.key} className='flex items-start gap-2'>
							<item.icon className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' aria-hidden='true' />
							<div className='min-w-0'>
								<dt className='text-muted-foreground'>{item.label}</dt>
								<dd className='font-medium tabular-nums'>{item.value}</dd>
							</div>
						</div>
					))}
				</dl>

				{certificate.projected_payment && certificate.status === 'active' && (
					<div className='rounded-md bg-muted/50 p-3'>
						<p className='mb-1 text-xs text-muted-foreground'>{t('card.nextPaymentProjection')}</p>
						<div className='flex items-center justify-between gap-2'>
							<span className='text-sm'>{t('card.netInterest')}</span>
							<Amount
								value={certificate.projected_payment.net_interest}
								currency={certificate.currency}
								tone='auto'
								className='font-semibold'
							/>
						</div>
						{certificate.next_payment_date && (
							<p className='mt-1 text-xs text-muted-foreground'>
								{t('card.expected', { date: formatLocalDate(certificate.next_payment_date, locale) })}
							</p>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	)
}
