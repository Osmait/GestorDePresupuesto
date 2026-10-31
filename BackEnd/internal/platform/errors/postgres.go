package errors

import (
	"context"
	stderrors "errors"
	"net/http"

	"github.com/lib/pq"
)

// IsDatabaseTimeout reports whether err (anywhere in its chain) is a query
// cancelled by statement_timeout (57014 query_canceled), a session ended by
// idle_in_transaction_session_timeout (25P03), or an expired request
// deadline. Those are transient overload conditions: 503, not 500.
func IsDatabaseTimeout(err error) bool {
	if err == nil {
		return false
	}
	if stderrors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var pqErr *pq.Error
	if stderrors.As(err, &pqErr) {
		return pqErr.Code == "57014" || pqErr.Code == "25P03"
	}
	return false
}

// FromPostgresError maps a PostgreSQL data/constraint error (anywhere in
// err's chain) to a client error with a stable code and a generic message.
// The raw driver text (column types, constraint names, values) is kept only
// as the cause, which is logged but never sent to the client. It returns
// false for errors that are not such Postgres errors; those stay 500s.
func FromPostgresError(err error) (*AppError, bool) {
	var pqErr *pq.Error
	if !stderrors.As(err, &pqErr) {
		return nil, false
	}

	var appErr *AppError
	switch pqErr.Code {
	case "22001": // string_data_right_truncation
		appErr = NewValidationError("VALUE_TOO_LONG", "A value is longer than the maximum allowed length")
	case "22003": // numeric_value_out_of_range
		appErr = NewValidationError("VALUE_OUT_OF_RANGE", "A numeric value is out of the allowed range")
	case "22P02", "22007", "22008": // invalid_text_representation, invalid/out-of-range datetime
		appErr = NewValidationError("INVALID_VALUE", "A value has an invalid format")
	case "23502": // not_null_violation
		appErr = NewValidationError("MISSING_VALUE", "A required value is missing")
	case "23503": // foreign_key_violation
		appErr = NewValidationError("INVALID_REFERENCE", "A referenced resource does not exist")
	case "23514": // check_violation
		appErr = NewValidationError("CONSTRAINT_VIOLATION", "A value violates a data constraint")
	case "23505": // unique_violation
		appErr = NewAppError(ErrorTypeConflict, "DUPLICATE_RESOURCE", "The resource already exists").
			WithDetails(map[string]interface{}{"http_status": http.StatusConflict})
	default:
		return nil, false
	}
	return appErr.WithCause(err), true
}
