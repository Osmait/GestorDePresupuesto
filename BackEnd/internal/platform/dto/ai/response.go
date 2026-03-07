package dto

import (
	domain "github.com/osmait/gestorDePresupuesto/internal/domain/ai"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
)

type ExtractResponse struct {
	Success        bool              `json:"success"`
	Task           string            `json:"task"`
	Data           ExtractData       `json:"data"`
	Usage          domain.TokenUsage `json:"usage"`
	ProcessingTime int64             `json:"processing_time_ms"`
	ModelUsed      string            `json:"model_used"`
}

type ExtractData struct {
	Transactions        []*transaction.Transaction `json:"transactions"`
	Count               int                        `json:"count"`
	UnmatchedCategories int                        `json:"unmatched_categories"`
	PotentialDuplicates []PotentialDuplicate       `json:"potential_duplicates"`
	CategorySuggestions []CategorySuggestion       `json:"category_suggestions"`
}

type SuggestCategoryResponse struct {
	Success bool                     `json:"success"`
	Data    *CategorySuggestion      `json:"data,omitempty"`
	Items   []CategorySuggestionItem `json:"items,omitempty"`
}

type CategorySuggestion struct {
	TransactionID   string  `json:"transaction_id,omitempty"`
	CategoryID      string  `json:"category_id"`
	CategoryName    string  `json:"category_name"`
	NewCategoryName string  `json:"new_category_name,omitempty"`
	Confidence      string  `json:"confidence"`
	Score           float64 `json:"score"`
	Reason          string  `json:"reason"`
}

type CategorySuggestionItem struct {
	Index      int                 `json:"index"`
	Suggestion *CategorySuggestion `json:"suggestion,omitempty"`
}

type PotentialDuplicate struct {
	ExtractedTransactionID string               `json:"extracted_transaction_id"`
	MatchType              string               `json:"match_type"`
	Score                  float64              `json:"score"`
	Candidates             []DuplicateCandidate `json:"candidates"`
}

type DuplicateCandidate struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Amount         float64 `json:"amount"`
	TypeTransation string  `json:"type_transation"`
	AccountID      string  `json:"account_id"`
	Currency       string  `json:"currency"`
	CreatedAt      string  `json:"created_at"`
	Score          float64 `json:"score"`
}

type SpendingAnalysisResponse struct {
	Success        bool              `json:"success"`
	Task           string            `json:"task"`
	Data           SpendingInsights  `json:"data"`
	Usage          domain.TokenUsage `json:"usage"`
	ProcessingTime int64             `json:"processing_time_ms"`
	ModelUsed      string            `json:"model_used"`
}

type SpendingInsights struct {
	Summary         SpendingSummary  `json:"summary"`
	Patterns        []Pattern        `json:"patterns"`
	Recommendations []Recommendation `json:"recommendations"`
}

type SpendingSummary struct {
	TotalExpenses      float64             `json:"total_expenses"`
	TotalIncome        float64             `json:"total_income"`
	SavingsRatePercent float64             `json:"savings_rate_percent"`
	Period             PeriodInfo          `json:"period"`
	TopCategories      []CategoryBreakdown `json:"top_categories"`
}

type PeriodInfo struct {
	From string `json:"from"`
	To   string `json:"to"`
	Days int    `json:"days"`
}

type CategoryBreakdown struct {
	Category   string  `json:"category"`
	Amount     float64 `json:"amount"`
	Percentage float64 `json:"percentage"`
}

