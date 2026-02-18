import { BaseRepository } from '@/lib/base-repository'
import {
  AIExtractRequest,
  AIExtractResponse,
  AIError,
  SpendingAnalysisRequest,
  SpendingAnalysisResponse,
} from '@/types/ai'

export class AIRepository extends BaseRepository {
  async extractTransactions(request: AIExtractRequest): Promise<AIExtractResponse | AIError> {
    try {
      const response = await this.post<AIExtractResponse>('/ai/extract/transactions', request)
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
      const response = await this.post<SpendingAnalysisResponse>('/ai/analyze/spending', request)
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
