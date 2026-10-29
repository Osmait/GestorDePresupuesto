import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccountRepository } from '@/lib/repositoryConfig'
import type { ReconcileAccountInput } from '@/types/account'
import { invalidateFinancialData } from './invalidateFinancialData'

export const ACCOUNT_KEYS = {
	all: ['accounts'] as const,
	lists: () => [...ACCOUNT_KEYS.all, 'list'] as const,
	detail: (id: string) => [...ACCOUNT_KEYS.all, 'detail', id] as const,
	reconciliations: (id: string) => [...ACCOUNT_KEYS.all, 'reconciliations', id] as const,
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
		mutationFn: async (data: { name: string; bank: string; initial_balance: number }) => {
			const repo = await getAccountRepository()
			return repo.create(data.name, data.bank, data.initial_balance)
		},
		// Lists, details, dashboard totals and transactions (delete cascades) depend on accounts.
		onSuccess: () => invalidateFinancialData(queryClient),
	})
}

// Update Mutation
export function useUpdateAccountMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: { id: string; name: string; bank: string }) => {
			const repo = await getAccountRepository()
			return repo.update(data.id, data.name, data.bank)
		},
		// Lists, details, dashboard totals and transactions (delete cascades) depend on accounts.
		onSuccess: () => invalidateFinancialData(queryClient),
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
		// Lists, details, dashboard totals and transactions (delete cascades) depend on accounts.
		onSuccess: () => invalidateFinancialData(queryClient),
	})
}

export function useGetAccountReconciliations(id: string) {
	return useQuery({
		queryKey: ACCOUNT_KEYS.reconciliations(id),
		queryFn: async () => {
			const repo = await getAccountRepository()
			return repo.findReconciliations(id)
		},
		enabled: !!id,
	})
}

// Reconcile Mutation: may write an adjustment transaction, so balances,
// transaction lists and dashboard totals all change.
export function useReconcileAccountMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: { id: string } & ReconcileAccountInput) => {
			const { id, ...input } = data
			const repo = await getAccountRepository()
			return repo.reconcile(id, input)
		},
		onSuccess: () => invalidateFinancialData(queryClient),
	})
}
