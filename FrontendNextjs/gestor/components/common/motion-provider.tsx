'use client'

import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * App-wide Motion config: honors the OS "reduce motion" setting for
 * every `motion`/`m` component (transform and layout animations are skipped,
 * opacity still fades). Components don't need their own reduced-motion checks
 * for framer animations; non-framer counters use `useReducedMotion()`.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
	return <MotionConfig reducedMotion='user'>{children}</MotionConfig>
}
