import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageHeaderProps {
	/** Plain section name ("Cuentas", not "Gestión de Cuentas"). Rendered as the page's only h1. */
	title: ReactNode
	/** One sentence under the title, muted. */
	description?: ReactNode
	/**
	 * Page-level actions (primary create button last). Below `sm` they sit under
	 * the title and share the full width (each direct child grows); from `sm` up
	 * they keep their natural width on the right. Don't add `w-full`/`flex-1`
	 * classes to the buttons yourself.
	 */
	actions?: ReactNode
	/** id of the actions container (e.g. an anchor for the demo tour). */
	actionsId?: string
	/** Optional element before the title block, e.g. a back button on detail pages. */
	leading?: ReactNode
	className?: string
}

/**
 * The page's title row: h1 + optional description on the left, actions on the
 * right (under the title on mobile). The app top bar only shows a small section
 * label, so this is the one prominent title on the page. Server-compatible.
 *
 * @example
 * <PageHeader
 *   title={t('title')}
 *   description={t('subtitle')}
 *   actions={<Button onClick={openCreate}><Plus className='mr-2 h-4 w-4' />{t('new')}</Button>}
 * />
 */
export function PageHeader({ title, description, actions, actionsId, leading, className }: PageHeaderProps) {
	return (
		<div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
			<div className='flex min-w-0 items-start gap-3'>
				{leading ? <div className='shrink-0'>{leading}</div> : null}
				<div className='min-w-0 space-y-1'>
					<h1 className='text-3xl font-bold tracking-tight text-balance'>{title}</h1>
					{description ? <p className='text-muted-foreground'>{description}</p> : null}
				</div>
			</div>
			{actions ? (
				<div
					id={actionsId}
					className='flex flex-wrap items-center gap-2 *:flex-1 sm:shrink-0 sm:justify-end sm:*:flex-none'
				>
					{actions}
				</div>
			) : null}
		</div>
	)
}