type Pattern struct {
	Type        string `json:"type"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
}

type Recommendation struct {
	Title            string  `json:"title"`
	Description      string  `json:"description"`
	PotentialSavings float64 `json:"potential_savings"`
	Priority         string  `json:"priority"`
}

type ErrorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
	Code    string `json:"code,omitempty"`
}

type ReconciliationPreviewResponse struct {
	Success bool                      `json:"success"`
	Data    ReconciliationPreviewData `json:"data"`
}

type ReconciliationPreviewData struct {
	SessionID      string               `json:"session_id"`
	ExtractedCount int                  `json:"extracted_count"`
	ExactMatches   []ReconciliationItem `json:"exact_matches"`
	SimilarMatches []ReconciliationItem `json:"similar_matches"`
	Unmatched      []ReconciliationItem `json:"unmatched"`
}

type ReconciliationItem struct {
	Extracted  *transaction.Transaction `json:"extracted"`
	Candidates []DuplicateCandidate     `json:"candidates"`
	Score      float64                  `json:"score"`
	Status     string                   `json:"status"`
}

type SavingsPlanResponse struct {
	Success bool            `json:"success"`
	Data    SavingsPlanData `json:"data"`
}

type ReconciliationApplyResponse struct {
	Success bool                  `json:"success"`
	Data    ReconciliationSummary `json:"data"`
}

type ReconciliationSummary struct {
	SessionID   string                     `json:"session_id"`
	Linked      int                        `json:"linked"`
	Created     int                        `json:"created"`
	Ignored     int                        `json:"ignored"`
	Failed      int                        `json:"failed"`
	FailedItems []ReconciliationFailedItem `json:"failed_items,omitempty"`
}

type ReconciliationFailedItem struct {
	ExtractedTransactionID string `json:"extracted_transaction_id"`
	Action                 string `json:"action"`
	Code                   string `json:"code"`
	Message                string `json:"message"`
}

type SavingsPlanData struct {
	TargetAmount            float64 `json:"target_amount"`
	CurrentAverageSavings   float64 `json:"current_average_savings"`
	RecommendedMonthlySave  float64 `json:"recommended_monthly_save"`
	RecommendedWeeklySave   float64 `json:"recommended_weekly_save"`
	EstimatedMonthsToTarget int     `json:"estimated_months_to_target"`
	FeasibleByDate          bool    `json:"feasible_by_date"`
	TargetDate              string  `json:"target_date,omitempty"`
}

type SavingsGoal struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	TargetAmount float64 `json:"target_amount"`
	CurrentSaved float64 `json:"current_saved"`
	ProgressPct  float64 `json:"progress_pct"`
	TargetDate   string  `json:"target_date,omitempty"`
	AccountID    string  `json:"account_id,omitempty"`
	Status       string  `json:"status"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
}

type SavingsGoalResponse struct {
	Success bool        `json:"success"`
	Data    SavingsGoal `json:"data"`
}

type SavingsGoalListResponse struct {
	Success bool          `json:"success"`
	Data    []SavingsGoal `json:"data"`
}

type SavingsGoalProgressResponse struct {
	Success bool                    `json:"success"`
	Data    SavingsGoalProgressData `json:"data"`
}

type SavingsGoalProgressData struct {
	Goal                    SavingsGoal `json:"goal"`
	CurrentAverageSavings   float64     `json:"current_average_savings"`
	RecommendedMonthlySave  float64     `json:"recommended_monthly_save"`
	RecommendedWeeklySave   float64     `json:"recommended_weekly_save"`
	EstimatedMonthsToTarget int         `json:"estimated_months_to_target"`
	FeasibleByDate          bool        `json:"feasible_by_date"`
}

func ToExtractResponse(result *domain.AIResult) *ExtractResponse {
	transactions, ok := result.Data.([]*transaction.Transaction)
	if !ok {
		transactions = []*transaction.Transaction{}
	}

	unmatched := 0
	for _, txn := range transactions {
		if txn.CategoryId == "" {
			unmatched++
		}
	}

	return &ExtractResponse{
		Success: true,
		Task:    string(result.TaskType),
		Data: ExtractData{
			Transactions:        transactions,
			Count:               len(transactions),
			UnmatchedCategories: unmatched,
			PotentialDuplicates: []PotentialDuplicate{},
			CategorySuggestions: []CategorySuggestion{},
		},
		Usage:          result.Usage,
		ProcessingTime: result.ProcessingTime.Milliseconds(),
		ModelUsed:      result.ModelUsed,
	}
}

func NewErrorResponse(err error, code string) *ErrorResponse {
	return &ErrorResponse{
		Success: false,
		Error:   err.Error(),
		Code:    code,
	}
}
