package quote

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/platform/telemetry"
)

// quoteRequestTimeout bounds each upstream quote call. GetQuote tries up to
// three upstreams sequentially, so the worst case stays well below the
// server WriteTimeout.
const quoteRequestTimeout = 8 * time.Second

type QuoteService struct {
	client *http.Client
}

func NewQuoteService() *QuoteService {
	return &QuoteService{client: telemetry.NewHTTPClient(quoteRequestTimeout)}
}

func (s *QuoteService) httpClient() *http.Client {
	if s.client == nil {
		return &http.Client{Timeout: quoteRequestTimeout}
	}
	return s.client
}

// Nasdaq Response Structure
type NasdaqResponse struct {
	Data struct {
		Symbol      string `json:"symbol"`
		CompanyName string `json:"companyName"`
		PrimaryData struct {
			LastSalePrice string `json:"lastSalePrice"`
			Currency      string `json:"currency"`
		} `json:"primaryData"`
	} `json:"data"`
	Status struct {
		RCode int `json:"rCode"`
	} `json:"status"`
}

// Binance Response Structure
type BinanceResponse struct {
	Symbol string `json:"symbol"`
	Price  string `json:"price"`
}

// GetQuote is GetQuoteContext without a caller context.
func (s *QuoteService) GetQuote(symbol string) (money.Amount, string, string, error) {
	return s.GetQuoteContext(context.Background(), symbol)
}

// GetQuoteContext fetches a quote; ctx cancels the upstream calls and parents
// their client spans.
func (s *QuoteService) GetQuoteContext(ctx context.Context, symbol string) (money.Amount, string, string, error) {
	// Clean symbol
	symbol = strings.ToUpper(strings.TrimSpace(symbol))

	// Try Nasdaq first (Stocks)
	price, currency, name, err := s.fetchNasdaq(ctx, symbol, "stocks")
	if err == nil {
		return price, currency, name, nil
	}

	// Try Nasdaq second (ETF)
	price, currency, name, err = s.fetchNasdaq(ctx, symbol, "etf")
	if err == nil {
		return price, currency, name, nil
	}

	// If Nasdaq fails, try Binance (Crypto)
	// Map "BTC-USD" to "BTCUSDT"
	binanceSymbol := strings.ReplaceAll(symbol, "-USD", "USDT")
	if !strings.HasSuffix(binanceSymbol, "USDT") && (strings.Contains(binanceSymbol, "BTC") || strings.Contains(binanceSymbol, "ETH")) {
		binanceSymbol += "USDT"
	}

	price, currency, name, err = s.fetchBinance(ctx, binanceSymbol)
	if err == nil {
		return price, currency, name, nil
	}

	return money.Zero, "", "", fmt.Errorf("quote not found")
}

func (s *QuoteService) fetchNasdaq(ctx context.Context, symbol, assetClass string) (money.Amount, string, string, error) {
	client := s.httpClient()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.nasdaq.com/api/quote/"+symbol+"/info?assetclass="+assetClass, nil)
	if err != nil {
		return money.Zero, "", "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return money.Zero, "", "", err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != 200 {
		return money.Zero, "", "", fmt.Errorf("bad status")
	}

	var result NasdaqResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return money.Zero, "", "", err
	}

	if result.Status.RCode != 200 || result.Data.PrimaryData.LastSalePrice == "" || result.Data.PrimaryData.LastSalePrice == "N/A" {
		return money.Zero, "", "", fmt.Errorf("not found or empty")
	}

	priceStr := strings.ReplaceAll(result.Data.PrimaryData.LastSalePrice, "$", "")
	priceStr = strings.ReplaceAll(priceStr, ",", "")
	// Boundary: the API returns the price as text; parse it exactly once and
	// round half-even to the unit-price scale.
	price, err := parsePrice(priceStr)
	if err != nil {
		return money.Zero, "", "", err
	}

	// Nasdaq API often returns null currency, default to USD for US stocks
	curr := result.Data.PrimaryData.Currency
	if curr == "" {
		curr = "USD"
	}

	companyName := result.Data.CompanyName
	if companyName == "" {
		companyName = symbol // Fallback if name missing
	}

	return price, curr, companyName, nil
}

func (s *QuoteService) fetchBinance(ctx context.Context, symbol string) (money.Amount, string, string, error) {
	client := s.httpClient()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.binance.com/api/v3/ticker/price?symbol="+symbol, nil)
	if err != nil {
		return money.Zero, "", "", err
	}

	resp, err := client.Do(req)
	if err != nil {
		return money.Zero, "", "", err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != 200 {
		return money.Zero, "", "", fmt.Errorf("bad status")
	}

	var result BinanceResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return money.Zero, "", "", err
	}

	price, err := parsePrice(result.Price)
	if err != nil {
		return money.Zero, "", "", err
	}

	return price, "USD", result.Symbol, nil // Binance USDT is basically USD, return symbol as name
}

func parsePrice(raw string) (money.Amount, error) {
	price, err := money.Parse(raw)
	if err != nil {
		return money.Zero, err
	}
	return price.Round(money.PriceScale), nil
}
