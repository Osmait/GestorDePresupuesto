import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RecurringTransactionRepository } from '@/app/repository/recurringTransactionRepository'
import { RecurringTransactionRequest } from '@/types/recurringTransaction'
import { invalidateFinancialData, nonFinancialMutation } from './invalidateFinancialData'

const recurringRepo = new RecurringTransactionRepository()

export const useRecurringTransactionsQuery = () => {
	return useQuery({
		queryKey: ['recurring-transactions'],
		queryFn: () => recurringRepo.findAll(),
		staleTime: 5 * 60 * 1000, // 5 minutes
	})
}

export const useCreateRecurringTransactionMutation = () => {
	const queryClient = useQueryClient()
	return useMutation({
		// Rules only: transactions are written when they are processed.
		...nonFinancialMutation,
		mutationFn: (data: RecurringTransactionRequest) => recurringRepo.create(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] })
		},
	})
}

export const useUpdateRecurringTransactionMutation = () => {
	const queryClient = useQueryClient()
	return useMutation({
		// Rules only: transactions are written when they are processed.
		...nonFinancialMutation,
		mutationFn: ({ id, data }: { id: string; data: RecurringTransactionRequest }) => recurringRepo.update(id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] })
		},
	})
}

export const useDeleteRecurringTransactionMutation = () => {
	const queryClient = useQueryClient()
	return useMutation({
		// Rules only: transactions are written when they are processed.
		...nonFinancialMutation,
		mutationFn: (id: string) => recurringRepo.delete(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] })
		},
	})
}

export const useProcessRecurringTransactionsMutation = () => {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: () => recurringRepo.process(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] })
			void invalidateFinancialData(queryClient)
		},
	})
}
