import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface PageShellProps extends HTMLAttributes<HTMLDivElement> {}

/**
 * Outer frame of every /app and /admin page: centered container, 16px side
 * gutter, 32px top/bottom, 24px between sections, on the plain app background.
 * The `<main>` landmark comes from the app shell (Sidebar), so this is a div.
 * Server-compatible.
 *
 * @example
 * <PageShell>
 *   <PageHeader title={t('title')} actions={<Button>…</Button>} />
 *   <StatGrid>…</StatGrid>
 * </PageShell>
 */
export function PageShell({ className, ...props }: PageShellProps) {
	return <div className={cn('container mx-auto space-y-6 px-4 py-8', className)} {...props} />
}
