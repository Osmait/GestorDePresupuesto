'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { ApiError, toApiError } from '@/lib/api-error'

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8080'

let cachedFlags: Record<string, boolean> = {}
let hasLoadedFlags = false
let inFlightFlagsRequest: Promise<Record<string, boolean>> | null = null
let cachedToken = ''

export function useFeatureFlags() {
	const { data: session, status } = useSession()
	const accessToken = ((session as any)?.accessToken as string | undefined) || ''
	const [flags, setFlags] = useState<Record<string, boolean>>(cachedFlags)
	const [isLoading, setIsLoading] = useState(!hasLoadedFlags)

	const loadFlags = useCallback(async () => {
		if (accessToken !== cachedToken) {
			cachedToken = accessToken
			cachedFlags = {}
			hasLoadedFlags = false
			inFlightFlagsRequest = null
		}

		if (!accessToken) {
			cachedFlags = {}
			hasLoadedFlags = true
			return cachedFlags
		}

		if (inFlightFlagsRequest) {
			return inFlightFlagsRequest
		}

		inFlightFlagsRequest = (async () => {
			const response = await fetch(`${BASE_URL}/me/features`, {
				headers: { Authorization: `Bearer ${accessToken}` },
			})

			if (!response.ok) {
				throw await toApiError(response, 'Failed to load feature flags')
			}

			const data = await response.json()
			cachedFlags = data?.map || {}
			hasLoadedFlags = true
			return cachedFlags
		})()

		try {
			return await inFlightFlagsRequest
		} finally {
			inFlightFlagsRequest = null
		}
	}, [accessToken])

	const refresh = useCallback(async () => {
		if (status !== 'authenticated') {
			cachedFlags = {}
			hasLoadedFlags = true
			setFlags(cachedFlags)
			setIsLoading(false)
			return
		}

		if (!hasLoadedFlags) {
			setIsLoading(true)
		}
		try {
			const loadedFlags = await loadFlags()
			setFlags(loadedFlags)
		} catch (error) {
			if (error instanceof ApiError) {
				console.warn('[useFeatureFlags] Failed to load feature flags', {
					status: error.status,
					code: error.code,
					requestId: error.requestId,
					message: error.message,
				})
			}
			if (!hasLoadedFlags) {
				hasLoadedFlags = true
				cachedFlags = {}
			}
			setFlags({})
		} finally {
			setIsLoading(false)
		}
	}, [status, loadFlags])

	useEffect(() => {
		void refresh()
	}, [refresh])

	const isEnabled = useCallback((featureKey: string) => !!flags[featureKey], [flags])

	return {
		flags,
		isLoading,
		isEnabled,
		refresh,
	}
}
