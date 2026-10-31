package quote

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeUpstream struct {
	calls    atomic.Int32
	inFlight atomic.Int32
	maxSeen  atomic.Int32
	fail     atomic.Bool
	release  chan struct{} // when non-nil, fetches wait for it
}

func (f *fakeUpstream) fetch(ctx context.Context, symbol string) (Quote, error) {
	f.calls.Add(1)
	n := f.inFlight.Add(1)
	defer f.inFlight.Add(-1)
	for {
		m := f.maxSeen.Load()
		if n <= m || f.maxSeen.CompareAndSwap(m, n) {
			break
		}
	}
	if f.release != nil {
		select {
		case <-f.release:
		case <-ctx.Done():
			return Quote{}, ctx.Err()
		}
	}
	if f.fail.Load() {
		return Quote{}, ErrQuoteUnavailable
	}
	return Quote{Price: money.FromInt(100), Currency: "USD", Name: symbol}, nil
}

func newTestQuoteService(up *fakeUpstream, now *time.Time) *QuoteService {
	s := newQuoteService(nil, up.fetch)
	if now != nil {
		s.now = func() time.Time { return *now }
	}
	return s
}

func TestGetQuote_CachesForTTL(t *testing.T) {
	up := &fakeUpstream{}
	now := time.Now()
	s := newTestQuoteService(up, &now)

	for range 3 {
		price, _, _, err := s.GetQuoteContext(context.Background(), "aapl")
		require.NoError(t, err)
		assert.True(t, price.Equal(money.FromInt(100)))
	}
	assert.Equal(t, int32(1), up.calls.Load())

	now = now.Add(quoteTTL + time.Second)
	_, _, _, err := s.GetQuoteContext(context.Background(), "AAPL")
	require.NoError(t, err)
	assert.Equal(t, int32(2), up.calls.Load(), "refetched after the TTL")
}

func TestGetQuote_RemembersFailures(t *testing.T) {
	up := &fakeUpstream{}
	up.fail.Store(true)
	now := time.Now()
	s := newTestQuoteService(up, &now)

	for range 5 {
		_, _, _, err := s.GetQuoteContext(context.Background(), "NOPE")
		require.True(t, errors.Is(err, ErrQuoteUnavailable), "got %v", err)
	}
	assert.Equal(t, int32(1), up.calls.Load(), "a failed symbol is not retried on every request")

	now = now.Add(quoteFailureTTL + time.Second)
	up.fail.Store(false)
	_, _, _, err := s.GetQuoteContext(context.Background(), "NOPE")
	require.NoError(t, err)
	assert.Equal(t, int32(2), up.calls.Load())
}

func TestGetQuote_ConcurrentCallersShareOneFetch(t *testing.T) {
	up := &fakeUpstream{release: make(chan struct{})}
	s := newTestQuoteService(up, nil)

	var wg sync.WaitGroup
	for range 20 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _, _, err := s.GetQuoteContext(context.Background(), "MSFT")
			assert.NoError(t, err)
		}()
	}
	require.Eventually(t, func() bool { return up.calls.Load() == 1 }, time.Second, 5*time.Millisecond)
	close(up.release)
	wg.Wait()
	assert.Equal(t, int32(1), up.calls.Load())
}

// A caller stops waiting at its deadline; the shared fetch keeps running and
// fills the cache for the next call.
func TestGetQuote_CallerDeadlineDoesNotCancelTheFetch(t *testing.T) {
	up := &fakeUpstream{release: make(chan struct{})}
	s := newTestQuoteService(up, nil)

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	start := time.Now()
	_, _, _, err := s.GetQuoteContext(ctx, "NVDA")
	require.ErrorIs(t, err, context.DeadlineExceeded)
	assert.Less(t, time.Since(start), time.Second)

	close(up.release)
	require.Eventually(t, func() bool {
		_, ok := s.cached("NVDA")
		return ok
	}, time.Second, 5*time.Millisecond)
	price, _, _, err := s.GetQuoteContext(context.Background(), "NVDA")
	require.NoError(t, err)
	assert.True(t, price.Equal(money.FromInt(100)))
	assert.Equal(t, int32(1), up.calls.Load())
}

func TestGetQuote_BoundsConcurrentUpstreamFetches(t *testing.T) {
	up := &fakeUpstream{release: make(chan struct{})}
	s := newTestQuoteService(up, nil)

	symbols := []string{"A", "B", "C", "D", "E", "F", "G", "H", "I", "J"}
	var wg sync.WaitGroup
	for _, sym := range symbols {
		wg.Add(1)
		go func(sym string) {
			defer wg.Done()
			_, _, _, _ = s.GetQuoteContext(context.Background(), sym)
		}(sym)
	}
	require.Eventually(t, func() bool { return up.inFlight.Load() == maxConcurrentQuoteFetches }, time.Second, 5*time.Millisecond)
	time.Sleep(50 * time.Millisecond)
	assert.LessOrEqual(t, up.maxSeen.Load(), int32(maxConcurrentQuoteFetches))
	close(up.release)
	wg.Wait()
	assert.Equal(t, int32(len(symbols)), up.calls.Load())
	assert.LessOrEqual(t, up.maxSeen.Load(), int32(maxConcurrentQuoteFetches))
}
