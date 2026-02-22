import { BaseRepository } from '@/lib/base-repository'
import {
  AIExtractRequest,
  AIExtractResponse,
  AIError,
  AIReconciliationPreviewRequest,
  AIReconciliationPreviewResponse,
  AIReconciliationApplyRequest,
  AIReconciliationApplyResponse,
  AISavingsPlanRequest,
  AISavingsPlanResponse,
  AICreateSavingsGoalRequest,
  AIUpdateSavingsGoalRequest,
  AISavingsGoalListResponse,
  AISavingsGoalProgressResponse,
  AISavingsGoalResponse,
  AISuggestCategoryRequest,
  AISuggestCategoryResponse,
  SpendingAnalysisRequest,
  SpendingAnalysisResponse,
} from '@/types/ai'

export class AIRepository extends BaseRepository {
  private getLocale(): string {
    if (typeof window !== 'undefined') {
      const match = document.cookie.match(/locale=([^;]+)/)
      return match ? match[1] : 'es'
    }
    return 'es'
  }

  async extractTransactions(request: AIExtractRequest): Promise<AIExtractResponse | AIError> {
    try {
      const requestWithLanguage = {
        ...request,
        language: request.language || this.getLocale(),
      }
      const response = await this.post<AIExtractResponse>('/ai/extract/transactions', requestWithLanguage)
      if (!response) {
        return {
          success: false,
          error: 'Empty response from server',
        }
      }
      return response
    } catch (error) {
      console.error('Error extracting transactions:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  async analyzeSpending(
    request: SpendingAnalysisRequest
  ): Promise<SpendingAnalysisResponse | AIError> {
    try {
      const requestWithLanguage = {
        ...request,
        language: request.language || this.getLocale(),
      }
      const response = await this.post<SpendingAnalysisResponse>('/ai/analyze/spending', requestWithLanguage)
      if (!response) {
        return {
          success: false,
          error: 'Empty response from server',
        }
      }
      return response
    } catch (error) {
      console.error('Error analyzing spending:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

	async reconciliationPreview(
		request: AIReconciliationPreviewRequest
	): Promise<AIReconciliationPreviewResponse | AIError> {
		try {
			const requestWithLanguage = {
				...request,
				language: request.language || this.getLocale(),
			}
			const response = await this.post<AIReconciliationPreviewResponse>('/ai/reconcile/preview', requestWithLanguage)
			if (!response) {
				return {
					success: false,
					error: 'Empty response from server',
				}
			}
			return response
		} catch (error) {
			console.error('Error previewing reconciliation:', error)
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
			}
		}
	}

	async reconciliationApply(
		sessionId: string,
		request: AIReconciliationApplyRequest
	): Promise<AIReconciliationApplyResponse | AIError> {
		try {
			const response = await this.post<AIReconciliationApplyResponse>(`/ai/reconcile/${sessionId}/apply`, request)
			if (!response) {
				return {
					success: false,
					error: 'Empty response from server',
				}
			}
			return response
		} catch (error) {
			console.error('Error applying reconciliation:', error)
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
			}
		}
	}

	async savingsPlan(
		request: AISavingsPlanRequest
	): Promise<AISavingsPlanResponse | AIError> {
		try {
			const response = await this.post<AISavingsPlanResponse>('/ai/goals/savings-plan', request)
			if (!response) {
				return {
					success: false,
					error: 'Empty response from server',
				}
			}
			return response
		} catch (error) {
			console.error('Error generating savings plan:', error)
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
			}
		}
	}

	async createSavingsGoal(
		request: AICreateSavingsGoalRequest
	): Promise<AISavingsGoalResponse | AIError> {
		try {
			const response = await this.post<AISavingsGoalResponse>('/ai/goals', request)
			if (!response) {
				return { success: false, error: 'Empty response from server' }
			}
			return response
		} catch (error) {
			console.error('Error creating savings goal:', error)
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' }
		}
	}

	async listSavingsGoals(): Promise<AISavingsGoalListResponse | AIError> {
		try {
			const response = await this.get<AISavingsGoalListResponse>('/ai/goals')
			if (!response) {
				return { success: false, error: 'Empty response from server' }
			}
			return response
		} catch (error) {
			console.error('Error listing savings goals:', error)
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' }
		}
	}

	async updateSavingsGoal(
		goalId: string,
		request: AIUpdateSavingsGoalRequest
	): Promise<AISavingsGoalResponse | AIError> {
		try {
			const response = await this.patch<AISavingsGoalResponse>(`/ai/goals/${goalId}`, request)
			if (!response) {
				return { success: false, error: 'Empty response from server' }
			}
			return response
		} catch (error) {
			console.error('Error updating savings goal:', error)
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' }
		}
	}

	async deleteSavingsGoal(goalId: string): Promise<{ success: boolean } | AIError> {
		try {
			await this.deleteRequest(`/ai/goals/${goalId}`)
			return { success: true }
		} catch (error) {
			console.error('Error deleting savings goal:', error)
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' }
		}
	}

	async getSavingsGoalProgress(goalId: string): Promise<AISavingsGoalProgressResponse | AIError> {
		try {
			const response = await this.get<AISavingsGoalProgressResponse>(`/ai/goals/${goalId}/progress`)
			if (!response) {
				return { success: false, error: 'Empty response from server' }
			}
			return response
		} catch (error) {
			console.error('Error loading savings goal progress:', error)
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' }
		}
	}

	async suggestCategory(
		request: AISuggestCategoryRequest
	): Promise<AISuggestCategoryResponse | AIError> {
		try {
			const payload = {
				...request,
				amount: Number((request as unknown as { amount: unknown }).amount),
			}
			const response = await this.post<AISuggestCategoryResponse>('/ai/suggest-category', payload)
			if (!response) {
				return {
					success: false,
					error: 'Empty response from server',
				}
			}
			return response
		} catch (error) {
			console.error('Error suggesting category:', error)
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
			}
		}
	}

  async fileToBase64(file: File): Promise<{ base64_data: string; content_type: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result as string
        const base64_data = base64.split(',')[1]
        resolve({
          base64_data,
          content_type: file.type,
        })
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  async prepareFiles(files: File[]): Promise<Array<{ filename: string; content_type: string; base64_data: string }>> {
    const preparedFiles = []
    for (const file of files) {
      const { base64_data, content_type } = await this.fileToBase64(file)
      preparedFiles.push({
        filename: file.name,
        content_type,
        base64_data,
      })
    }
    return preparedFiles
  }
}

export const aiRepository = new AIRepository()
