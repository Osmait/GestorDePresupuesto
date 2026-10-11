import type { ComponentType, ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type StatTone = 'default' | 'positive' | 'negative' | 'warning'

/** Text color per tone. Semantic tokens only (see DESIGN.md > Colors). */
export const STAT_TONE_CLASS: Record<StatTone, string> = {
	default: 'text-foreground',
	positive: 'text-success',
	negative: 'text-destructive',
	warning: 'text-warning',
}

export interface StatCardProps {
	/** What is measured ("Balance total"). */
	label: ReactNode
	/** The figure. Pass `<Amount value={…} currency={…} />` for money. */
	value: ReactNode
	/** Small lucide icon shown top-right in muted ink (decorative). */
	icon?: ComponentType<{ className?: string }>
	/** One short line under the value (period, comparison, count). */
	hint?: ReactNode
	/** Colors the value. Keep `default` unless the sign/state is the point. */
	tone?: StatTone
	/** Shows a skeleton in place of value and hint (and sets `aria-busy`). */
	loading?: boolean
	className?: string
}

/**
 * One KPI in a flat card: label + muted icon on top, value (2xl, tabular
 * figures) and an optional hint below. Put several in a `StatGrid` (a `<dl>`;
 * the card is the `dt` label + `dd` value group).
 * Server-compatible; for an animated figure pass a client value such as
 * `<Amount animate … />`.
 *
 * @example
 * <StatCard label={t('totalBalance')} icon={Wallet} value={<Amount value={total} currency='DOP' />} hint={t('acrossAccounts', { count })} />
 */
export function StatCard({
	label,
	value,
	icon: Icon,
	hint,
	tone = 'default',
	loading = false,
	className,
}: StatCardProps) {
	// A dt/dd group: StatGrid renders the <dl> (outside a StatGrid wrap StatCards in a <dl>).
	return (
		<Card className={cn('p-5', className)} aria-busy={loading || undefined}>
			<dt className='flex items-start justify-between gap-3 text-sm font-medium text-muted-foreground'>
				<div className='min-w-0'>{label}</div>
				{Icon ? <Icon className='h-4 w-4 shrink-0 text-muted-foreground' aria-hidden='true' /> : null}
			</dt>
			{loading ? (
				<dd className='mt-3 space-y-2'>
					<Skeleton className='h-7 w-32' />
					{hint !== undefined ? <Skeleton className='h-3 w-24' /> : null}
				</dd>
			) : (
				<>
					<dd className={cn('mt-2 text-2xl font-semibold tracking-tight tabular-nums', STAT_TONE_CLASS[tone])}>
						{value}
					</dd>
					{hint ? <dd className='mt-1 text-xs text-muted-foreground'>{hint}</dd> : null}
				</>
			)}
		</Card>
	)
}
