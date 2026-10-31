import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCategoryRepository } from '@/lib/repositoryConfig'
import { invalidateFinancialData, nonFinancialMutation } from './invalidateFinancialData'

export const CATEGORY_KEYS = {
	all: ['categories'] as const,
	lists: () => [...CATEGORY_KEYS.all, 'list'] as const,
}

// Read Hook
export function useGetCategories() {
	return useQuery({
		queryKey: CATEGORY_KEYS.lists(),
		queryFn: async () => {
			const repo = await getCategoryRepository()
			const data = await repo.findAll()
			// Ensure Newest First (Assuming standard insert order, reverse puts newest top)
			return Array.isArray(data) ? [...data].reverse() : []
		},
	})
}

// Create Mutation
export function useCreateCategoryMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		// A new category is not referenced by anything yet.
		...nonFinancialMutation,
		mutationFn: async (data: { name: string; icon: string; color: string }) => {
			const repo = await getCategoryRepository()
			return repo.create(data.name, data.icon, data.color)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: CATEGORY_KEYS.lists() })
		},
	})
}

// Delete Mutation
export function useDeleteCategoryMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (id: string) => {
			const repo = await getCategoryRepository()
			return repo.delete(id)
		},
		// Recurring rules and plan items drop the deleted category (ON DELETE SET NULL).
		onSuccess: () => {
			void invalidateFinancialData(queryClient)
			queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] })
			queryClient.invalidateQueries({ queryKey: ['monthly-plan'] })
		},
	})
}

// Update Mutation
export function useUpdateCategoryMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: { id: string; name: string; icon: string; color: string }) => {
			const repo = await getCategoryRepository()
			return repo.update(data.id, data.name, data.icon, data.color)
		},
		// Transactions, budgets and the analytics breakdown show the category's name and color.
		onSuccess: () => invalidateFinancialData(queryClient),
	})
}
