package mcpcontext

import (
	"context"
	"database/sql"
)

type contextKey string

const (
	userIDKey   contextKey = "mcp_user_id"
	dbTxKey     contextKey = "mcp_db_tx"
	readOnlyKey contextKey = "mcp_read_only"
)

// WithReadOnly marks the request as coming from a read-only grant (an OAuth
// token with only the mcp:read scope).
func WithReadOnly(ctx context.Context, readOnly bool) context.Context {
	return context.WithValue(ctx, readOnlyKey, readOnly)
}

// IsReadOnly reports whether the request may only call read tools.
func IsReadOnly(ctx context.Context) bool {
	v, _ := ctx.Value(readOnlyKey).(bool)
	return v
}

func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, userIDKey, userID)
}

func UserIDFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(userIDKey).(string); ok {
		return v
	}
	return ""
}

func WithTx(ctx context.Context, tx *sql.Tx) context.Context {
	return context.WithValue(ctx, dbTxKey, tx)
}

func TxFromContext(ctx context.Context) *sql.Tx {
	if v, ok := ctx.Value(dbTxKey).(*sql.Tx); ok {
		return v
	}
	return nil
}
