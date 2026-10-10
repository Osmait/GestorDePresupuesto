'use client'

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

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
			mutationCache: new MutationCache({ onSuccess: refreshServerData }),
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
