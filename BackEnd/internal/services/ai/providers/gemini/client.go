package gemini

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/generative-ai-go/genai"
	domain "github.com/osmait/gestorDePresupuesto/internal/domain/ai"
	"google.golang.org/api/option"
)

type Provider struct {
	client    *genai.Client
	modelName string
	apiKey    string
	config    *Config
}

func NewProvider(apiKey, modelName string) (*Provider, error) {
	if apiKey == "" {
		return nil, ErrAPIKeyRequired
	}

	cfg := DefaultConfig()
	cfg.APIKey = apiKey
	if modelName != "" {
		cfg.Model = modelName
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	ctx := context.Background()
	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return nil, fmt.Errorf("failed to create gemini client: %w", err)
	}

	return &Provider{
		client:    client,
		modelName: cfg.Model,
		apiKey:    apiKey,
		config:    cfg,
	}, nil
}

func NewProviderWithConfig(cfg *Config) (*Provider, error) {
	if cfg == nil {
		cfg = DefaultConfig()
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	ctx := context.Background()
	client, err := genai.NewClient(ctx, option.WithAPIKey(cfg.APIKey))
	if err != nil {
		return nil, fmt.Errorf("failed to create gemini client: %w", err)
	}

	return &Provider{
		client:    client,
		modelName: cfg.Model,
		apiKey:    cfg.APIKey,
		config:    cfg,
	}, nil
}

func (p *Provider) GenerateContent(
	ctx context.Context,
	prompt string,
	files []domain.DocumentFile,
) (*domain.AIResponse, error) {
	if p.client == nil {
		return nil, ErrClientNotInit
	}

	model := p.client.GenerativeModel(p.modelName)
	model.ResponseMIMEType = "application/json"
	model.SetTemperature(float32(p.config.Temperature))
	model.SetTopP(float32(p.config.TopP))

	parts := []genai.Part{genai.Text(prompt)}

	for _, file := range files {
		part := p.fileToPart(file)
		parts = append(parts, part)
	}

	resp, err := model.GenerateContent(ctx, parts...)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrGenerationFail, err)
	}

	if resp == nil || len(resp.Candidates) == 0 {
		return nil, ErrEmptyResponse
	}

	usage := domain.TokenUsage{
		PromptTokens:     int(resp.UsageMetadata.PromptTokenCount),
		CompletionTokens: int(resp.UsageMetadata.CandidatesTokenCount),
		TotalTokens:      int(resp.UsageMetadata.TotalTokenCount),
	}

	content := ""
	if len(resp.Candidates) > 0 && len(resp.Candidates[0].Content.Parts) > 0 {
		if txt, ok := resp.Candidates[0].Content.Parts[0].(genai.Text); ok {
			content = string(txt)
		}
	}

	content = CleanJSONResponse(content)

	return &domain.AIResponse{
		Content: content,
		Usage:   usage,
		Model:   p.modelName,
	}, nil
}

func (p *Provider) fileToPart(file domain.DocumentFile) genai.Part {
	return genai.Blob{
		MIMEType: file.ContentType,
		Data:     file.Data,
	}
}

func (p *Provider) GetModel() string {
	return p.modelName
}

func (p *Provider) SetModel(model string) {
	p.modelName = model
}

func (p *Provider) ValidateConfig() error {
	if p.apiKey == "" {
		return ErrAPIKeyRequired
	}
	return nil
}

func (p *Provider) GetProviderName() string {
	return "gemini"
}

func (p *Provider) Close() error {
	if p.client != nil {
		return p.client.Close()
	}
	return nil
}

func CleanJSONResponse(raw string) string {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	return strings.TrimSpace(raw)
}
