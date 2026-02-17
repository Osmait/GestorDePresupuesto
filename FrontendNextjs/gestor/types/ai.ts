import { Transaction } from './transaction'

export type DocumentType = 'receipt' | 'statement' | 'invoice'

export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface AIExtractRequest {
  account_id: string
  document_type: DocumentType
  files: Array<{
    filename: string
    content_type: string
    base64_data: string
  }>
}

export interface AIExtractResponse {
  success: boolean
  task: string
  data: {
    transactions: Transaction[]
    count: number
    unmatched_categories: number
  }
  usage: TokenUsage
  processing_time_ms: number
  model_used: string
}

export interface AIError {
  success: false
  error: string
  code?: string
}

export type AIResponse = AIExtractResponse | AIError
