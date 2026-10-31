package exchange

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Upstream down right after a restart (no rate ever fetched): after one
// failed fetch, requests fail fast for retryAfter instead of each waiting up
// to fetchTimeout; then upstream is retried.
func TestGetUSDtoDOP_FailsFastBeforeFirstSuccess(t *testing.T) {
	up := &fakeUpstream{}
	up.fail.Store(true)
	s := newTestService(t, up)

	_, err := s.GetUSDtoDOP(context.Background())
	require.Error(t, err)
	require.Equal(t, int32(1), up.hits.Load())

	for range 5 {
		_, err = s.GetUSDtoDOP(context.Background())
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrRateUnavailable), "got %v", err)
	}
	assert.Equal(t, int32(1), up.hits.Load(), "no upstream call within retryAfter")

	// Once the window has passed, upstream is asked again and a recovered
	// API is used.
	s.mu.Lock()
	s.lastFailure = time.Now().Add(-2 * s.retryAfter)
	s.mu.Unlock()
	up.fail.Store(false)

	resp, err := s.GetUSDtoDOP(context.Background())
	require.NoError(t, err)
	assert.True(t, resp.USDToDOP.IsPositive())
	assert.Equal(t, int32(2), up.hits.Load())
}
