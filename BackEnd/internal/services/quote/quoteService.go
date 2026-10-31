package quote

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/platform/telemetry"
	"github.com/rs/zerolog/log"
	"golang.org/x/sync/singleflight"
)

// quoteRequestTimeout bounds each upstream quote call. GetQuote tries up to
// three upstreams sequentially, so the worst case stays well below the
// server WriteTimeout.
const quoteRequestTimeout = 8 * time.Second

const (
	// quoteTTL is how long a fetched quote is served from memory.
	quoteTTL = 5 * time.Minute
	// quoteFailureTTL is how long a failed lookup is remembered: the
	// upstreams are not asked again for that symbol meanwhile.
	quoteFailureTTL = 90 * time.Second
	// quoteFetchTimeout bounds one shared lookup (all upstreams tried in
	// turn). It runs detached from the callers, who stop waiting when their
	// own context ends; the result still fills the cache.
	quoteFetchTimeout = 20 * time.Second
	// maxConcurrentQuoteFetches bounds upstream lookups in flight across
	// all symbols.
	maxConcurrentQuoteFetches = 4
	// maxCachedQuotes bounds the cache; past it, it is reset.
	maxCachedQuotes = 5000
)

// ErrQuoteUnavailable is returned when no upstream has a quote for the
// symbol (also served from the failure cache for quoteFailureTTL).
var ErrQuoteUnavailable = errors.New("quote not found")

// QuoteService looks up market quotes. Lookups are cached per symbol
// (quoteTTL, failures for quoteFailureTTL), concurrent lookups of a symbol
// share one upstream fetch (singleflight) and at most
// maxConcurrentQuoteFetches fetches run at once.
type QuoteService struct {
	client *http.Client

	// fetch looks a symbol up upstream (fetchUpstream; replaced in tests).
	fetch func(ctx context.Context, symbol string) (Quote, error)
	now   func() time.Time

	mu    sync.Mutex
	cache map[string]cachedQuote

	group singleflight.Group
	slots chan struct{}
}

// Quote is a market quote.
type Quote struct {
	Price    money.Amount
	Currency string
	Name     string
}

type cachedQuote struct {
	quote   Quote
	err     error
	expires time.Time
}

func NewQuoteService() *QuoteService {
	return newQuoteService(telemetry.NewHTTPClient(quoteRequestTimeout), nil)
}

func newQuoteService(client *http.Client, fetch func(ctx context.Context, symbol string) (Quote, error)) *QuoteService {
	s := &QuoteService{
		client: client,
		now:    time.Now,
		cache:  make(map[string]cachedQuote),
		slots:  make(chan struct{}, maxConcurrentQuoteFetches),
	}
	s.fetch = fetch
	if s.fetch == nil {
		s.fetch = s.fetchUpstream
	}
	return s
}

func (s *QuoteService) cached(symbol string) (cachedQuote, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.cache[symbol]
	if !ok || !s.now().Before(e.expires) {
		return cachedQuote{}, false
	}
	return e, true
}

