'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Tailwind breakpoints as media queries, so components switch layouts at the
 * same widths as their `md:` / `lg:` classes.
 */
export const BREAKPOINTS = {
	sm: '(min-width: 640px)',
	md: '(min-width: 768px)',
	lg: '(min-width: 1024px)',
	xl: '(min-width: 1280px)',
} as const

function canMatchMedia() {
	return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

/**
 * Subscribes to a CSS media query. Returns `defaultValue` on the server, during
 * hydration and where `matchMedia` is unavailable (jsdom), then the live match.
 *
 * Prefer CSS (`md:hidden`) for pure styling; use this only when the component
 * tree itself differs (e.g. FormDialog renders a Drawer on mobile).
 *
 * @example const isDesktop = useMediaQuery(BREAKPOINTS.md)
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
	const subscribe = useCallback(
		(onChange: () => void) => {
			if (!canMatchMedia()) return () => {}
			const list = window.matchMedia(query)
			list.addEventListener('change', onChange)
			return () => list.removeEventListener('change', onChange)
		},
		[query],
	)
	const getSnapshot = () => (canMatchMedia() ? window.matchMedia(query).matches : defaultValue)
	const getServerSnapshot = () => defaultValue
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
