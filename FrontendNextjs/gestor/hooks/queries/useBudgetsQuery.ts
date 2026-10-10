import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getBudgetRepository, getTransactionRepository } from '@/lib/repositoryConfig'

export const BUDGET_KEYS = {
	all: ['budgets'] as const,
	lists: () => [...BUDGET_KEYS.all, 'list'] as const,
	// Under the budgets root: invalidated with every financial mutation (invalidateFinancialData).
	transactionCounts: (budgetIds: string[]) => [...BUDGET_KEYS.all, 'transaction-counts', budgetIds] as const,
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

/**
 * Number of expenses linked to each budget, as `{ [budgetId]: count }`: one
 * single-row request per budget (the count comes from the pagination) instead
 * of downloading every transaction of the user.
 */
export function useBudgetTransactionCounts(budgetIds: string[]) {
	const ids = [...budgetIds].sort()
	return useQuery({
		queryKey: BUDGET_KEYS.transactionCounts(ids),
		queryFn: async () => {
			const repo = await getTransactionRepository()
			const counts = await Promise.all(ids.map((id) => repo.count({ budget_id: id, type: 'bill' })))
			return Object.fromEntries(ids.map((id, index) => [id, counts[index]])) as Record<string, number>
		},
		enabled: ids.length > 0,
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
