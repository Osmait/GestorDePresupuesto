import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
	/** lucide icon of the thing that is missing (PiggyBank for budgets…). */
	icon?: ComponentType<{ className?: string }>
	/** What is empty, as a statement ("No budgets yet"). */
	title: ReactNode
	/** Why it is empty and/or what the action will do. One or two sentences. */
	description?: ReactNode
	/** CTA(s): usually one `<Button>` with a `Plus` icon; a second one `variant='outline'`. */
	action?: ReactNode
	/**
	 * Small version for inside cards and charts (no min-height, smaller icon and
	 * type). Use the default for a page or tab whose whole content is empty.
	 */
	compact?: boolean
	/** Heading element of the title. Default `h2` (full) / `p` (compact). */
	titleAs?: 'h2' | 'h3' | 'p'
	className?: string
}

/**
 * Canonical empty state: icon in a soft muted circle, title, description and
 * an optional CTA. Server-compatible.
 *
 * @example
 * <EmptyState
 *   icon={PiggyBank}
 *   title={t('noBudgets')}
 *   description={t('noBudgetsDescription')}
 *   action={<Button onClick={openCreate}><Plus className='mr-2 h-4 w-4' />{t('createFirstBudget')}</Button>}
 * />
 * // inside a chart card
 * <EmptyState compact icon={BarChart3} title={t('noData')} />
 */
export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	compact = false,
	titleAs,
	className,
}: EmptyStateProps) {
	const Title = titleAs ?? (compact ? 'p' : 'h2')
	return (
		<div
			className={cn(
				'flex flex-col items-center justify-center text-center',
				compact ? 'gap-2 px-4 py-8' : 'min-h-[320px] gap-3 px-4 py-12',
				className,
			)}
		>
			{Icon ? (
				<div className={cn('mb-1 rounded-full bg-muted', compact ? 'p-3' : 'p-4')}>
					<Icon className={cn('text-muted-foreground', compact ? 'h-5 w-5' : 'h-8 w-8')} aria-hidden='true' />
				</div>
			) : null}
			<Title
				className={cn('text-foreground', compact ? 'text-sm font-medium' : 'text-xl font-semibold tracking-tight')}
			>
				{title}
			</Title>
			{description ? (
				<p className={cn('max-w-md text-muted-foreground text-pretty', compact ? 'text-xs' : 'text-sm')}>
					{description}
				</p>
			) : null}
			{action ? (
				<div className={cn('flex flex-wrap items-center justify-center gap-3', compact ? 'mt-2' : 'mt-3')}>
					{action}
				</div>
			) : null}
		</div>
	)
}
