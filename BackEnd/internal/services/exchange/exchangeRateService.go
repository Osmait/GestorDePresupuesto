package exchange

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

type ExchangeRateService struct {
	cachedRate    float64
	lastFetch     time.Time
	cacheDuration time.Duration
	mu            sync.RWMutex
	httpClient    *http.Client
}

type currencyAPIResponse struct {
	TS     int                `json:"ts"`
	Base   string             `json:"base"`
	Quotes map[string]float64 `json:"quotes"`
}

type ExchangeRateResponse struct {
	USDToDOP    float64   `json:"usd_to_dop"`
	LastUpdated time.Time `json:"last_updated"`
}

type ConvertResponse struct {
	USD  float64 `json:"usd"`
	DOP  float64 `json:"dop"`
	Rate float64 `json:"rate"`
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
	if time.Since(s.lastFetch) < s.cacheDuration && s.cachedRate > 0 {
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
		if s.cachedRate > 0 {
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

func (s *ExchangeRateService) ConvertUSDToDOP(ctx context.Context, amount float64) (*ConvertResponse, error) {
	rateResp, err := s.GetUSDtoDOP(ctx)
	if err != nil {
		return nil, err
	}

	dop := amount * rateResp.USDToDOP

	return &ConvertResponse{
		USD:  amount,
		DOP:  dop,
		Rate: rateResp.USDToDOP,
	}, nil
}

func (s *ExchangeRateService) fetchRate(ctx context.Context) (float64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return 0, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, err
	}

	var apiResp currencyAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return 0, err
	}

	dopRate, ok := apiResp.Quotes["DOP"]
	if !ok {
		return 0, err
	}

	s.mu.Lock()
	s.cachedRate = dopRate
	s.lastFetch = time.Now()
	s.mu.Unlock()

	return dopRate, nil
}
