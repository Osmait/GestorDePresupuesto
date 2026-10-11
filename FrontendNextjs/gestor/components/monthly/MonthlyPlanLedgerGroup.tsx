'use client'

import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { Amount } from '@/components/shared/Amount'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { PLAN_CURRENCY } from '@/lib/monthlyPlanUtils'
import { cn } from '@/lib/utils'

interface MonthlyPlanLedgerGroupProps {
	/** DOM id prefix (unique on the page). */
	id: string
	/** Stable group key, exposed as `data-testid="plan-group-<key>"`. */
	testId: string
	title: string
	/** CSS color of the dot and the share bar (a user category color or a token var). */
	color: string
	count: number
	/** Share of the active fixed expenses, in percent; omitted for groups where it means nothing. */
	share?: number
	/** Signed subtotal of the group's active items. */
	subtotal: number
	open: boolean
	onToggle: () => void
	/** "This week" marker. */
	isCurrent?: boolean
	/** The rows (`MonthlyPlanItemRow`s). */
	children: ReactNode
}

/**
 * One collapsible group of the ledger: a heading button (aria-expanded) with
 * chevron, color dot, title, count, share bar and signed subtotal, then its rows.
 */
export function MonthlyPlanLedgerGroup({
	id,
	testId,
	title,
	color,
	count,
	share,
	subtotal,
	open,
	onToggle,
	isCurrent = false,
	children,
}: MonthlyPlanLedgerGroupProps) {
	const t = useTranslations('monthlyPlan')
	const formatPercent = useFormatPercent()
	const percent =
		share === undefined ? null : formatPercent(share, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
	const listId = `${id}-items`

	return (
		<div className='border-b border-border' data-testid={`plan-group-${testId}`}>
			<h3 className='text-sm font-normal'>
				<button
					type='button'
					aria-expanded={open}
					aria-controls={open ? listId : undefined}
					onClick={onToggle}
					className='flex min-h-13 w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:min-h-12 sm:gap-3 sm:px-5'
				>
					<ChevronDown
						className={cn(
							'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out motion-reduce:transition-none',
							!open && '-rotate-90',
						)}
						aria-hidden='true'
					/>
					<span aria-hidden='true' className='size-2.5 shrink-0 rounded-full' style={{ backgroundColor: color }} />
					<span className='min-w-0 flex-1 sm:flex sm:items-center sm:gap-3'>
						<span className='flex min-w-0 items-center gap-2'>
							<span className='truncate font-semibold'>{title}</span>
							{isCurrent && (
								<span className='shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold leading-none text-primary-foreground'>
									{t('thisWeek')}
								</span>
							)}
						</span>
						<span className='block shrink-0 text-xs text-muted-foreground'>
							{t('groupCount', { count })}
							{percent && <span className='sm:hidden'> · {t('groupShare', { percent })}</span>}
						</span>
					</span>
					{percent && (
						<span className='hidden shrink-0 items-center gap-3.5 sm:flex'>
							{/* Decorative (the percentage next to it is the text); spans because a button only takes phrasing content. */}
							<span aria-hidden='true' className='block h-1.5 w-24 overflow-hidden rounded-full bg-secondary'>
								<span
									className='block h-full rounded-full'
									style={{ width: `${Math.min(share ?? 0, 100)}%`, backgroundColor: color }}
								/>
							</span>
							<span className='w-12 text-right text-xs text-muted-foreground tabular-nums'>{percent}</span>
						</span>
					)}
					<Amount
						className='shrink-0 justify-end text-right font-semibold sm:w-36'
						value={subtotal}
						currency={PLAN_CURRENCY}
						tone={subtotal > 0 ? 'positive' : 'neutral'}
						signed
					/>
				</button>
			</h3>
			{open && (
				<ul id={listId} className='pb-1'>
					{children}
				</ul>
			)}
		</div>
	)
}
