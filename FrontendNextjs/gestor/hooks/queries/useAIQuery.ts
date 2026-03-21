'use client'

import { useMutation } from '@tanstack/react-query'
import { aiRepository } from '@/app/repository/aiRepository'
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

export function useExtractTransactionsMutation() {
	return useMutation<AIExtractResponse | AIError, Error, AIExtractRequest>({
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
		mutationFn: (request: SpendingAnalysisRequest) => aiRepository.analyzeSpending(request),
	})
}

export function useSuggestCategoryMutation() {
	return useMutation<AISuggestCategoryResponse | AIError, Error, AISuggestCategoryRequest>({
		mutationFn: (request: AISuggestCategoryRequest) => aiRepository.suggestCategory(request),
	})
}

export function useReconciliationPreviewMutation() {
	return useMutation<AIReconciliationPreviewResponse | AIError, Error, AIReconciliationPreviewRequest>({
		mutationFn: (request: AIReconciliationPreviewRequest) => aiRepository.reconciliationPreview(request),
	})
}

export function useReconciliationApplyMutation() {
	return useMutation<
		AIReconciliationApplyResponse | AIError,
		Error,
		{ sessionId: string; request: AIReconciliationApplyRequest }
	>({
		mutationFn: ({ sessionId, request }) => aiRepository.reconciliationApply(sessionId, request),
	})
}

export function useSavingsPlanMutation() {
	return useMutation<AISavingsPlanResponse | AIError, Error, AISavingsPlanRequest>({
		mutationFn: (request: AISavingsPlanRequest) => aiRepository.savingsPlan(request),
	})
}

export function useCreateSavingsGoalMutation() {
	return useMutation<AISavingsGoalResponse | AIError, Error, AICreateSavingsGoalRequest>({
		mutationFn: (request: AICreateSavingsGoalRequest) => aiRepository.createSavingsGoal(request),
	})
}

export function useListSavingsGoalsMutation() {
	return useMutation<AISavingsGoalListResponse | AIError, Error, void>({
		mutationFn: () => aiRepository.listSavingsGoals(),
	})
}

export function useUpdateSavingsGoalMutation() {
	return useMutation<AISavingsGoalResponse | AIError, Error, { goalId: string; request: AIUpdateSavingsGoalRequest }>({
		mutationFn: ({ goalId, request }) => aiRepository.updateSavingsGoal(goalId, request),
	})
}

export function useDeleteSavingsGoalMutation() {
	return useMutation<{ success: boolean } | AIError, Error, string>({
		mutationFn: (goalId: string) => aiRepository.deleteSavingsGoal(goalId),
	})
}

export function useSavingsGoalProgressMutation() {
	return useMutation<AISavingsGoalProgressResponse | AIError, Error, string>({
		mutationFn: (goalId: string) => aiRepository.getSavingsGoalProgress(goalId),
	})
}
