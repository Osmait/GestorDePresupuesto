'use client'

import { getProgressTone, Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

/**
 * Spent-vs-limit bar with the standard tone (warning from 80%, destructive
 * from 100%). A client leaf so server components (the dashboard) can render it:
 * `getProgressTone` lives in a client module and can't be called on the server.
 */
export function BudgetProgress({ percent, label, className }: { percent: number; label: string; className?: string }) {
	return <Progress value={percent} tone={getProgressTone(percent)} aria-label={label} className={cn(className)} />
}
