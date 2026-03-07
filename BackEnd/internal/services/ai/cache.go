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

type AICacheService struct {
	cache           cache.CacheRepository
	extractionCount int32
	analysisCount   int32
}

func NewAICacheService(cache cache.CacheRepository) *AICacheService {
	return &AICacheService{
		cache: cache,
	}
}

func (c *AICacheService) GetExtraction(ctx context.Context, userID, fileHash, docType string) (*dto.ExtractResponse, bool) {
	key := c.buildExtractionKey(userID, fileHash, docType)
	if cached, found := c.cache.Get(key); found {
		response, ok := cached.(*dto.ExtractResponse)
		if ok {
			return response, true
		}
	}
	return nil, false
}

func (c *AICacheService) SetExtraction(ctx context.Context, userID, fileHash, docType string, response *dto.ExtractResponse) {
	c.checkAndEvictIfNeeded(true)
	key := c.buildExtractionKey(userID, fileHash, docType)
	c.cache.Set(key, response, ExtractionTTL)
	atomic.AddInt32(&c.extractionCount, 1)
}

func (c *AICacheService) GetAnalysis(ctx context.Context, userID, dateFrom, dateTo string) (*dto.SpendingAnalysisResponse, bool) {
	key := c.buildAnalysisKey(userID, dateFrom, dateTo)
	if cached, found := c.cache.Get(key); found {
		response, ok := cached.(*dto.SpendingAnalysisResponse)
		if ok {
			return response, true
		}
	}
	return nil, false
}

func (c *AICacheService) SetAnalysis(ctx context.Context, userID, dateFrom, dateTo string, response *dto.SpendingAnalysisResponse) {
	c.checkAndEvictIfNeeded(false)
	key := c.buildAnalysisKey(userID, dateFrom, dateTo)
	c.cache.Set(key, response, AnalysisTTL)
	atomic.AddInt32(&c.analysisCount, 1)
}

func (c *AICacheService) InvalidateUserAnalysis(userID string) {
	prefix := fmt.Sprintf("ai:analyze:%s:", userID)
	c.cache.DeleteByPrefix(prefix)
	atomic.StoreInt32(&c.analysisCount, 0)
}

func (c *AICacheService) InvalidateUserExtractions(userID string) {
	prefix := fmt.Sprintf("ai:extract:%s:", userID)
	c.cache.DeleteByPrefix(prefix)
	atomic.StoreInt32(&c.extractionCount, 0)
}

func (c *AICacheService) buildExtractionKey(userID, fileHash, docType string) string {
	return fmt.Sprintf("ai:extract:v2:%s:%s:%s", userID, fileHash, docType)
}

func (c *AICacheService) buildAnalysisKey(userID, dateFrom, dateTo string) string {
	return fmt.Sprintf("ai:analyze:%s:%s:%s", userID, dateFrom, dateTo)
}

func (c *AICacheService) checkAndEvictIfNeeded(isExtraction bool) {
	var maxEntries int32
	var currentCount *int32

	if isExtraction {
		maxEntries = MaxExtractionEntries
		currentCount = &c.extractionCount
	} else {
		maxEntries = MaxAnalysisEntries
		currentCount = &c.analysisCount
	}

	count := atomic.LoadInt32(currentCount)
	if count >= maxEntries {
		prefix := "ai:extract:"
		if !isExtraction {
			prefix = "ai:analyze:"
		}
		c.cache.DeleteByPrefix(prefix)
		atomic.StoreInt32(currentCount, 0)
	}
}