func (s *QuoteService) store(symbol string, q Quote, err error) {
	ttl := quoteTTL
	if err != nil {
		ttl = quoteFailureTTL
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.cache) >= maxCachedQuotes {
		s.cache = make(map[string]cachedQuote)
	}
	s.cache[symbol] = cachedQuote{quote: q, err: err, expires: s.now().Add(ttl)}
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

// validSymbol is a stock/ETF ticker (AAPL, BRK.B) or a crypto pair (BTC-USD).
var validSymbol = regexp.MustCompile(`^[A-Z0-9][A-Z0-9.\-]{0,14}$`)

// ErrInvalidSymbol is returned for a symbol that is not a ticker.
var ErrInvalidSymbol = errors.New("invalid symbol")

// AssetClass tells the quote service which market a symbol belongs to, so a
// coin whose ticker is also an equity ticker is priced as the coin.
type AssetClass string

const (
	// AssetAny tries the equity upstreams first (Nasdaq stocks, Nasdaq
	// ETFs), then Binance.
	AssetAny AssetClass = ""
	// AssetCrypto tries Binance first, then the equity upstreams.
	AssetCrypto AssetClass = "crypto"
)

// cryptoKeyPrefix marks a crypto lookup in the cache and singleflight keys
// (":" is not a ticker character, so it cannot collide with a symbol).
const cryptoKeyPrefix = "crypto:"

// GetQuoteContext returns the quote of symbol, from the cache when it is
// fresh (or a recent failure). Otherwise it joins (or starts) the shared
// upstream lookup and waits for it until ctx ends; the lookup itself keeps
// running, bounded by quoteFetchTimeout, and fills the cache for later calls.
func (s *QuoteService) GetQuoteContext(ctx context.Context, symbol string) (money.Amount, string, string, error) {
	return s.GetAssetQuote(ctx, symbol, AssetAny)
}

// GetAssetQuote is GetQuoteContext for a symbol of a known asset class
// (AssetCrypto asks Binance first).
func (s *QuoteService) GetAssetQuote(ctx context.Context, symbol string, class AssetClass) (money.Amount, string, string, error) {
	// Clean symbol
	symbol = strings.ToUpper(strings.TrimSpace(symbol))
	// The symbol goes into the upstream URLs: only ticker characters, so it
	// cannot add query parameters or path segments.
	if !validSymbol.MatchString(symbol) {
		return money.Zero, "", "", ErrInvalidSymbol
	}
	key := symbol
	if class == AssetCrypto {
		key = cryptoKeyPrefix + symbol
	}
	symbol = key
	if s.cache == nil { // zero value (tests constructing QuoteService{})
		return s.fetchDirect(ctx, symbol)
	}

	if e, ok := s.cached(symbol); ok {
		return e.quote.Price, e.quote.Currency, e.quote.Name, e.err
	}

	// The shared lookup runs detached from this caller's cancellation (its
	// trace span is kept) so one caller giving up does not fail the others.
	detached := context.WithoutCancel(ctx)
	ch := s.group.DoChan(symbol, func() (any, error) {
		if e, ok := s.cached(symbol); ok { // refreshed while we waited
			return e.quote, e.err
		}
		fetchCtx, cancel := context.WithTimeout(detached, quoteFetchTimeout)
		defer cancel()
		select {
		case s.slots <- struct{}{}:
			defer func() { <-s.slots }()
		case <-fetchCtx.Done():
			return Quote{}, fetchCtx.Err() // not cached: transient
		}
		q, err := s.fetch(fetchCtx, symbol)
		if err != nil {
			// Logged once per symbol per failure window (the failure is
			// cached, so the upstreams are not asked again meanwhile).
			log.Ctx(detached).Warn().Err(err).Str("symbol", symbol).Dur("retry_in", quoteFailureTTL).Msg("quote lookup failed")
		}
		s.store(symbol, q, err)
		return q, err
	})

	select {
	case res := <-ch:
		q, _ := res.Val.(Quote)
		return q.Price, q.Currency, q.Name, res.Err
	case <-ctx.Done():
		return money.Zero, "", "", ctx.Err()
	}
}

func (s *QuoteService) fetchDirect(ctx context.Context, symbol string) (money.Amount, string, string, error) {
	q, err := s.fetchUpstream(ctx, symbol)
	return q.Price, q.Currency, q.Name, err
}

// fetchUpstream tries the upstreams in turn: Nasdaq stocks, Nasdaq ETFs,
// then Binance; Binance first for a crypto key (cryptoKeyPrefix).
func (s *QuoteService) fetchUpstream(ctx context.Context, key string) (Quote, error) {
	var (
		price          money.Amount
		currency, name string
		err            error
	)
	if symbol, ok := strings.CutPrefix(key, cryptoKeyPrefix); ok {
		price, currency, name, err = s.fetchCryptoFirst(ctx, symbol)
	} else {
		price, currency, name, err = s.fetchAll(ctx, key)
	}
	if err != nil {
		return Quote{}, err
	}
	return Quote{Price: price, Currency: currency, Name: name}, nil
}

// binancePair maps a coin symbol to its Binance USDT pair: BTC-USD and BTC
// become BTCUSDT; a symbol already quoted in a stablecoin is kept.
func binancePair(symbol string) string {
	pair := strings.ReplaceAll(symbol, "-USD", "USDT")
	for _, quoted := range []string{"USDT", "USDC", "FDUSD"} {
		if strings.HasSuffix(pair, quoted) && pair != quoted {
			return pair
		}
	}
	return pair + "USDT"
}

// fetchCryptoFirst prices a coin on Binance and only falls back to the
// equity upstreams when Binance has no pair for it.
func (s *QuoteService) fetchCryptoFirst(ctx context.Context, symbol string) (money.Amount, string, string, error) {
	price, currency, name, err := s.fetchBinance(ctx, binancePair(symbol))
	if err == nil {
		return price, currency, name, nil
	}
	if price, currency, name, equityErr := s.fetchEquity(ctx, symbol); equityErr == nil {
		return price, currency, name, nil
	}
	return money.Zero, "", "", fmt.Errorf("%w: %s", ErrQuoteUnavailable, err)
}

// fetchEquity tries Nasdaq stocks, then Nasdaq ETFs.
func (s *QuoteService) fetchEquity(ctx context.Context, symbol string) (money.Amount, string, string, error) {
	price, currency, name, err := s.fetchNasdaq(ctx, symbol, "stocks")
	if err == nil {
		return price, currency, name, nil
	}
	return s.fetchNasdaq(ctx, symbol, "etf")
}

func (s *QuoteService) fetchAll(ctx context.Context, symbol string) (money.Amount, string, string, error) {

	// Try Nasdaq (stocks, then ETFs) first
	price, currency, name, err := s.fetchEquity(ctx, symbol)
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

	return money.Zero, "", "", fmt.Errorf("%w: %s", ErrQuoteUnavailable, err)
}

func (s *QuoteService) fetchNasdaq(ctx context.Context, symbol, assetClass string) (money.Amount, string, string, error) {
	client := s.httpClient()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.nasdaq.com/api/quote/"+url.PathEscape(symbol)+"/info?assetclass="+url.QueryEscape(assetClass), nil)
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
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.binance.com/api/v3/ticker/price?symbol="+url.QueryEscape(symbol), nil)
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
