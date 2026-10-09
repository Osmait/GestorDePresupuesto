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
)

type ExchangeRateService struct {
	cachedRate    money.Amount
	lastFetch     time.Time
	cacheDuration time.Duration
	mu            sync.RWMutex
	httpClient    *http.Client
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

func NewExchangeRateService() *ExchangeRateService {
	return &ExchangeRateService{
		cacheDuration: 1 * time.Hour,
		httpClient:    &http.Client{Timeout: 10 * time.Second},
	}
}

func (s *ExchangeRateService) GetUSDtoDOP(ctx context.Context) (*ExchangeRateResponse, error) {
	s.mu.RLock()
	if time.Since(s.lastFetch) < s.cacheDuration && s.cachedRate.IsPositive() {
		rate := s.cachedRate
		lastUpdate := s.lastFetch
		s.mu.RUnlock()
		return &ExchangeRateResponse{
			USDToDOP:    rate,
			LastUpdated: lastUpdate,
		}, nil
	}
	s.mu.RUnlock()

	rate, err := s.fetchRate(ctx)
	if err != nil {
		s.mu.RLock()
		if s.cachedRate.IsPositive() {
			cachedRate := s.cachedRate
			lastUpdate := s.lastFetch
			s.mu.RUnlock()
			return &ExchangeRateResponse{
				USDToDOP:    cachedRate,
				LastUpdated: lastUpdate,
			}, nil
		}
		s.mu.RUnlock()
		return nil, err
	}

	return &ExchangeRateResponse{
		USDToDOP:    rate,
		LastUpdated: s.lastFetch,
	}, nil
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

func (s *ExchangeRateService) fetchRate(ctx context.Context) (money.Amount, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return money.Zero, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return money.Zero, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return money.Zero, fmt.Errorf("exchange rate API returned status %d", resp.StatusCode)
	}

	var apiResp currencyAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return money.Zero, err
	}

	dopRate, ok := apiResp.Quotes["DOP"]
	if !ok || !dopRate.IsPositive() {
		return money.Zero, errors.New("exchange rate API returned no DOP quote")
	}
	dopRate = dopRate.Round(money.RateScale)

	s.mu.Lock()
	s.cachedRate = dopRate
	s.lastFetch = time.Now()
	s.mu.Unlock()

	return dopRate, nil
}
