'use client'

import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useState } from 'react'
import { getFeatureFlagRepository } from '@/lib/repositoryConfig'

let cachedFlags: Record<string, boolean> = {}
let hasLoadedFlags = false
let inFlightFlagsRequest: Promise<Record<string, boolean>> | null = null
let cachedUserId = ''

export function useFeatureFlags() {
	const { data: session, status } = useSession()
	const userId = status === 'authenticated' ? session?.user?.id || '' : ''
	const [flags, setFlags] = useState<Record<string, boolean>>(cachedFlags)
	const [isLoading, setIsLoading] = useState(!hasLoadedFlags)

	const loadFlags = useCallback(async () => {
		if (userId !== cachedUserId) {
			cachedUserId = userId
			cachedFlags = {}
			hasLoadedFlags = false
			inFlightFlagsRequest = null
		}

		if (!userId) {
			cachedFlags = {}
			hasLoadedFlags = true
			return cachedFlags
		}

		if (inFlightFlagsRequest) {
			return inFlightFlagsRequest
		}

		inFlightFlagsRequest = (async () => {
			cachedFlags = await getFeatureFlagRepository().getMyFeatures()
			hasLoadedFlags = true
			return cachedFlags
		})()

		try {
			return await inFlightFlagsRequest
		} finally {
			inFlightFlagsRequest = null
		}
	}, [userId])

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
		} catch {
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
