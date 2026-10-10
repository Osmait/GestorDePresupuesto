import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getTransactionRepository } from '@/lib/repositoryConfig'
import { TransactionFilters, TypeTransaction } from '@/types/transaction'
import { invalidateFinancialData } from './invalidateFinancialData'

export const TRANSACTION_KEYS = {
	all: ['transactions'] as const,
	lists: () => [...TRANSACTION_KEYS.all, 'list'] as const,
	list: (filters: TransactionFilters) => [...TRANSACTION_KEYS.lists(), filters] as const,
	simple: () => [...TRANSACTION_KEYS.all, 'simple'] as const,
}

// Read Hook (Filtered/Paginated)
export function useGetTransactions(filters?: TransactionFilters, options: { enabled?: boolean } = {}) {
	return useQuery({
		enabled: options.enabled ?? true,
		queryKey: TRANSACTION_KEYS.list(filters || {}),
		queryFn: async () => {
			const repo = await getTransactionRepository()
			const response = await repo.findAll(filters)
			return {
				transactions: response.data || [],
				pagination: response.pagination || null,
				summary: response.summary || null,
			}
		},
		placeholderData: keepPreviousData,
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
			currency?: string
			createdAt?: Date
		}) => {
			const repo = await getTransactionRepository()
			return repo.create(
				data.name,
				data.description,
				data.amount,
				data.type,
				data.accountId,
				data.categoryId,
				data.budgetId,
				data.currency,
				data.createdAt,
			)
		},
		// A transaction changes lists, account balances, budget spending and analytics.
		onSuccess: () => invalidateFinancialData(queryClient),
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
			currency?: string
			createdAt?: Date
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
				data.budgetId,
				data.currency,
				data.createdAt,
			)
		},
		// A transaction changes lists, account balances, budget spending and analytics.
		onSuccess: () => invalidateFinancialData(queryClient),
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
		// A transaction changes lists, account balances, budget spending and analytics.
		onSuccess: () => invalidateFinancialData(queryClient),
	})
}
