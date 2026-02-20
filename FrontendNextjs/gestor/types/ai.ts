import { Transaction } from './transaction'

export type DocumentType = 'receipt' | 'statement' | 'invoice'

export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface AIExtractRequest {
  account_id: string
  account_currency?: string
  document_type: DocumentType
  language?: string
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

export interface SpendingAnalysisRequest {
  date_from: string
  date_to: string
  language?: string
}

export interface SpendingAnalysisResponse {
  success: boolean
  task: string
  data: SpendingInsights
  usage: TokenUsage
  processing_time_ms: number
  model_used: string
}

export interface SpendingInsights {
  summary: SpendingSummary
  patterns: Pattern[]
  recommendations: Recommendation[]
}

export interface SpendingSummary {
  total_expenses: number
  total_income: number
  savings_rate_percent: number
  period: PeriodInfo
  top_categories: CategoryBreakdown[]
}

export interface PeriodInfo {
  from: string
  to: string
  days: number
}

export interface CategoryBreakdown {
  category: string
  amount: number
  percentage: number
}

export interface Pattern {
  type: string
  description: string
  severity: 'info' | 'warning' | 'alert'
}

export interface Recommendation {
  title: string
  description: string
  potential_savings: number
  priority: 'high' | 'medium' | 'low'
}
