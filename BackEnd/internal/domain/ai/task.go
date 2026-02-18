package ai

import "context"

type AITaskType string

const (
	TaskExtractTransactions AITaskType = "extract_transactions"
	TaskSpendingAnalysis    AITaskType = "spending_analysis"
)

type AITask interface {
	GetType() AITaskType
	ValidateInput(input interface{}) error
	BuildPrompt(input interface{}) (string, error)
	ParseResponse(rawJSON string) (interface{}, error)
}

type TaskContext struct {
	Context   context.Context
	UserID    string
	AccountID string
	TaskType  AITaskType
	Files     []DocumentFile
	Input     interface{}
}
