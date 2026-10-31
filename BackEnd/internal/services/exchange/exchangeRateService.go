package exchange

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/platform/telemetry"
	"github.com/rs/zerolog/log"
	"golang.org/x/sync/singleflight"
)

// ExchangeRateService serves the USD→DOP rate from an in-process cache
// refreshed from a third-party API at most once per cacheDuration.
//
// Concurrency: the cached rate and its timestamp are only read and written
// under mu, and concurrent cache misses share one upstream request
// (singleflight). The shared fetch runs on a context detached from the
// caller's cancellation (bounded by fetchTimeout), so one client
// disconnecting does not fail every request waiting on the same fetch; each
// caller still stops waiting when its own context ends.
type ExchangeRateService struct {
	mu            sync.RWMutex
	cachedRate    money.Amount
	lastFetch     time.Time
	lastFailure   time.Time
	lastErr       error
	cacheDuration time.Duration
	retryAfter    time.Duration
	fetchTimeout  time.Duration
	url           string
	httpClient    *http.Client
	group         singleflight.Group
}

// currencyAPIResponse is the third-party payload. Quotes are decoded straight
// from their JSON number text into money.Amount (no float64 step); the rate
// is then rounded once, half-even, to money.RateScale at this boundary.
type currencyAPIResponse struct {
	TS     int                     `json:"ts"`
	Base   string                  `json:"base"`
	Quotes map[string]money.Amount `json:"quotes"`
}

type ExchangeRateResponse struct {
	USDToDOP    money.Amount `json:"usd_to_dop"`
	LastUpdated time.Time    `json:"last_updated"`
}

type ConvertResponse struct {
	USD  money.Amount `json:"usd"`
	DOP  money.Amount `json:"dop"`
	Rate money.Amount `json:"rate"`
}

const (
	apiURL = "https://cdn.jsdelivr.net/gh/ismartcoding/currency-api@main/latest/data.json"
)

const defaultFetchTimeout = 10 * time.Second

func NewExchangeRateService() *ExchangeRateService {
	return newExchangeRateService(apiURL, telemetry.NewHTTPClient(defaultFetchTimeout))
}

func newExchangeRateService(url string, client *http.Client) *ExchangeRateService {
	return &ExchangeRateService{
		cacheDuration: 1 * time.Hour,
		retryAfter:    time.Minute,
		fetchTimeout:  defaultFetchTimeout,
		url:           url,
		httpClient:    client,
	}
}

// cached returns the cached rate and its timestamp, and whether it can be
// served without asking upstream: either it is fresh, or it is stale but
// upstream failed less than retryAfter ago (no refetch on every request
// while the API is down). ok is false when no rate was ever fetched.
func (s *ExchangeRateService) cached() (rate money.Amount, at time.Time, fresh, ok bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if !s.cachedRate.IsPositive() {
		return money.Zero, time.Time{}, false, false
	}
	fresh = time.Since(s.lastFetch) < s.cacheDuration ||
		(!s.lastFailure.IsZero() && time.Since(s.lastFailure) < s.retryAfter)
	return s.cachedRate, s.lastFetch, fresh, true
}

func (s *ExchangeRateService) recordFailure(err error) {
	s.mu.Lock()
	s.lastFailure = time.Now()
	s.lastErr = err
	s.mu.Unlock()
}

// recentFailure returns the last upstream error when it happened less than
// retryAfter ago.
func (s *ExchangeRateService) recentFailure() error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.lastErr != nil && time.Since(s.lastFailure) < s.retryAfter {
		return s.lastErr
	}
	return nil
}

// ErrRateUnavailable is returned while the upstream API is failing and no
// rate was ever fetched; callers fall back as they do for any rate error.
var ErrRateUnavailable = errors.New("exchange rate unavailable")

func (s *ExchangeRateService) GetUSDtoDOP(ctx context.Context) (*ExchangeRateResponse, error) {
	rate, at, fresh, ok := s.cached()
	if ok && fresh {
		return &ExchangeRateResponse{USDToDOP: rate, LastUpdated: at}, nil
	}
	// Negative cache before the first success too: while upstream is down
	// after a restart, fail fast for retryAfter instead of making every
	// request (budgets, analytics, summaries) wait up to fetchTimeout.
	if !ok {
		if err := s.recentFailure(); err != nil {
			return nil, fmt.Errorf("%w: %w", ErrRateUnavailable, err)
		}
	}

	ch := s.group.DoChan("usd_dop", func() (any, error) {
		// Another caller may have refreshed the cache while this one waited
		// for the singleflight slot.
		if rate, at, fresh, ok := s.cached(); ok && fresh {
			return &ExchangeRateResponse{USDToDOP: rate, LastUpdated: at}, nil
		}
		fetchCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), s.fetchTimeout)
		defer cancel()
		resp, err := s.fetchRate(fetchCtx)
		if err != nil {
			s.recordFailure(err)
			log.Ctx(ctx).Warn().Err(err).Msg("exchange rate fetch failed")
		}
		return resp, err
	})

	select {
	case res := <-ch:
		if res.Err == nil {
			resp := *res.Val.(*ExchangeRateResponse)
			return &resp, nil
		}
		// Upstream failed: serve the stale rate when there is one.
		if rate, at, _, ok := s.cached(); ok {
			return &ExchangeRateResponse{USDToDOP: rate, LastUpdated: at}, nil
		}
		return nil, res.Err
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (s *ExchangeRateService) ConvertUSDToDOP(ctx context.Context, amount money.Amount) (*ConvertResponse, error) {
	rateResp, err := s.GetUSDtoDOP(ctx)
	if err != nil {
		return nil, err
	}

	// Derived amount: exact product rounded half-even to cents.
	dop := amount.Mul(rateResp.USDToDOP).RoundCents()

	return &ConvertResponse{
		USD:  amount,
		DOP:  dop,
		Rate: rateResp.USDToDOP,
	}, nil
}

// fetchRate downloads the current rate and stores it in the cache.
func (s *ExchangeRateService) fetchRate(ctx context.Context) (*ExchangeRateResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("exchange rate API returned status %d", resp.StatusCode)
	}

	var apiResp currencyAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, err
	}

	dopRate, ok := apiResp.Quotes["DOP"]
	if !ok || !dopRate.IsPositive() {
		return nil, errors.New("exchange rate API returned no DOP quote")
	}
	dopRate = dopRate.Round(money.RateScale)

	now := time.Now()
	s.mu.Lock()
	s.cachedRate = dopRate
	s.lastFetch = now
	s.mu.Unlock()

	return &ExchangeRateResponse{USDToDOP: dopRate, LastUpdated: now}, nil
}
