'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useCallback } from 'react'
import { getFeatureFlagRepository } from '@/lib/repositoryConfig'

export const FEATURE_FLAG_KEYS = {
	all: ['featureFlags'] as const,
	mine: (userId: string) => [...FEATURE_FLAG_KEYS.all, 'me', userId] as const,
}

/** Flags change rarely (admin action); every component using the hook shares one cached request. */
const FEATURE_FLAGS_STALE_TIME_MS = 5 * 60 * 1000

const NO_FLAGS: Record<string, boolean> = {}

export function useFeatureFlags() {
	const { data: session, status } = useSession()
	const userId = status === 'authenticated' ? session?.user?.id || '' : ''

	const query = useQuery({
		queryKey: FEATURE_FLAG_KEYS.mine(userId),
		queryFn: () => getFeatureFlagRepository().getMyFeatures(),
		enabled: !!userId,
		staleTime: FEATURE_FLAGS_STALE_TIME_MS,
	})

	const flags = (userId && query.data) || NO_FLAGS
	// Unknown until the session is resolved and, for a signed-in user, the first answer arrived.
	const isLoading = status === 'loading' || (!!userId && query.isPending)

	const isEnabled = useCallback((featureKey: string) => !!flags[featureKey], [flags])
	const { refetch } = query
	const refresh = useCallback(async () => {
		if (userId) await refetch()
	}, [userId, refetch])

	return {
		flags,
		isLoading,
		isEnabled,
		refresh,
	}
}
