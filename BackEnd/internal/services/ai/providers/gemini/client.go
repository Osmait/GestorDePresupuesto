package gemini

import (
	"context"
	"fmt"
	"strings"

	domain "github.com/osmait/gestorDePresupuesto/internal/domain/ai"
	"google.golang.org/genai"
)

// Provider implements the AI provider interface on the Gemini API through the
// Google Gen AI SDK (google.golang.org/genai).
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

	return NewProviderWithConfig(cfg)
}

func NewProviderWithConfig(cfg *Config) (*Provider, error) {
	if cfg == nil {
		cfg = DefaultConfig()
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	client, err := genai.NewClient(context.Background(), &genai.ClientConfig{
		APIKey: cfg.APIKey,
		// Always the Gemini Developer API (API key): never switch to Vertex AI
		// because GOOGLE_GENAI_USE_VERTEXAI happens to be set in the env.
		Backend:     genai.BackendGeminiAPI,
		HTTPOptions: cfg.httpOptions,
	})
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

// GenerateContent sends the prompt plus the documents (inline data) and asks
// for a JSON response. The request deadline comes from ctx (the AI service
// applies its RequestTimeout and retries).
func (p *Provider) GenerateContent(
	ctx context.Context,
	prompt string,
	files []domain.DocumentFile,
) (*domain.AIResponse, error) {
	if p.client == nil {
		return nil, ErrClientNotInit
	}

	parts := make([]*genai.Part, 0, len(files)+1)
	parts = append(parts, genai.NewPartFromText(prompt))
	for _, file := range files {
		parts = append(parts, p.fileToPart(file))
	}

	temperature := p.config.Temperature
	topP := p.config.TopP
	resp, err := p.client.Models.GenerateContent(ctx, p.modelName,
		[]*genai.Content{genai.NewContentFromParts(parts, genai.RoleUser)},
		&genai.GenerateContentConfig{
			ResponseMIMEType: "application/json",
			Temperature:      &temperature,
			TopP:             &topP,
		})
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrGenerationFail, err)
	}

	if resp == nil || len(resp.Candidates) == 0 {
		return nil, ErrEmptyResponse
	}

	var usage domain.TokenUsage
	if resp.UsageMetadata != nil {
		usage = domain.TokenUsage{
			PromptTokens:     int(resp.UsageMetadata.PromptTokenCount),
			CompletionTokens: int(resp.UsageMetadata.CandidatesTokenCount),
			TotalTokens:      int(resp.UsageMetadata.TotalTokenCount),
		}
	}

	return &domain.AIResponse{
		Content: CleanJSONResponse(candidateText(resp.Candidates[0])),
		Usage:   usage,
		Model:   p.modelName,
	}, nil
}

// candidateText concatenates the text parts of a candidate, skipping thought
// summaries (thinking models may split the answer across parts).
func candidateText(c *genai.Candidate) string {
	if c == nil || c.Content == nil {
		return ""
	}
	var b strings.Builder
	for _, part := range c.Content.Parts {
		if part == nil || part.Thought {
			continue
		}
		b.WriteString(part.Text)
	}
	return b.String()
}

func (p *Provider) fileToPart(file domain.DocumentFile) *genai.Part {
	return genai.NewPartFromBytes(file.Data, file.ContentType)
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

// Close releases the provider. The genai client holds no connections of its
// own (it uses net/http), so there is nothing to close.
func (p *Provider) Close() error {
	return nil
}

func CleanJSONResponse(raw string) string {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	return strings.TrimSpace(raw)
}
