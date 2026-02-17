'use client'

import { useMutation } from '@tanstack/react-query'
import { aiRepository } from '@/app/repository/aiRepository'
import { AIExtractRequest, AIExtractResponse, AIError, DocumentType } from '@/types/ai'

export const AI_KEYS = {
  extract: ['ai', 'extract'] as const,
}

export function useExtractTransactionsMutation() {
  return useMutation<AIExtractResponse | AIError, Error, AIExtractRequest>({
    mutationFn: (request: AIExtractRequest) => aiRepository.extractTransactions(request),
  })
}

export function useExtractFromFile() {
  const extractMutation = useExtractTransactionsMutation()

  const extract = async (
    files: File[],
    accountId: string,
    documentType: DocumentType
  ) => {
    const preparedFiles = await aiRepository.prepareFiles(files)
    
    return extractMutation.mutateAsync({
      account_id: accountId,
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
