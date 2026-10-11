import type { HTMLAttributes, ReactNode } from 'react'
import { STAT_TONE_CLASS, type StatTone } from '@/components/shared/StatCard'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface StatStripProps {
	/** Accessible name of the region ("Plan summary"). */
	label: string
	/** `StatStripItem`s (2 per row on mobile, all in one row from `lg`). */
	children: ReactNode
	/** One muted caption under the figures (a rate, a source, a date). */
	footer?: ReactNode
	className?: string
}

/**
 * Compact KPI strip: several figures in ONE flat card instead of a `StatGrid`
 * of separate cards. Use it when the KPIs frame the page's real content (a
 * ledger, a list) rather than being the content. 2×2 on mobile, one row from
 * `lg`. Renders a `<section>` with a `<dl>`; each `StatStripItem` is a
 * `dt` + `dd` group. Server-compatible.
 *
 * @example
 * <StatStrip label={t('summaryTitle')} footer={t('rateNote', { rate })}>
 *   <StatStripItem label={t('income')} tone='positive' value={<Amount value={income} />} hint={t('incomeHint', { count })} />
 *   <StatStripItem label={t('expenses')} value={<Amount value={expenses} />} />
 * </StatStrip>
 */
export function StatStrip({ label, children, footer, className }: StatStripProps) {
	return (
		<section aria-label={label} className={className}>
			<Card className='px-4 py-3.5 sm:px-6 sm:py-5'>
				<dl className='grid grid-cols-2 gap-x-4 gap-y-3 sm:gap-x-8 sm:gap-y-5 lg:grid-cols-4'>{children}</dl>
				{footer ? <p className='mt-3 text-xs text-muted-foreground sm:mt-4'>{footer}</p> : null}
			</Card>
		</section>
	)
}

export interface StatStripItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
	label: ReactNode
	/** The figure. Pass `<Amount … />` for money. */
	value: ReactNode
	/** One short line (or a `Progress`) under the value. */
	hint?: ReactNode
	/** Colors the value (same tones as `StatCard`). */
	tone?: StatTone
	loading?: boolean
}

/** One figure of a `StatStrip`: muted label, value (tabular figures) and an optional hint. */
export function StatStripItem({
	label,
	value,
	hint,
	tone = 'default',
	loading = false,
	className,
	...props
}: StatStripItemProps) {
	return (
		<div className={cn('min-w-0', className)} aria-busy={loading || undefined} {...props}>
			<dt className='text-xs font-medium text-muted-foreground sm:text-sm'>{label}</dt>
			{loading ? (
				<dd className='mt-1.5'>
					<Skeleton className='h-6 w-28' />
				</dd>
			) : (
				<>
					<dd
						className={cn(
							'mt-0.5 truncate text-base font-semibold tracking-tight tabular-nums sm:mt-1 sm:text-xl',
							STAT_TONE_CLASS[tone],
						)}
					>
						{value}
					</dd>
					{hint ? <dd className='mt-0.5 text-xs text-muted-foreground'>{hint}</dd> : null}
				</>
			)}
		</div>
	)
}
