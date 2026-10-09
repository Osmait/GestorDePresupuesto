'use client'

import { Edit, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppLocale } from '@/lib/i18n/date-locale'
import { formatCurrency } from '@/lib/utils'
import { Investment } from '@/types/investment'

interface InvestmentCardProps {
	investment: Investment
	onEdit: (_investment: Investment) => void
	onDelete: (_id: string) => void
}

export function InvestmentCard({ investment, onEdit, onDelete }: InvestmentCardProps) {
	const t = useTranslations('investments.card')
	const locale = useAppLocale()
	const currency = investment.settlement_currency || 'USD'
	const money = (value: number) => formatCurrency(value, currency, { locale })
	const totalValue = investment.quantity * investment.current_price
	const profitLoss = (investment.current_price - investment.purchase_price) * investment.quantity
	const profitLossPercentage =
		((investment.current_price - investment.purchase_price) / investment.purchase_price) * 100

	return (
		<Card>
			<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
				<CardTitle className='text-sm font-medium'>
					{investment.name} ({investment.symbol})
				</CardTitle>
				<div className='flex space-x-2'>
					<Button
						variant='ghost'
						size='icon'
						className='h-8 w-8'
						aria-label={t('edit', { name: investment.name })}
						onClick={() => onEdit(investment)}
					>
						<Edit className='h-4 w-4' />
					</Button>
					<Button
						variant='ghost'
						size='icon'
						className='h-8 w-8 text-destructive'
						aria-label={t('delete', { name: investment.name })}
						onClick={() => onDelete(investment.id)}
					>
						<Trash2 className='h-4 w-4' />
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				<div className='text-2xl font-bold'>{money(totalValue)}</div>
				<div className='text-xs text-muted-foreground mt-1'>
					{t('holding', { quantity: investment.quantity, price: money(investment.current_price) })}
				</div>
				<div className={`text-xs mt-2 font-medium ${profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
					{formatCurrency(profitLoss, currency, { locale, signDisplay: 'exceptZero' })} (
					{profitLossPercentage.toFixed(2)}%)
				</div>
			</CardContent>
		</Card>
	)
}
