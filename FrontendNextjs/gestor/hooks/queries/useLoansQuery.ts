import { type QueryClient, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getLoanRepository } from '@/lib/repositoryConfig'
import type { CreateLoanDTO, Loan, RegisterLoanPaymentDTO } from '@/types/loan'
import { invalidateFinancialData } from './invalidateFinancialData'

export const LOAN_KEYS = {
	all: ['loans'] as const,
	lists: () => [...LOAN_KEYS.all, 'list'] as const,
	summary: () => [...LOAN_KEYS.all, 'summary'] as const,
	detail: (id: string) => [...LOAN_KEYS.all, 'detail', id] as const,
}

export function useGetLoans() {
	return useQuery({
		queryKey: LOAN_KEYS.lists(),
		queryFn: async () => (await getLoanRepository().findAll()) ?? [],
	})
}

export function useGetLoanSummary() {
	return useQuery({
		queryKey: LOAN_KEYS.summary(),
		queryFn: async () => (await getLoanRepository().getSummary()) ?? null,
	})
}

/** A loan with its installments and every payment (GET /loan/:id returns them all). */
export function loanDetailsQueryOptions(id: string) {
	return queryOptions({
		queryKey: LOAN_KEYS.detail(id),
		queryFn: () => getLoanRepository().findById(id),
	})
}

export function useGetLoanDetails(id: string) {
	return useQuery({ ...loanDetailsQueryOptions(id), enabled: !!id })
}

/**
 * Loan writes move money (the principal leaves an account, payments enter one) and
 * write transactions, so every balance-derived view goes stale along with the loans.
 */
function invalidateLoanData(queryClient: QueryClient) {
	return Promise.all([invalidateFinancialData(queryClient), queryClient.invalidateQueries({ queryKey: LOAN_KEYS.all })])
}

export function useCreateLoanMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (data: CreateLoanDTO) => getLoanRepository().create(data),
		onSuccess: () => invalidateLoanData(queryClient),
	})
}

export function useRegisterLoanPaymentMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ loanId, data }: { loanId: string; data: RegisterLoanPaymentDTO }) =>
			getLoanRepository().registerPayment(loanId, data),
		onSuccess: () => invalidateLoanData(queryClient),
	})
}

export function useCancelLoanMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (loanId: string) => getLoanRepository().cancelLoan(loanId),
		onSuccess: () => invalidateLoanData(queryClient),
	})
}

export function useUpdateLoanStatusMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ loanId, status }: { loanId: string; status: Loan['status'] }) =>
			getLoanRepository().updateStatus(loanId, status),
		onSuccess: () => invalidateLoanData(queryClient),
	})
}
