package ai

import (
	"context"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/platform/cache"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/ai"
)

func TestInvalidateUserExtractions_RemovesOnlyThatUsersEntries(t *testing.T) {
	ctx := context.Background()
	svc := NewAICacheService(cache.NewInMemoryCache(time.Minute, time.Minute))

	svc.SetExtraction(ctx, "u1", "hash-a", "receipt", &dto.ExtractResponse{})
	svc.SetExtraction(ctx, "u1", "hash-b", "statement", &dto.ExtractResponse{})
	svc.SetExtraction(ctx, "u2", "hash-a", "receipt", &dto.ExtractResponse{})

	svc.InvalidateUserExtractions("u1")

	if _, found := svc.GetExtraction(ctx, "u1", "hash-a", "receipt"); found {
		t.Fatal("u1 receipt extraction still cached after invalidation")
	}
	if _, found := svc.GetExtraction(ctx, "u1", "hash-b", "statement"); found {
		t.Fatal("u1 statement extraction still cached after invalidation")
	}
	if _, found := svc.GetExtraction(ctx, "u2", "hash-a", "receipt"); !found {
		t.Fatal("u2 extraction must survive u1's invalidation")
	}
}

func TestInvalidateUserAnalysis_RemovesOnlyThatUsersEntries(t *testing.T) {
	ctx := context.Background()
	svc := NewAICacheService(cache.NewInMemoryCache(time.Minute, time.Minute))

	svc.SetAnalysis(ctx, "u1", "2026-01-01", "2026-01-31", &dto.SpendingAnalysisResponse{})
	svc.SetAnalysis(ctx, "u2", "2026-01-01", "2026-01-31", &dto.SpendingAnalysisResponse{})

	svc.InvalidateUserAnalysis("u1")

	if _, found := svc.GetAnalysis(ctx, "u1", "2026-01-01", "2026-01-31"); found {
		t.Fatal("u1 analysis still cached after invalidation")
	}
	if _, found := svc.GetAnalysis(ctx, "u2", "2026-01-01", "2026-01-31"); !found {
		t.Fatal("u2 analysis must survive u1's invalidation")
	}
}

func TestAICacheService_ConcurrentSetsAreRaceFree(t *testing.T) {
	ctx := context.Background()
	svc := NewAICacheService(cache.NewInMemoryCache(time.Minute, time.Minute))
	done := make(chan struct{})
	for i := 0; i < 8; i++ {
		go func(i int) {
			defer func() { done <- struct{}{} }()
			for j := 0; j < 50; j++ {
				svc.SetExtraction(ctx, "u1", "h", "receipt", &dto.ExtractResponse{})
				svc.SetAnalysis(ctx, "u1", "a", "b", &dto.SpendingAnalysisResponse{})
				svc.InvalidateUserExtractions("u1")
			}
		}(i)
	}
	for i := 0; i < 8; i++ {
		<-done
	}
}
