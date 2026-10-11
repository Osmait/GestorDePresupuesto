'use client'

import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const progressIndicatorVariants = cva('h-full w-full flex-1 transition-transform duration-500 ease-out', {
	variants: {
		tone: {
			default: 'bg-primary',
			success: 'bg-success',
			warning: 'bg-warning',
			destructive: 'bg-destructive',
			info: 'bg-info',
		},
	},
	defaultVariants: { tone: 'default' },
})

export type ProgressTone = NonNullable<VariantProps<typeof progressIndicatorVariants>['tone']>

export interface ProgressProps
	extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
		VariantProps<typeof progressIndicatorVariants> {
	/** Extra classes for the filled bar (the root gets `className`). */
	indicatorClassName?: string
}

/**
 * Horizontal progress bar (Radix). Renders `role="progressbar"` with
 * aria-valuenow/min/max; give it an `aria-label` (or `aria-labelledby`) that
 * names what is measured. `value` is clamped to [0, max], so an overspent
 * budget (130%) renders a full bar instead of an invalid value: pair it with
 * `tone='destructive'` (see `getProgressTone`). `null`/`undefined` renders an
 * indeterminate bar. `className` styles the track (height defaults to 8px).
 */
const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
	({ className, indicatorClassName, value, max = 100, tone, ...props }, ref) => {
		const clamped = value == null || !Number.isFinite(value) ? null : Math.min(Math.max(value, 0), max)
		const percent = clamped == null ? 0 : (clamped / max) * 100
		return (
			<ProgressPrimitive.Root
				ref={ref}
				value={clamped}
				max={max}
				className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
				{...props}
			>
				<ProgressPrimitive.Indicator
					className={cn(progressIndicatorVariants({ tone }), indicatorClassName)}
					style={{ transform: `translateX(-${100 - percent}%)` }}
				/>
			</ProgressPrimitive.Root>
		)
	},
)
Progress.displayName = ProgressPrimitive.Root.displayName

/**
 * Standard tone for "spent vs limit" bars (budgets, credit utilization,
 * monthly plan): neutral below `warningAt`, warning from `warningAt`,
 * destructive from `dangerAt` (both in percent).
 */
function getProgressTone(percent: number, { warningAt = 80, dangerAt = 100 } = {}): ProgressTone {
	if (percent >= dangerAt) return 'destructive'
	if (percent >= warningAt) return 'warning'
	return 'default'
}

export { Progress, getProgressTone, progressIndicatorVariants }
