import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAccountRepository } from '@/lib/repositoryConfig'
import { Account } from '@/types/account'

export const ACCOUNT_KEYS = {
    all: ['accounts'] as const,
    lists: () => [...ACCOUNT_KEYS.all, 'list'] as const,
    detail: (id: string) => [...ACCOUNT_KEYS.all, 'detail', id] as const,
}

// Read Hook
export function useGetAccounts() {
    return useQuery({
        queryKey: ACCOUNT_KEYS.lists(),
        queryFn: async () => {
            const repo = await getAccountRepository()
            const data = await repo.findAll()
            // Ensure Newest First (Assuming standard insert order, reverse puts newest top)
            return Array.isArray(data) ? [...data].reverse() : []
        },
    })
}

export function useGetAccount(id: string) {
    return useQuery({
        queryKey: ACCOUNT_KEYS.detail(id),
        queryFn: async () => {
            const repo = await getAccountRepository()
            return repo.findById(id)
        },
        enabled: !!id,
    })
}

// Create Mutation
export function useCreateAccountMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: {
            name: string
            bank: string
            initial_balance: number
        }) => {
            const repo = await getAccountRepository()
            return repo.create(data.name, data.bank, data.initial_balance)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ACCOUNT_KEYS.lists() })
        },
    })
}

// Update Mutation
export function useUpdateAccountMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: {
            id: string
            name: string
            bank: string
        }) => {
            const repo = await getAccountRepository()
            return repo.update(data.id, data.name, data.bank)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ACCOUNT_KEYS.lists() })
        },
    })
}

// Delete Mutation
export function useDeleteAccountMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const repo = await getAccountRepository()
            return repo.delete(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ACCOUNT_KEYS.lists() })
        },
    })
}
