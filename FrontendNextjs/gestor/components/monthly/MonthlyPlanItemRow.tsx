'use client'

import { CalendarClock, Edit, MoreHorizontal, PauseCircle, PlayCircle, Trash } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
import { formatDop } from '@/lib/monthlyPlanUtils'
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
	const isIncome = item.type === 'income'
	const barTone = isIncome ? 'bg-emerald-500' : 'bg-orange-500'

	return (
		<div
			className={`rounded-lg border border-border/50 p-3 transition-opacity ${item.is_active ? '' : 'opacity-50'}`}
			data-testid={`plan-item-${item.id}`}
		>
			<div className='flex items-start justify-between gap-3'>
				<div className='min-w-0'>
					<div className='flex items-center gap-2 flex-wrap'>
						<p className='text-sm font-medium text-foreground truncate'>{item.name}</p>
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
					<div className='flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap'>
						{item.day_of_month ? (
							<span className='flex items-center gap-1'>
								<CalendarClock className='h-3 w-3' />
								{t('dayOfMonth', { day: item.day_of_month })}
							</span>
						) : (
							<span>{t('noFixedDay')}</span>
						)}
						{categoryName && <span>{categoryName}</span>}
					</div>
				</div>

				<div className='flex items-center gap-2 shrink-0'>
					<div className='text-right'>
						<p className={`text-sm font-semibold ${isIncome ? 'text-emerald-600' : 'text-orange-600'}`}>
							{formatDop(item.amount_dop)}
						</p>
						{item.currency === 'USD' && (
							<p className='text-xs text-muted-foreground'>{t('originalAmount', { amount: item.amount.toFixed(2) })}</p>
						)}
					</div>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant='ghost' className='h-8 w-8 p-0'>
								<span className='sr-only'>{t('openMenu')}</span>
								<MoreHorizontal className='h-4 w-4' />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end'>
							<DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
							<DropdownMenuItem onClick={() => onEdit(item)}>
								<Edit className='mr-2 h-4 w-4' /> {t('edit')}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onToggle(item)}>
								{item.is_active ? (
									<>
										<PauseCircle className='mr-2 h-4 w-4' /> {t('pause')}
									</>
								) : (
									<>
										<PlayCircle className='mr-2 h-4 w-4' /> {t('resume')}
									</>
								)}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => onDelete(item)} className='text-destructive'>
								<Trash className='mr-2 h-4 w-4' /> {t('delete')}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{item.is_active && (
				<div className='mt-2 flex items-center gap-2'>
					<div className='h-1.5 flex-1 overflow-hidden rounded-full bg-muted'>
						<div className={`h-full rounded-full ${barTone}`} style={{ width: `${sharePercentage}%` }} />
					</div>
					<span className='text-xs text-muted-foreground w-12 text-right'>{sharePercentage.toFixed(1)}%</span>
				</div>
			)}
		</div>
	)
}
