import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { getTransactionRepository } from '@/lib/repositoryConfig'
import { TransactionFilters, TypeTransaction } from '@/types/transaction'
import { CATEGORY_KEYS } from './useCategoriesQuery'
import { BUDGET_KEYS } from './useBudgetsQuery'

export const TRANSACTION_KEYS = {
    all: ['transactions'] as const,
    lists: () => [...TRANSACTION_KEYS.all, 'list'] as const,
    list: (filters: TransactionFilters) => [...TRANSACTION_KEYS.lists(), filters] as const,
    simple: () => [...TRANSACTION_KEYS.all, 'simple'] as const,
}

// Read Hook (Filtered/Paginated)
export function useGetTransactions(filters?: TransactionFilters) {
    return useQuery({
        queryKey: TRANSACTION_KEYS.list(filters || {}),
        queryFn: async () => {
            const repo = await getTransactionRepository()
            console.log('[useGetTransactions] Fetching with filters:', filters)
            const response = await repo.findAll(filters)
            return {
                transactions: response.data || [],
                pagination: response.pagination || null
            }
        },
        placeholderData: keepPreviousData
    })
}

// Read Hook (All Simple - for summaries)
export function useGetAllTransactions() {
    return useQuery({
        queryKey: TRANSACTION_KEYS.simple(),
        queryFn: async () => {
            const repo = await getTransactionRepository()
            return repo.findAllSimple()
        },
    })
}

// Create Mutation
export function useCreateTransactionMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: {
            name: string
            description: string
            amount: number
            type: TypeTransaction
            accountId: string
            categoryId: string
            budgetId?: string
        }) => {
            const repo = await getTransactionRepository()
            return repo.create(
                data.name,
                data.description,
                data.amount,
                data.type,
                data.accountId,
                data.categoryId,
                data.budgetId
            )
        },
        onSuccess: () => {
            // Invalidate all transaction lists to force refresh
            queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.lists() })
            // Invalidate categories and budgets to reflect spending changes
            queryClient.invalidateQueries({ queryKey: CATEGORY_KEYS.lists() })
            queryClient.invalidateQueries({ queryKey: BUDGET_KEYS.lists() })
            // Optional: Invalidate account balance queries if they existed
        },
    })
}

// Update Mutation
export function useUpdateTransactionMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: {
            id: string
            name: string
            description: string
            amount: number
            type: TypeTransaction
            accountId: string
            categoryId: string
            budgetId?: string
        }) => {
            const repo = await getTransactionRepository()
            return repo.update(
                data.id,
                data.name,
                data.description,
                data.amount,
                data.type,
                data.accountId,
                data.categoryId,
                data.budgetId
            )
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.lists() })
            queryClient.invalidateQueries({ queryKey: CATEGORY_KEYS.lists() })
            queryClient.invalidateQueries({ queryKey: BUDGET_KEYS.lists() })
        },
    })
}

// Delete Mutation
export function useDeleteTransactionMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const repo = await getTransactionRepository()
            return repo.delete(id)
        },
        onSuccess: () => {
            // Invalidate all transaction lists to force refresh
            queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.lists() })
            queryClient.invalidateQueries({ queryKey: CATEGORY_KEYS.lists() })
            queryClient.invalidateQueries({ queryKey: BUDGET_KEYS.lists() })
        },
    })
}
