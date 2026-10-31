package ai

import (
	"context"
	"fmt"
	"sync/atomic"
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
	cache cache.CacheRepository
	// Counters are updated by concurrent requests.
	extractionCount atomic.Int64
	analysisCount   atomic.Int64
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
	if c.extractionCount.Load() >= MaxExtractionEntries {
		// Soft cap reached — skip caching until TTL expiry frees space.
		// Avoids nuking all cached extractions simultaneously.
		return
	}
	key := c.buildExtractionKey(userID, fileHash, docType)
	c.cache.Set(key, response, ExtractionTTL)
	c.extractionCount.Add(1)
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
	if c.analysisCount.Load() >= MaxAnalysisEntries {
		return
	}
	key := c.buildAnalysisKey(userID, dateFrom, dateTo)
	c.cache.Set(key, response, AnalysisTTL)
	c.analysisCount.Add(1)
}

// InvalidateUserAnalysis removes all cached analysis results for a user.
func (c *AICacheService) InvalidateUserAnalysis(userID string) {
	prefix := fmt.Sprintf("ai:analyze:%s:", userID)
	c.cache.DeleteByPrefix(prefix)
	// Reset counter — we don't know exactly how many were deleted, but
	// clamping to 0 is safe (it may allow new entries sooner than necessary,
	// which is preferable to blocking them longer than necessary).
	c.analysisCount.Store(0)
}

// InvalidateUserExtractions removes all cached extraction results for a user.
func (c *AICacheService) InvalidateUserExtractions(userID string) {
	c.cache.DeleteByPrefix(extractionUserPrefix(userID))
	c.extractionCount.Store(0)
}

// extractionKeyVersion is bumped whenever the cached extraction response
// changes shape. It is part of the second key segment ("extract.v2"), not a
// segment of its own: InMemoryCache invalidates by the first three segments,
// so the user id must be the third one or invalidating one user's
// extractions would drop everybody's (and a prefix without the version would
// match nothing).
const extractionKeyVersion = "v2"

func extractionUserPrefix(userID string) string {
	return fmt.Sprintf("ai:extract.%s:%s:", extractionKeyVersion, userID)
}

func (c *AICacheService) buildExtractionKey(userID, fileHash, docType string) string {
	return extractionUserPrefix(userID) + fileHash + ":" + docType
}

func (c *AICacheService) buildAnalysisKey(userID, dateFrom, dateTo string) string {
	return fmt.Sprintf("ai:analyze:%s:%s:%s", userID, dateFrom, dateTo)
}
