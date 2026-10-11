'use client'

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Amount, resolveAmountTone } from '@/components/shared/Amount'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { cn } from '@/lib/utils'
import { Investment } from '@/types/investment'

interface InvestmentCardProps {
	investment: Investment
	onEdit: (_investment: Investment) => void
	onDelete: (_id: string) => void
}

const PERCENT_TONE_CLASS = {
	positive: 'text-success',
	negative: 'text-destructive',
	warning: 'text-warning',
	neutral: 'text-muted-foreground',
} as const

export function InvestmentCard({ investment, onEdit, onDelete }: InvestmentCardProps) {
	const t = useTranslations('investments.card')
	const tActions = useTranslations('common.actions')
	const formatCurrency = useFormatCurrency()
	const formatPercent = useFormatPercent()
	// Investments are settled in USD unless the position says otherwise.
	const currency = investment.settlement_currency || 'USD'
	const totalValue = investment.quantity * investment.current_price
	const profitLoss = (investment.current_price - investment.purchase_price) * investment.quantity
	const profitLossPercentage =
		investment.purchase_price > 0
			? ((investment.current_price - investment.purchase_price) / investment.purchase_price) * 100
			: null
	const percentTone = resolveAmountTone(profitLoss, 'auto')

	return (
		<Card>
			<CardHeader className='flex flex-row items-start justify-between gap-2 space-y-0 pb-2'>
				<CardTitle className='min-w-0 break-words pt-2 text-sm font-medium'>
					{investment.name} ({investment.symbol})
				</CardTitle>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant='ghost'
							size='icon'
							className='-mr-2 -mt-2 shrink-0 text-muted-foreground'
							aria-label={tActions('rowMenu', { name: investment.name })}
						>
							<MoreHorizontal className='h-4 w-4' aria-hidden='true' />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end'>
						<DropdownMenuItem onSelect={() => onEdit(investment)}>
							<Pencil className='mr-2 h-4 w-4' aria-hidden='true' />
							{tActions('edit')}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={() => onDelete(investment.id)}
							className='text-destructive focus:text-destructive'
						>
							<Trash2 className='mr-2 h-4 w-4' aria-hidden='true' />
							{tActions('delete')}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</CardHeader>
			<CardContent>
				<Amount value={totalValue} currency={currency} className='text-2xl font-semibold tracking-tight' />
				<p className='mt-1 text-xs text-muted-foreground'>
					{t('holding', { quantity: investment.quantity, price: formatCurrency(investment.current_price, currency) })}
				</p>
				<p className='mt-2 flex flex-wrap items-center gap-x-1.5 text-xs font-medium'>
					<Amount value={profitLoss} currency={currency} tone='auto' signed icon />
					{profitLossPercentage !== null ? (
						<span className={cn('tabular-nums', PERCENT_TONE_CLASS[percentTone])}>
							(
							{formatPercent(profitLossPercentage, {
								signDisplay: 'exceptZero',
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})}
							)
						</span>
					) : null}
				</p>
			</CardContent>
		</Card>
	)
}
