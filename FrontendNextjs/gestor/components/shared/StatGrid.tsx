import type { HTMLAttributes } from 'react'
import { StatCard } from '@/components/shared/StatCard'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const COLUMNS_CLASS = {
	2: 'sm:grid-cols-2',
	3: 'sm:grid-cols-2 lg:grid-cols-3',
	4: 'sm:grid-cols-2 lg:grid-cols-4',
	// Five KPIs: three per row on laptops, one row from `xl`.
	5: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
} as const

export type StatGridColumns = keyof typeof COLUMNS_CLASS

export interface StatGridProps extends HTMLAttributes<HTMLDListElement> {
	/** Columns from `lg` up (1 column on mobile, 2 from `sm`; `5` reaches 5 at `xl`). Default 4. */
	columns?: StatGridColumns
}

/**
 * Responsive row of `StatCard`s: 1 column → 2 at `sm` → `columns` at `lg`.
 * Renders a description list (`<dl>`): each StatCard is a `dt` label + `dd`
 * value group, so only put StatCards inside. Server-compatible.
 *
 * @example
 * <StatGrid columns={3}>
 *   <StatCard … />
 *   <StatCard … />
 *   <StatCard … />
 * </StatGrid>
 */
export function StatGrid({ columns = 4, className, ...props }: StatGridProps) {
	return <dl className={cn('grid grid-cols-1 gap-4', COLUMNS_CLASS[columns], className)} {...props} />
}

/**
 * Loading placeholder with the exact frame of a `StatGrid` of `count`
 * StatCards (StatCard's own `loading` state), so the page doesn't shift when
 * the KPIs arrive. Hidden from screen readers; mark the region `aria-busy`.
 *
 * @example
 * if (isLoading) return <StatGridSkeleton count={3} />
 */
export function StatGridSkeleton({ count = 4, className }: { count?: StatGridColumns; className?: string }) {
	return (
		<StatGrid columns={count} aria-hidden='true' className={className}>
			{Array.from({ length: count }, (_, index) => (
				<StatCard
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
					key={index}
					label={<Skeleton className='h-5 w-24' />}
					value={null}
					loading
				/>
			))}
		</StatGrid>
	)
}
