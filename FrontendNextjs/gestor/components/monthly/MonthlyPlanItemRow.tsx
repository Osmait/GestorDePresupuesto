'use client'

import { CalendarClock, Edit, MoreHorizontal, PauseCircle, PlayCircle, Trash } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Amount } from '@/components/shared/Amount'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { PLAN_CURRENCY } from '@/lib/monthlyPlanUtils'
import { cn } from '@/lib/utils'
import { MonthlyPlanItem } from '@/types/monthlyPlan'

interface MonthlyPlanItemRowProps {
	item: MonthlyPlanItem
	categoryName?: string
	/** Share of its own column's total, used for the proportion bar. */
	sharePercentage: number
	onEdit: (_item: MonthlyPlanItem) => void
	onToggle: (_item: MonthlyPlanItem) => void
	onDelete: (_item: MonthlyPlanItem) => void
}

export function MonthlyPlanItemRow({
	item,
	categoryName,
	sharePercentage,
	onEdit,
	onToggle,
	onDelete,
}: MonthlyPlanItemRowProps) {
	const t = useTranslations('monthlyPlan')
	const tCommon = useTranslations('common')
	const formatCurrency = useFormatCurrency()
	const isIncome = item.type === 'income'
	const formatPercent = useFormatPercent()
	const percent = formatPercent(sharePercentage, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

	return (
		<div
			className={cn('rounded-lg border border-border p-3 transition-opacity', !item.is_active && 'opacity-60')}
			data-testid={`plan-item-${item.id}`}
		>
			<div className='flex items-start justify-between gap-3'>
				<div className='min-w-0'>
					<div className='flex flex-wrap items-center gap-2'>
						<p className='truncate text-sm font-medium text-foreground'>{item.name}</p>
						{!item.is_active && (
							<Badge variant='secondary' className='text-xs'>
								{t('paused')}
							</Badge>
						)}
						{item.currency === 'USD' && (
							<Badge variant='outline' className='text-xs'>
								USD
							</Badge>
						)}
					</div>
					<div className='mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
						{item.day_of_month ? (
							<span className='flex items-center gap-1'>
								<CalendarClock className='h-3 w-3' aria-hidden='true' />
								{t('dayOfMonth', { day: item.day_of_month })}
							</span>
						) : (
							<span>{t('noFixedDay')}</span>
						)}
						{categoryName && <span>{categoryName}</span>}
					</div>
				</div>

				<div className='flex shrink-0 items-center gap-1'>
					<div className='text-right'>
						<Amount
							className='text-sm font-semibold'
							value={isIncome ? item.amount_dop : -item.amount_dop}
							currency={PLAN_CURRENCY}
							tone='auto'
							signed
						/>
						{item.currency === 'USD' && (
							<p className='text-xs text-muted-foreground tabular-nums'>
								{t('originalAmount', { amount: formatCurrency(item.amount, item.currency) })}
							</p>
						)}
					</div>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant='ghost' size='icon' aria-label={tCommon('actions.rowMenu', { name: item.name })}>
								<MoreHorizontal className='h-4 w-4' aria-hidden='true' />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end'>
							<DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
							<DropdownMenuItem onClick={() => onEdit(item)}>
								<Edit className='mr-2 h-4 w-4' aria-hidden='true' /> {t('edit')}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onToggle(item)}>
								{item.is_active ? (
									<>
										<PauseCircle className='mr-2 h-4 w-4' aria-hidden='true' /> {t('pause')}
									</>
								) : (
									<>
										<PlayCircle className='mr-2 h-4 w-4' aria-hidden='true' /> {t('resume')}
									</>
								)}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => onDelete(item)} className='text-destructive focus:text-destructive'>
								<Trash className='mr-2 h-4 w-4' aria-hidden='true' /> {t('delete')}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{item.is_active && (
				<div className='mt-2 flex items-center gap-2'>
					<Progress
						className='h-1.5 flex-1'
						value={sharePercentage}
						tone={isIncome ? 'success' : 'default'}
						aria-label={t('shareOfColumn', { name: item.name })}
					/>
					<span className='w-12 text-right text-xs text-muted-foreground tabular-nums'>{percent}</span>
				</div>
			)}
		</div>
	)
}
