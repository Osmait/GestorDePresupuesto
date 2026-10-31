package quote

import (
	"context"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeMarkets answers the Nasdaq and Binance endpoints for one ticker that
// is both an equity and a coin, and records the order of the calls.
type fakeMarkets struct {
	mu    sync.Mutex
	calls []string
}

func (f *fakeMarkets) RoundTrip(req *http.Request) (*http.Response, error) {
	f.mu.Lock()
	f.calls = append(f.calls, req.URL.Host+req.URL.Path+"?"+req.URL.RawQuery)
	f.mu.Unlock()
	body := `{}`
	switch {
	case req.URL.Host == "api.nasdaq.com":
		body = `{"data":{"symbol":"COIN","companyName":"Equity Co","primaryData":{"lastSalePrice":"$12.34","currency":"USD"}},"status":{"rCode":200}}`
	case req.URL.Host == "api.binance.com" && req.URL.Query().Get("symbol") == "COINUSDT":
		body = `{"symbol":"COINUSDT","price":"0.5000"}`
	default:
		return &http.Response{StatusCode: http.StatusBadRequest, Body: io.NopCloser(strings.NewReader(body)), Request: req}, nil
	}
	return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Request: req}, nil
}

func TestGetAssetQuote_CryptoAsksBinanceFirst(t *testing.T) {
	t.Parallel()
	markets := &fakeMarkets{}
	s := newQuoteService(&http.Client{Transport: markets}, nil)

	price, _, name, err := s.GetAssetQuote(context.Background(), "coin", AssetCrypto)
	require.NoError(t, err)
	assert.Equal(t, "0.5", price.String())
	assert.Equal(t, "COINUSDT", name)
	require.Len(t, markets.calls, 1)
	assert.Contains(t, markets.calls[0], "api.binance.com")

	// Without a class (or for a stock) the equity wins, as before; the two
	// lookups are cached separately.
	price, _, name, err = s.GetQuoteContext(context.Background(), "COIN")
	require.NoError(t, err)
	assert.Equal(t, "12.34", price.String())
	assert.Equal(t, "Equity Co", name)
	assert.Contains(t, markets.calls[1], "api.nasdaq.com")
}

func TestGetAssetQuote_CryptoFallsBackToEquities(t *testing.T) {
	t.Parallel()
	markets := &fakeMarkets{}
	s := newQuoteService(&http.Client{Transport: markets}, nil)

	// No Binance pair for this one: the Nasdaq quote is used.
	price, _, _, err := s.GetAssetQuote(context.Background(), "OTHER", AssetCrypto)
	require.NoError(t, err)
	assert.Equal(t, "12.34", price.String())
	require.Len(t, markets.calls, 2)
	assert.Contains(t, markets.calls[0], "symbol=OTHERUSDT")
	assert.Contains(t, markets.calls[1], "api.nasdaq.com")
}

func TestBinancePair(t *testing.T) {
	t.Parallel()
	for in, want := range map[string]string{
		"BTC":     "BTCUSDT",
		"BTC-USD": "BTCUSDT",
		"SOL":     "SOLUSDT",
		"ETHUSDT": "ETHUSDT",
		"ETHUSDC": "ETHUSDC",
		"USDT":    "USDTUSDT",
	} {
		assert.Equal(t, want, binancePair(in), in)
	}
}
