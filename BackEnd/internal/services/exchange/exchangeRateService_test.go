package exchange

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeUpstream struct {
	hits    atomic.Int32
	fail    atomic.Bool
	release chan struct{} // when non-nil, responses wait for it
}

func (f *fakeUpstream) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	f.hits.Add(1)
	if f.release != nil {
		<-f.release
	}
	if f.fail.Load() {
		http.Error(w, "down", http.StatusBadGateway)
		return
	}
	_, _ = w.Write([]byte(`{"ts":1,"base":"USD","quotes":{"DOP":60.123456789012}}`))
}

func newTestService(t *testing.T, up *fakeUpstream) *ExchangeRateService {
	t.Helper()
	srv := httptest.NewServer(up)
	t.Cleanup(srv.Close)
	return newExchangeRateService(srv.URL, srv.Client())
}

func TestGetUSDtoDOP_ConcurrentMissesShareOneFetch(t *testing.T) {
	up := &fakeUpstream{release: make(chan struct{})}
	s := newTestService(t, up)

	const callers = 32
	var wg sync.WaitGroup
	results := make([]*ExchangeRateResponse, callers)
	errs := make([]error, callers)
	for i := range callers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			results[i], errs[i] = s.GetUSDtoDOP(context.Background())
		}()
	}
	// Let every caller reach the singleflight before upstream answers.
	require.Eventually(t, func() bool { return up.hits.Load() == 1 }, 2*time.Second, time.Millisecond)
	time.Sleep(20 * time.Millisecond)
	close(up.release)
	wg.Wait()

	assert.Equal(t, int32(1), up.hits.Load(), "concurrent misses must share one upstream request")
	want := money.MustParse("60.1234567890")
	for i := range callers {
		require.NoError(t, errs[i])
		assert.True(t, results[i].USDToDOP.Equal(want), "got %s", results[i].USDToDOP)
		assert.False(t, results[i].LastUpdated.IsZero())
	}

	// Cached afterwards: no new upstream request.
	_, err := s.GetUSDtoDOP(context.Background())
	require.NoError(t, err)
	assert.Equal(t, int32(1), up.hits.Load())
}

func TestGetUSDtoDOP_CallerCancellationDoesNotFailOthers(t *testing.T) {
	up := &fakeUpstream{release: make(chan struct{})}
	s := newTestService(t, up)

	ctx, cancel := context.WithCancel(context.Background())
	firstErr := make(chan error, 1)
	go func() {
		_, err := s.GetUSDtoDOP(ctx)
		firstErr <- err
	}()
	require.Eventually(t, func() bool { return up.hits.Load() == 1 }, 2*time.Second, time.Millisecond)

	secondErr := make(chan error, 1)
	go func() {
		_, err := s.GetUSDtoDOP(context.Background())
		secondErr <- err
	}()

	cancel()
	assert.True(t, errors.Is(<-firstErr, context.Canceled))
	close(up.release)
	assert.NoError(t, <-secondErr, "the shared fetch must not be cancelled by the first caller")
	assert.Equal(t, int32(1), up.hits.Load())
}

func TestGetUSDtoDOP_ServesStaleRateWhenUpstreamFails(t *testing.T) {
	up := &fakeUpstream{}
	s := newTestService(t, up)

	first, err := s.GetUSDtoDOP(context.Background())
	require.NoError(t, err)

	// Expire the cache and break upstream.
	s.mu.Lock()
	s.lastFetch = time.Now().Add(-2 * s.cacheDuration)
	s.mu.Unlock()
	up.fail.Store(true)

	stale, err := s.GetUSDtoDOP(context.Background())
	require.NoError(t, err)
	assert.True(t, stale.USDToDOP.Equal(first.USDToDOP))
	assert.Equal(t, int32(2), up.hits.Load())

	// Within retryAfter the stale rate is served without hitting upstream.
	_, err = s.GetUSDtoDOP(context.Background())
	require.NoError(t, err)
	assert.Equal(t, int32(2), up.hits.Load())
}

func TestGetUSDtoDOP_NoCacheAndUpstreamDown(t *testing.T) {
	up := &fakeUpstream{}
	up.fail.Store(true)
	s := newTestService(t, up)

	_, err := s.GetUSDtoDOP(context.Background())
	assert.Error(t, err)
}
