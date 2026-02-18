package ai

import (
	"context"

	domain "github.com/osmait/gestorDePresupuesto/internal/domain/ai"
)

type AIProvider interface {
	GenerateContent(ctx context.Context, prompt string, files []domain.DocumentFile) (*domain.AIResponse, error)
	GetModel() string
	SetModel(model string)
	ValidateConfig() error
	GetProviderName() string
	Close() error
}

type ProviderConfig struct {
	Name   string
	Model  string
	APIKey string
}
