package tasks

import (
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
)

// A statement date without a time comes back from the model as midnight UTC,
// which is the previous evening in Santo Domingo. ParseResponse keeps the
// calendar day (12:00 UTC); a real time is kept as given.
func TestParseResponse_KeepsTheCalendarDayOfDateOnlyValues(t *testing.T) {
	t.Parallel()
	extractor, err := NewTransactionExtractor()
	if err != nil {
		t.Fatal(err)
	}
	raw := `[
		{"name": "colmado", "amount": 100, "type_transation": "bill", "created_at": "2026-10-31T00:00:00Z"},
		{"name": "cena", "amount": 50, "type_transation": "bill", "created_at": "2026-10-31T21:30:00-04:00"}
	]`
	out, err := extractor.ParseResponse(raw)
	if err != nil {
		t.Fatal(err)
	}
	txs := out.([]*transaction.Transaction)
	if len(txs) != 2 {
		t.Fatalf("got %d transactions", len(txs))
	}
	if want := time.Date(2026, 10, 31, 12, 0, 0, 0, time.UTC); !txs[0].CreatedAt.Equal(want) {
		t.Errorf("date-only value = %s, want %s", txs[0].CreatedAt.UTC(), want)
	}
	if want := time.Date(2026, 11, 1, 1, 30, 0, 0, time.UTC); !txs[1].CreatedAt.Equal(want) {
		t.Errorf("timed value = %s, want %s", txs[1].CreatedAt.UTC(), want)
	}
}
