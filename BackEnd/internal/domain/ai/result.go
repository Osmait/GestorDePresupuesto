package ai

import "time"

type TokenUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type AIResponse struct {
	Content string     `json:"content"`
	Usage   TokenUsage `json:"usage"`
	Model   string     `json:"model"`
}

type ConfidenceScore struct {
	Overall   float64            `json:"overall"`
	PerField  map[string]float64 `json:"per_field,omitempty"`
	Uncertain []string           `json:"uncertain,omitempty"`
}

type AIResult struct {
	TaskType       AITaskType       `json:"task_type"`
	Data           interface{}      `json:"data"`
	RawResponse    string           `json:"-"`
	Usage          TokenUsage       `json:"usage"`
	Confidence     *ConfidenceScore `json:"confidence,omitempty"`
	ProcessingTime time.Duration    `json:"processing_time_ms"`
	ModelUsed      string           `json:"model_used"`
	CreatedAt      time.Time        `json:"created_at"`
}

func NewAIResult(taskType AITaskType, data interface{}, usage TokenUsage, processingTime time.Duration, model string) *AIResult {
	return &AIResult{
		TaskType:       taskType,
		Data:           data,
		Usage:          usage,
		ProcessingTime: processingTime,
		ModelUsed:      model,
		CreatedAt:      time.Now(),
	}
}
