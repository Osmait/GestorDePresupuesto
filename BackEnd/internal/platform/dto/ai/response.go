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
