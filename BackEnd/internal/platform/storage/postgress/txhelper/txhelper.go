package txhelper

import (
	"context"
	"database/sql"

	"github.com/gin-gonic/gin"
)

// Querier is the common interface satisfied by both *sql.DB and *sql.Tx.
type Querier interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// FromContext extracts the RLS transaction from a Gin context when present,
// falling back to the provided *sql.DB for background workers and pre-auth paths.
func FromContext(ctx context.Context, db *sql.DB) Querier {
	if ginCtx, ok := ctx.Value(gin.ContextKey).(*gin.Context); ok {
		if txVal, exists := ginCtx.Get("db_tx"); exists {
			if tx, ok := txVal.(*sql.Tx); ok {
				return tx
			}
		}
	}
	// Also handle when the context IS the gin.Context directly
	if ginCtx, ok := ctx.(*gin.Context); ok {
		if txVal, exists := ginCtx.Get("db_tx"); exists {
			if tx, ok := txVal.(*sql.Tx); ok {
				return tx
			}
		}
	}
	return db
}
