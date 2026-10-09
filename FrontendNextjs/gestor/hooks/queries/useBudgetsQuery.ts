import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getBudgetRepository } from '@/lib/repositoryConfig'

export const BUDGET_KEYS = {
	all: ['budgets'] as const,
	lists: () => [...BUDGET_KEYS.all, 'list'] as const,
}

/** Budgets feed the budget list and the analytics "budget vs actual" view. */
function invalidateBudgetData(queryClient: QueryClient) {
	return Promise.all([
		queryClient.invalidateQueries({ queryKey: BUDGET_KEYS.all }),
		queryClient.invalidateQueries({ queryKey: ['analytics'] }),
	])
}

// Read Hook
export function useGetBudgets() {
	return useQuery({
		queryKey: BUDGET_KEYS.lists(),
		queryFn: async () => {
			const repo = await getBudgetRepository()
			const data = await repo.findAll()
			// Newest First (Reverse)
			return Array.isArray(data) ? [...data].reverse() : []
		},
	})
}

// Create Mutation
export function useCreateBudgetMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: { categoryId: string; amount: number }) => {
			const repo = await getBudgetRepository()
			return repo.create(data.categoryId, data.amount)
		},
		onSuccess: () => invalidateBudgetData(queryClient),
	})
}

// Delete Mutation
export function useDeleteBudgetMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (id: string) => {
			const repo = await getBudgetRepository()
			return repo.delete(id)
		},
		onSuccess: () => invalidateBudgetData(queryClient),
	})
}

// Update Mutation
export function useUpdateBudgetMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: {
			id: string // Add ID for update
			categoryId: string
			amount: number
		}) => {
			const repo = await getBudgetRepository()
			return repo.update(data.id, data.categoryId, data.amount)
		},
		onSuccess: () => invalidateBudgetData(queryClient),
	})
}
