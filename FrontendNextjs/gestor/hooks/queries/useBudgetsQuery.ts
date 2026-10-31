import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAppMonthRangeStrings } from '@/lib/app-time'
import { getBudgetRepository, getTransactionRepository } from '@/lib/repositoryConfig'

export const BUDGET_KEYS = {
	all: ['budgets'] as const,
	lists: () => [...BUDGET_KEYS.all, 'list'] as const,
	// Under the budgets root: invalidated with every financial mutation (invalidateFinancialData).
	transactionCounts: (budgetKeys: string[]) => [...BUDGET_KEYS.all, 'transaction-counts', budgetKeys] as const,
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
 * Number of expenses behind each budget's spending, as `{ [budgetId]: count }`:
 * the bills of its category this month (app time zone), the same ones the API
 * sums into the budget's spent amount (not the budget_id stamped on each bill,
 * which misses bills written before the budget existed). One single-row
 * request per category (the count comes from the pagination) instead of
 * downloading every transaction of the user.
 */
export function useBudgetTransactionCounts(budgets: { id: string; category_id: string }[]) {
	const sorted = [...budgets].sort((a, b) => a.id.localeCompare(b.id))
	const { from, to } = getAppMonthRangeStrings()
	const keys = sorted.map((budget) => `${budget.id}:${budget.category_id}`)
	return useQuery({
		queryKey: [...BUDGET_KEYS.transactionCounts(keys), from],
		queryFn: async () => {
			const repo = await getTransactionRepository()
			const categoryIds = [...new Set(sorted.map((budget) => budget.category_id))]
			const counts = await Promise.all(
				categoryIds.map((categoryId) =>
					repo.count({ category_id: categoryId, type: 'bill', date_from: from, date_to: to }),
				),
			)
			const byCategory = new Map(categoryIds.map((categoryId, index) => [categoryId, counts[index]]))
			return Object.fromEntries(sorted.map((budget) => [budget.id, byCategory.get(budget.category_id) ?? 0])) as Record<
				string,
				number
			>
		},
		enabled: sorted.length > 0,
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
