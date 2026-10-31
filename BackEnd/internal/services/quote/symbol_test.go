package quote

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// The symbol is interpolated into the upstream URLs, so anything that is not
// a ticker is rejected before any request is made.
func TestGetQuote_RejectsNonTickerSymbols(t *testing.T) {
	t.Parallel()
	s := &QuoteService{}
	for _, bad := range []string{"AAPL?x=1", "AAPL/../x", "AAPL&symbol=BTC", "a b", "", "-AAPL", "TOOLONGSYMBOL12345"} {
		_, _, _, err := s.GetQuoteContext(context.Background(), bad)
		assert.ErrorIs(t, err, ErrInvalidSymbol, "%q", bad)
	}
	for _, ok := range []string{"AAPL", "brk.b", "BTC-USD", "VOO"} {
		assert.True(t, validSymbol.MatchString(strings.ToUpper(ok)), ok)
	}
}
