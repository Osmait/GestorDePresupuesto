'use client'

import { AlertTriangle, RotateCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ErrorStateProps {
	/** Defaults to `common.error.title` ("Something went wrong"). */
	title?: ReactNode
	/** Defaults to `common.error.description` (problem + recovery). Never show raw error messages. */
	description?: ReactNode
	/** Shows a "Try again" button; pass the query's `refetch` (or `reset` in error.tsx). */
	onRetry?: () => void
	/** Overrides the retry button label (`common.error.retry`). */
	retryLabel?: ReactNode
	/** Secondary action next to retry, e.g. a link back to the dashboard. */
	action?: ReactNode
	/** Small version for inside a card/chart. */
	compact?: boolean
	className?: string
}

/**
 * Failed-to-load state: warning icon in a soft destructive circle, title,
 * description and a retry button. Use it wherever a query can fail
 * (`isError`) instead of an empty list or a toast-only error.
 *
 * @example
 * if (isError) return <ErrorState onRetry={() => refetch()} />
 */
export function ErrorState({
	title,
	description,
	onRetry,
	retryLabel,
	action,
	compact = false,
	className,
}: ErrorStateProps) {
	const t = useTranslations('common.error')
	const Title = compact ? 'p' : 'h2'
	return (
		<div
			className={cn(
				'flex flex-col items-center justify-center text-center',
				compact ? 'gap-2 px-4 py-8' : 'min-h-[320px] gap-3 px-4 py-12',
				className,
			)}
		>
			<div className={cn('mb-1 rounded-full bg-destructive/10', compact ? 'p-3' : 'p-4')}>
				<AlertTriangle className={cn('text-destructive', compact ? 'h-5 w-5' : 'h-8 w-8')} aria-hidden='true' />
			</div>
			{/* Only the message is announced; the retry button isn't part of the alert. */}
			<div role='alert' className={cn('flex flex-col items-center', compact ? 'gap-2' : 'gap-3')}>
				<Title
					className={cn('text-foreground', compact ? 'text-sm font-medium' : 'text-xl font-semibold tracking-tight')}
				>
					{title ?? t('title')}
				</Title>
				<p className={cn('max-w-md text-muted-foreground text-pretty', compact ? 'text-xs' : 'text-sm')}>
					{description ?? t('description')}
				</p>
			</div>
			{onRetry || action ? (
				<div className={cn('flex flex-wrap items-center justify-center gap-3', compact ? 'mt-2' : 'mt-3')}>
					{onRetry ? (
						<Button type='button' variant='outline' size={compact ? 'sm' : 'default'} onClick={onRetry}>
							<RotateCw className='mr-2 h-4 w-4' aria-hidden='true' />
							{retryLabel ?? t('retry')}
						</Button>
					) : null}
					{action}
				</div>
			) : null}
		</div>
	)
}
