'use client'

import { Edit, MoreHorizontal, PauseCircle, PlayCircle, Trash } from 'lucide-react'
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
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { PLAN_CURRENCY, signedDop } from '@/lib/monthlyPlanUtils'
import { cn } from '@/lib/utils'
import { MonthlyPlanItem } from '@/types/monthlyPlan'

/** Grid shared by the rows and the ledger's column header, so the columns line up. */
export const LEDGER_ROW_GRID =
	'grid grid-cols-[1.75rem_minmax(0,1fr)_auto_2.5rem] gap-2 sm:grid-cols-[3rem_minmax(0,1fr)_9.5rem_2.5rem] sm:gap-3'

/** Left padding of rows and column header: lines the day up under the group title. */
export const LEDGER_ROW_INSET = 'pl-10 pr-1 sm:pl-12 sm:pr-5'

interface MonthlyPlanItemRowProps {
	item: MonthlyPlanItem
	/** Day it falls on this month (clamped to the month's length), or null. */
	day: number | null
	/** Category shown next to the name when the ledger is not grouped by category. */
	category?: { name: string; color: string }
	onEdit: (_item: MonthlyPlanItem) => void
	onToggle: (_item: MonthlyPlanItem) => void
	onDelete: (_item: MonthlyPlanItem) => void
}

/** One ~44px ledger line: day, name (+ USD original, paused, category), signed DOP amount and the row menu. */
export function MonthlyPlanItemRow({ item, day, category, onEdit, onToggle, onDelete }: MonthlyPlanItemRowProps) {
	const t = useTranslations('monthlyPlan')
	const tCommon = useTranslations('common')
	const formatCurrency = useFormatCurrency()
	const isIncome = item.type === 'income'
	const isPaused = !item.is_active
	const usd = item.currency === 'USD' ? formatCurrency(item.amount, 'USD') : null
	const mobileMeta = [usd, category?.name].filter(Boolean).join(' · ')

	return (
		<li
			className={cn(
				LEDGER_ROW_GRID,
				LEDGER_ROW_INSET,
				'min-h-12 items-center border-t border-border/60 text-sm sm:min-h-11',
				isPaused && 'text-muted-foreground',
			)}
			data-testid={`plan-item-${item.id}`}
		>
			<span className='text-sm font-medium text-muted-foreground tabular-nums'>
				<span aria-hidden='true'>{day ? String(day).padStart(2, '0') : '—'}</span>
				<span className='sr-only'>{day ? t('dayOfMonth', { day }) : t('noFixedDay')}</span>
			</span>

			<div className='min-w-0 py-1.5'>
				<div className='flex min-w-0 items-center gap-2'>
					<span className='truncate font-medium'>{item.name}</span>
					{usd && (
						<Badge
							variant='outline'
							className='hidden shrink-0 rounded-md px-1.5 py-0 text-xs text-muted-foreground tabular-nums sm:inline-flex'
						>
							{usd}
						</Badge>
					)}
					{isPaused && (
						<Badge variant='secondary' className='shrink-0 rounded-md px-1.5 py-0 text-xs text-muted-foreground'>
							{t('paused')}
						</Badge>
					)}
					{category && (
						<span className='hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex'>
							<span aria-hidden='true' className='size-2 rounded-full' style={{ backgroundColor: category.color }} />
							{category.name}
						</span>
					)}
				</div>
				{mobileMeta && <p className='truncate text-xs text-muted-foreground tabular-nums sm:hidden'>{mobileMeta}</p>}
			</div>

			<Amount
				className={cn('justify-end text-right font-medium', isPaused && 'text-muted-foreground line-through')}
				value={signedDop(item)}
				currency={PLAN_CURRENCY}
				tone={isIncome && !isPaused ? 'positive' : 'neutral'}
				signed
			/>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant='ghost'
						size='icon'
						className='text-muted-foreground'
						aria-label={tCommon('actions.rowMenu', { name: item.name })}
					>
						<MoreHorizontal className='h-4 w-4' aria-hidden='true' />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align='end'>
					<DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
					<DropdownMenuItem onSelect={() => onEdit(item)}>
						<Edit className='mr-2 h-4 w-4' aria-hidden='true' /> {t('edit')}
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => onToggle(item)}>
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
					<DropdownMenuItem onSelect={() => onDelete(item)} className='text-destructive focus:text-destructive'>
						<Trash className='mr-2 h-4 w-4' aria-hidden='true' /> {t('delete')}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</li>
	)
}
