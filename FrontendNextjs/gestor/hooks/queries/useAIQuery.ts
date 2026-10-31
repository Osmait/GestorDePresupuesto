'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { aiRepository } from '@/app/repository/aiRepository'
import { readOnlyMutation } from '@/components/common/react-query-provider'
import {
	AICreateSavingsGoalRequest,
	AIError,
	AIExtractRequest,
	AIExtractResponse,
	AIReconciliationApplyRequest,
	AIReconciliationApplyResponse,
	AIReconciliationPreviewRequest,
	AIReconciliationPreviewResponse,
	AISavingsGoalListResponse,
	AISavingsGoalProgressResponse,
	AISavingsGoalResponse,
	AISavingsPlanRequest,
	AISavingsPlanResponse,
	AISuggestCategoryRequest,
	AISuggestCategoryResponse,
	AIUpdateSavingsGoalRequest,
	DocumentType,
	SpendingAnalysisRequest,
	SpendingAnalysisResponse,
} from '@/types/ai'
import { invalidateFinancialData, nonFinancialMutation } from './invalidateFinancialData'

export function useExtractTransactionsMutation() {
	return useMutation<AIExtractResponse | AIError, Error, AIExtractRequest>({
		...readOnlyMutation,
		mutationFn: (request: AIExtractRequest) => aiRepository.extractTransactions(request),
	})
}

export function useExtractFromFile() {
	const extractMutation = useExtractTransactionsMutation()

	const extract = async (files: File[], accountId: string, documentType: DocumentType, accountCurrency?: string) => {
		const preparedFiles = await aiRepository.prepareFiles(files)

		return extractMutation.mutateAsync({
			account_id: accountId,
			account_currency: accountCurrency,
			document_type: documentType,
			files: preparedFiles,
		})
	}

	return {
		extract,
		isExtracting: extractMutation.isPending,
		extractError: extractMutation.error,
		extractData: extractMutation.data,
		reset: extractMutation.reset,
	}
}

export function useAnalyzeSpendingMutation() {
	return useMutation<SpendingAnalysisResponse | AIError, Error, SpendingAnalysisRequest>({
		...readOnlyMutation,
		mutationFn: (request: SpendingAnalysisRequest) => aiRepository.analyzeSpending(request),
	})
}

export function useSuggestCategoryMutation() {
	return useMutation<AISuggestCategoryResponse | AIError, Error, AISuggestCategoryRequest>({
		...readOnlyMutation,
		mutationFn: (request: AISuggestCategoryRequest) => aiRepository.suggestCategory(request),
	})
}

export function useReconciliationPreviewMutation() {
	return useMutation<AIReconciliationPreviewResponse | AIError, Error, AIReconciliationPreviewRequest>({
		...readOnlyMutation,
		mutationFn: (request: AIReconciliationPreviewRequest) => aiRepository.reconciliationPreview(request),
	})
}

/** Applying a reconciliation creates, links or ignores transactions, so balances change. */
export function useReconciliationApplyMutation() {
	const queryClient = useQueryClient()
	return useMutation<
		AIReconciliationApplyResponse | AIError,
		Error,
		{ sessionId: string; request: AIReconciliationApplyRequest }
	>({
		mutationFn: ({ sessionId, request }) => aiRepository.reconciliationApply(sessionId, request),
		// Even a partial apply (some failed items) has written the rest.
		onSuccess: () => invalidateFinancialData(queryClient),
	})
}

export function useSavingsPlanMutation() {
	return useMutation<AISavingsPlanResponse | AIError, Error, AISavingsPlanRequest>({
		...readOnlyMutation,
		mutationFn: (request: AISavingsPlanRequest) => aiRepository.savingsPlan(request),
	})
}

export function useCreateSavingsGoalMutation() {
	return useMutation<AISavingsGoalResponse | AIError, Error, AICreateSavingsGoalRequest>({
		...nonFinancialMutation,
		mutationFn: (request: AICreateSavingsGoalRequest) => aiRepository.createSavingsGoal(request),
	})
}

export function useListSavingsGoalsMutation() {
	return useMutation<AISavingsGoalListResponse | AIError, Error, void>({
		...readOnlyMutation,
		mutationFn: () => aiRepository.listSavingsGoals(),
	})
}

export function useUpdateSavingsGoalMutation() {
	return useMutation<AISavingsGoalResponse | AIError, Error, { goalId: string; request: AIUpdateSavingsGoalRequest }>({
		...nonFinancialMutation,
		mutationFn: ({ goalId, request }) => aiRepository.updateSavingsGoal(goalId, request),
	})
}

export function useDeleteSavingsGoalMutation() {
	return useMutation<{ success: boolean } | AIError, Error, string>({
		...nonFinancialMutation,
		mutationFn: (goalId: string) => aiRepository.deleteSavingsGoal(goalId),
	})
}

export function useSavingsGoalProgressMutation() {
	return useMutation<AISavingsGoalProgressResponse | AIError, Error, string>({
		...readOnlyMutation,
		mutationFn: (goalId: string) => aiRepository.getSavingsGoalProgress(goalId),
	})
}
