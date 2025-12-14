import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCategoryRepository } from '@/lib/repositoryConfig'

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
        mutationFn: async (data: {
            name: string
            icon: string
            color: string
        }) => {
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CATEGORY_KEYS.lists() })
        },
    })
}
