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
    potential_duplicates: AIPotentialDuplicate[]
    category_suggestions: AICategorySuggestion[]
  }
  usage: TokenUsage
  processing_time_ms: number
  model_used: string
}

export interface AISuggestCategoryRequest {
	name: string
	description?: string
	amount: number
	type_transation: 'income' | 'bill'
	account_id: string
	currency?: string
}

export interface AISuggestCategoryResponse {
	success: boolean
	data?: AICategorySuggestion
	items?: Array<{
		index: number
		suggestion?: AICategorySuggestion
	}>
}

export interface AICategorySuggestion {
	transaction_id?: string
	category_id: string
	category_name: string
	new_category_name?: string
	confidence: 'high' | 'medium' | 'low'
	score: number
	reason: string
}

export interface AIDuplicateCandidate {
	id: string
	name: string
	amount: number
	type_transation: Transaction['type_transation']
	account_id: string
	currency: string
	created_at: string
	score: number
}

export interface AIPotentialDuplicate {
	extracted_transaction_id: string
	match_type: 'duplicate' | 'similar'
	score: number
	candidates: AIDuplicateCandidate[]
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

export interface AIReconciliationPreviewRequest {
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

export interface AIReconciliationItem {
	extracted: Transaction
	candidates: AIDuplicateCandidate[]
	score: number
	status: 'exact' | 'similar' | 'unmatched'
}

export interface AIReconciliationPreviewResponse {
	success: boolean
	data: {
		session_id: string
		extracted_count: number
		exact_matches: AIReconciliationItem[]
		similar_matches: AIReconciliationItem[]
		unmatched: AIReconciliationItem[]
	}
}

export interface AIReconciliationApplyRequest {
	actions: Array<{
		extracted_transaction_id: string
		action: 'create' | 'link' | 'ignore'
		linked_transaction_id?: string
		category_id?: string
	}>
}

export interface AIReconciliationApplyResponse {
	success: boolean
	data: {
		session_id: string
		linked: number
		created: number
		ignored: number
		failed: number
		failed_items?: Array<{
			extracted_transaction_id: string
			action: 'create' | 'link' | 'ignore' | string
			code: string
			message: string
		}>
	}
}

export interface AISavingsPlanRequest {
	target_amount: number
	target_date?: string
	account_id?: string
}

export interface AISavingsPlanResponse {
	success: boolean
	data: {
		target_amount: number
		current_average_savings: number
		recommended_monthly_save: number
		recommended_weekly_save: number
		estimated_months_to_target: number
		feasible_by_date: boolean
		target_date?: string
	}
}

export interface AISavingsGoal {
	id: string
	name: string
	target_amount: number
	current_saved: number
	progress_pct: number
	target_date?: string
	account_id?: string
	status: string
	created_at: string
	updated_at: string
}

export interface AICreateSavingsGoalRequest {
	name: string
	target_amount: number
	target_date?: string
	account_id?: string
	current_saved?: number
}

export interface AIUpdateSavingsGoalRequest {
	name?: string
	target_amount?: number
	target_date?: string
	account_id?: string
	current_saved?: number
	status?: string
}

export interface AISavingsGoalResponse {
	success: boolean
	data: AISavingsGoal
}

export interface AISavingsGoalListResponse {
	success: boolean
	data: AISavingsGoal[]
}

export interface AISavingsGoalProgressResponse {
	success: boolean
	data: {
		goal: AISavingsGoal
		current_average_savings: number
		recommended_monthly_save: number
		recommended_weekly_save: number
		estimated_months_to_target: number
		feasible_by_date: boolean
	}
}
