package mcpcontext

import (
	"context"
	"database/sql"
)

type contextKey string

const (
	userIDKey contextKey = "mcp_user_id"
	dbTxKey   contextKey = "mcp_db_tx"
)

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
