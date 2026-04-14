import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCreditCardRepository } from '@/lib/repositoryConfig'
import { CreateCreditCardDTO, CreatePaymentDTO } from '@/types/creditcard'
import { ACCOUNT_KEYS } from './useAccountsQuery'

export const CREDIT_CARD_KEYS = {
	all: ['credit-cards'] as const,
	lists: () => [...CREDIT_CARD_KEYS.all, 'list'] as const,
	detail: (id: string) => [...CREDIT_CARD_KEYS.all, 'detail', id] as const,
	summary: () => [...CREDIT_CARD_KEYS.all, 'summary'] as const,
	payments: (cardId: string) => [...CREDIT_CARD_KEYS.all, 'payments', cardId] as const,
}

export function useGetCreditCards() {
	return useQuery({
		queryKey: CREDIT_CARD_KEYS.lists(),
		queryFn: async () => {
			const repo = await getCreditCardRepository()
			return repo.findAll()
		},
	})
}

export function useGetCreditCard(id: string) {
	return useQuery({
		queryKey: CREDIT_CARD_KEYS.detail(id),
		queryFn: async () => {
			const repo = await getCreditCardRepository()
			return repo.findById(id)
		},
		enabled: !!id,
	})
}

export function useGetCreditCardSummary() {
	return useQuery({
		queryKey: CREDIT_CARD_KEYS.summary(),
		queryFn: async () => {
			const repo = await getCreditCardRepository()
			return repo.getSummary()
		},
	})
}

export function useGetCardPayments(cardId: string) {
	return useQuery({
		queryKey: CREDIT_CARD_KEYS.payments(cardId),
		queryFn: async () => {
			const repo = await getCreditCardRepository()
			return repo.getPayments(cardId)
		},
		enabled: !!cardId,
	})
}

export function useCreateCreditCardMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: CreateCreditCardDTO) => {
			const repo = await getCreditCardRepository()
			return repo.create(data)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: CREDIT_CARD_KEYS.lists() })
			queryClient.invalidateQueries({ queryKey: CREDIT_CARD_KEYS.summary() })
		},
	})
}

export function useUpdateCreditCardMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({ id, data }: { id: string; data: CreateCreditCardDTO }) => {
			const repo = await getCreditCardRepository()
			return repo.update(id, data)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: CREDIT_CARD_KEYS.lists() })
			queryClient.invalidateQueries({ queryKey: CREDIT_CARD_KEYS.summary() })
		},
	})
}

export function useDeleteCreditCardMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (id: string) => {
			const repo = await getCreditCardRepository()
			return repo.delete(id)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: CREDIT_CARD_KEYS.lists() })
			queryClient.invalidateQueries({ queryKey: CREDIT_CARD_KEYS.summary() })
		},
	})
}

export function useResetCardBalanceMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			cardId,
			balanceId,
			currency,
			notes,
		}: {
			cardId: string
			balanceId?: string
			currency?: string
			notes?: string
		}) => {
			const repo = await getCreditCardRepository()
			return repo.resetBalance(cardId, { balance_id: balanceId, currency, notes })
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: CREDIT_CARD_KEYS.lists() })
			queryClient.invalidateQueries({ queryKey: CREDIT_CARD_KEYS.summary() })
			queryClient.invalidateQueries({ queryKey: CREDIT_CARD_KEYS.detail(variables.cardId) })
		},
	})
}

export function useCreatePaymentMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({ cardId, data }: { cardId: string; data: CreatePaymentDTO }) => {
			const repo = await getCreditCardRepository()
			return repo.createPayment(cardId, data)
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: CREDIT_CARD_KEYS.lists() })
			queryClient.invalidateQueries({ queryKey: CREDIT_CARD_KEYS.summary() })
			queryClient.invalidateQueries({ queryKey: CREDIT_CARD_KEYS.payments(variables.cardId) })
			queryClient.invalidateQueries({ queryKey: ACCOUNT_KEYS.lists() })
		},
	})
}
