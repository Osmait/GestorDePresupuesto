package errors

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/lib/pq"
)

func TestFromPostgresError(t *testing.T) {
	cases := []struct {
		code   pq.ErrorCode
		want   string
		status int
	}{
		{"22001", "VALUE_TOO_LONG", http.StatusBadRequest},
		{"22003", "VALUE_OUT_OF_RANGE", http.StatusBadRequest},
		{"22P02", "INVALID_VALUE", http.StatusBadRequest},
		{"23502", "MISSING_VALUE", http.StatusBadRequest},
		{"23503", "INVALID_REFERENCE", http.StatusBadRequest},
		{"23514", "CONSTRAINT_VIOLATION", http.StatusBadRequest},
		{"23505", "DUPLICATE_RESOURCE", http.StatusConflict},
	}
	for _, tc := range cases {
		raw := &pq.Error{Code: tc.code, Message: "value too long for type character varying(32)"}
		// Wrapped, as repositories/services usually return it.
		appErr, ok := FromPostgresError(fmt.Errorf("save payment: %w", raw))
		if !ok {
			t.Fatalf("%s: not mapped", tc.code)
		}
		if appErr.Code != tc.want || appErr.ToHTTPStatus() != tc.status {
			t.Errorf("%s: got %s/%d, want %s/%d", tc.code, appErr.Code, appErr.ToHTTPStatus(), tc.want, tc.status)
		}
		if !errors.Is(appErr, raw) {
			t.Errorf("%s: cause must be kept for logging", tc.code)
		}
		if appErr.Message == raw.Message {
			t.Errorf("%s: client message must not be the driver text", tc.code)
		}
	}

	if _, ok := FromPostgresError(&pq.Error{Code: "40001"}); ok {
		t.Error("serialization failures must stay unmapped (500)")
	}
	if _, ok := FromPostgresError(errors.New("boom")); ok {
		t.Error("non-postgres errors must stay unmapped")
	}
}
