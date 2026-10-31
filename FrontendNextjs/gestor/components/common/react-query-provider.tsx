'use client'

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/**
 * Mutation options for read-only "mutations" (AI suggestions, analyses,
 * previews): they change nothing the server-rendered pages show, so they
 * must not trigger the router refresh below (on the dashboard a refresh is
 * six backend calls).
 */
export const readOnlyMutation = { meta: { refresh: false } } as const

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
	const router = useRouter()
	const routerRef = useRef(router)
	useEffect(() => {
		routerRef.current = router
	}, [router])

	const [queryClient] = useState(() => {
		// Server-rendered pages (the dashboard) stay in the client router cache for
		// `experimental.staleTimes.dynamic` seconds. A successful write anywhere
		// purges that cache (router.refresh), so navigating back never shows
		// pre-mutation totals. Several mutations in one tick share one refresh.
		// Mutations marked `meta: { refresh: false }` (readOnlyMutation) skip it.
		let refreshScheduled = false
		const refreshServerData = () => {
			if (refreshScheduled) return
			refreshScheduled = true
			setTimeout(() => {
				refreshScheduled = false
				routerRef.current.refresh?.()
			}, 0)
		}

		return new QueryClient({
			mutationCache: new MutationCache({
				onSuccess: (_data, _variables, _context, mutation) => {
					if (mutation.meta?.refresh === false) return
					refreshServerData()
				},
			}),
			defaultOptions: {
				queries: {
					// Data is considered fresh for 5 minutes
					staleTime: 5 * 60 * 1000,
					// Retry failed queries once
					retry: 1,
					// Do not refetch on window focus by default (optional, user preference)
					refetchOnWindowFocus: false,
				},
			},
		})
	})

	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
