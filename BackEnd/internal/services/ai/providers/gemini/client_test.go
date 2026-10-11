package gemini

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/genai"

	domain "github.com/osmait/gestorDePresupuesto/internal/domain/ai"
)

const testAPIKey = "test-key"

// newFakeProvider points the provider at an httptest server standing in for
// the Gemini API.
func newFakeProvider(t *testing.T, handler http.HandlerFunc) *Provider {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	cfg := DefaultConfig()
	cfg.APIKey = testAPIKey
	cfg.Model = "gemini-test"
	cfg.httpOptions = genai.HTTPOptions{BaseURL: srv.URL + "/"}
	p, err := NewProviderWithConfig(cfg)
	require.NoError(t, err)
	return p
}

type capturedRequest struct {
	Contents []struct {
		Role  string `json:"role"`
		Parts []struct {
			Text       string `json:"text"`
			InlineData *struct {
				MimeType string `json:"mimeType"`
				Data     string `json:"data"`
			} `json:"inlineData"`
		} `json:"parts"`
	} `json:"contents"`
	GenerationConfig struct {
		ResponseMimeType string   `json:"responseMimeType"`
		Temperature      *float64 `json:"temperature"`
		TopP             *float64 `json:"topP"`
	} `json:"generationConfig"`
}

func TestGenerateContent_RequestAndResponse(t *testing.T) {
	var got capturedRequest
	var path, apiKey string
	p := newFakeProvider(t, func(w http.ResponseWriter, r *http.Request) {
		path = r.URL.Path
		apiKey = r.Header.Get("x-goog-api-key")
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &got)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"candidates": [{"content": {"role": "model", "parts": [
				{"text": "thinking...", "thought": true},
				{"text": "` + "```json" + `\n{\"total\": "},
				{"text": "42}\n` + "```" + `"}
			]}}],
			"usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 5, "totalTokenCount": 15}
		}`))
	})

	pdf := []byte("%PDF-1.7 fake")
	resp, err := p.GenerateContent(context.Background(), "extract the total", []domain.DocumentFile{
		{Filename: "statement.pdf", ContentType: "application/pdf", Data: pdf, Size: int64(len(pdf))},
	})
	require.NoError(t, err)

	assert.True(t, strings.HasSuffix(path, "/models/gemini-test:generateContent"), path)
	assert.Equal(t, testAPIKey, apiKey)
	require.Len(t, got.Contents, 1)
	assert.Equal(t, "user", got.Contents[0].Role)
	require.Len(t, got.Contents[0].Parts, 2)
	assert.Equal(t, "extract the total", got.Contents[0].Parts[0].Text)
	require.NotNil(t, got.Contents[0].Parts[1].InlineData)
	assert.Equal(t, "application/pdf", got.Contents[0].Parts[1].InlineData.MimeType)
	assert.Equal(t, base64.StdEncoding.EncodeToString(pdf), got.Contents[0].Parts[1].InlineData.Data)
	assert.Equal(t, "application/json", got.GenerationConfig.ResponseMimeType)
	require.NotNil(t, got.GenerationConfig.Temperature)
	assert.InDelta(t, 0.1, *got.GenerationConfig.Temperature, 1e-6)
	require.NotNil(t, got.GenerationConfig.TopP)
	assert.InDelta(t, 0.1, *got.GenerationConfig.TopP, 1e-6)

	assert.Equal(t, `{"total": 42}`, resp.Content, "text parts joined, thoughts and code fences dropped")
	assert.Equal(t, "gemini-test", resp.Model)
	assert.Equal(t, domain.TokenUsage{PromptTokens: 10, CompletionTokens: 5, TotalTokens: 15}, resp.Usage)
}

func TestGenerateContent_Errors(t *testing.T) {
	t.Run("API error wraps ErrGenerationFail", func(t *testing.T) {
		p := newFakeProvider(t, func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error": {"code": 429, "message": "quota exceeded", "status": "RESOURCE_EXHAUSTED"}}`))
		})
		_, err := p.GenerateContent(context.Background(), "x", nil)
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrGenerationFail))
		assert.Contains(t, err.Error(), "quota exceeded")
	})

	t.Run("no candidates is ErrEmptyResponse", func(t *testing.T) {
		p := newFakeProvider(t, func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"candidates": []}`))
		})
		_, err := p.GenerateContent(context.Background(), "x", nil)
		assert.ErrorIs(t, err, ErrEmptyResponse)
	})

	t.Run("cancelled context aborts the call", func(t *testing.T) {
		p := newFakeProvider(t, func(w http.ResponseWriter, r *http.Request) {
			<-r.Context().Done()
		})
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		_, err := p.GenerateContent(ctx, "x", nil)
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrGenerationFail))
	})
}

func TestNewProvider(t *testing.T) {
	_, err := NewProvider("", "")
	assert.ErrorIs(t, err, ErrAPIKeyRequired)

	t.Setenv("GOOGLE_GENAI_USE_VERTEXAI", "true")
	p, err := NewProvider(testAPIKey, "")
	require.NoError(t, err)
	assert.Equal(t, DefaultConfig().Model, p.GetModel())
	assert.Equal(t, genai.BackendGeminiAPI, p.client.ClientConfig().Backend, "never Vertex AI")
	assert.Equal(t, "gemini", p.GetProviderName())
	assert.NoError(t, p.ValidateConfig())
	assert.NoError(t, p.Close())
}
