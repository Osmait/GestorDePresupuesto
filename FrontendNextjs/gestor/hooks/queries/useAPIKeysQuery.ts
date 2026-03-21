import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAPIKeyRepository } from '@/lib/repositoryConfig'

export const API_KEY_KEYS = {
	all: ['apikeys'] as const,
	lists: () => [...API_KEY_KEYS.all, 'list'] as const,
}

// Read Hook
export function useGetAPIKeys() {
	return useQuery({
		queryKey: API_KEY_KEYS.lists(),
		queryFn: async () => {
			const repo = await getAPIKeyRepository()
			return repo.findAll()
		},
	})
}

// Create Mutation
export function useCreateAPIKeyMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (name: string) => {
			const repo = await getAPIKeyRepository()
			return repo.create(name)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: API_KEY_KEYS.lists() })
		},
	})
}

// Revoke Mutation
export function useRevokeAPIKeyMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (id: string) => {
			const repo = await getAPIKeyRepository()
			return repo.revoke(id)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: API_KEY_KEYS.lists() })
		},
	})
}
