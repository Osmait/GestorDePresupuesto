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
