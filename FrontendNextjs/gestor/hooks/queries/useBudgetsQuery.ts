import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getBudgetRepository } from '@/lib/repositoryConfig'

export const BUDGET_KEYS = {
    all: ['budgets'] as const,
    lists: () => [...BUDGET_KEYS.all, 'list'] as const,
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
        mutationFn: async (data: {
            categoryId: string
            amount: number
        }) => {
            const repo = await getBudgetRepository()
            return repo.create(data.categoryId, data.amount)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: BUDGET_KEYS.lists() })
        },
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: BUDGET_KEYS.lists() })
        },
    })
}
