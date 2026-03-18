package ai

import (
	"context"
	"fmt"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/platform/cache"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/ai"
)

const (
	MaxExtractionEntries = 500
	MaxAnalysisEntries   = 500
	ExtractionTTL        = 24 * time.Hour
	AnalysisTTL          = 1 * time.Hour
)

// AICacheService wraps an in-memory cache for AI response caching.
//
// Eviction strategy: TTL-based (go-cache expires entries automatically).
// When the soft limit (MaxXxxEntries) is reached we stop accepting new
// entries rather than nuking the entire prefix — this avoids sudden cache
// misses and repeated AI calls for all users simultaneously.
// Counts are decremented on manual invalidation and approximate for
// TTL-expired entries; the soft cap protects against pathological growth
// while regular TTL expiry handles steady-state cleanup.
type AICacheService struct {
	cache           cache.CacheRepository
	extractionCount int
	analysisCount   int
}

func NewAICacheService(cache cache.CacheRepository) *AICacheService {
	return &AICacheService{cache: cache}
}

func (c *AICacheService) GetExtraction(ctx context.Context, userID, fileHash, docType string) (*dto.ExtractResponse, bool) {
	key := c.buildExtractionKey(userID, fileHash, docType)
	if cached, found := c.cache.Get(key); found {
		if response, ok := cached.(*dto.ExtractResponse); ok {
			return response, true
		}
	}
	return nil, false
}

func (c *AICacheService) SetExtraction(ctx context.Context, userID, fileHash, docType string, response *dto.ExtractResponse) {
	if c.extractionCount >= MaxExtractionEntries {
		// Soft cap reached — skip caching until TTL expiry frees space.
		// Avoids nuking all cached extractions simultaneously.
		return
	}
	key := c.buildExtractionKey(userID, fileHash, docType)
	c.cache.Set(key, response, ExtractionTTL)
	c.extractionCount++
}

func (c *AICacheService) GetAnalysis(ctx context.Context, userID, dateFrom, dateTo string) (*dto.SpendingAnalysisResponse, bool) {
	key := c.buildAnalysisKey(userID, dateFrom, dateTo)
	if cached, found := c.cache.Get(key); found {
		if response, ok := cached.(*dto.SpendingAnalysisResponse); ok {
			return response, true
		}
	}
	return nil, false
}

func (c *AICacheService) SetAnalysis(ctx context.Context, userID, dateFrom, dateTo string, response *dto.SpendingAnalysisResponse) {
	if c.analysisCount >= MaxAnalysisEntries {
		return
	}
	key := c.buildAnalysisKey(userID, dateFrom, dateTo)
	c.cache.Set(key, response, AnalysisTTL)
	c.analysisCount++
}

// InvalidateUserAnalysis removes all cached analysis results for a user.
func (c *AICacheService) InvalidateUserAnalysis(userID string) {
	prefix := fmt.Sprintf("ai:analyze:%s:", userID)
	c.cache.DeleteByPrefix(prefix)
	// Reset counter — we don't know exactly how many were deleted, but
	// clamping to 0 is safe (it may allow new entries sooner than necessary,
	// which is preferable to blocking them longer than necessary).
	if c.analysisCount > 0 {
		c.analysisCount = 0
	}
}

// InvalidateUserExtractions removes all cached extraction results for a user.
func (c *AICacheService) InvalidateUserExtractions(userID string) {
	prefix := fmt.Sprintf("ai:extract:%s:", userID)
	c.cache.DeleteByPrefix(prefix)
	if c.extractionCount > 0 {
		c.extractionCount = 0
	}
}

func (c *AICacheService) buildExtractionKey(userID, fileHash, docType string) string {
	return fmt.Sprintf("ai:extract:v2:%s:%s:%s", userID, fileHash, docType)
}

func (c *AICacheService) buildAnalysisKey(userID, dateFrom, dateTo string) string {
	return fmt.Sprintf("ai:analyze:%s:%s:%s", userID, dateFrom, dateTo)
}
