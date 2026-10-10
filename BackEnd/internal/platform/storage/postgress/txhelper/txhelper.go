package txhelper

import (
	"context"
	"database/sql"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/platform/mcp/mcpcontext"
)

// Querier is the common interface satisfied by both *sql.DB and *sql.Tx.
type Querier interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

type requestTxKey struct{}

// WithTx returns a copy of ctx carrying the request-scoped RLS transaction.
// RLSMiddleware stores the tx both in the Gin context ("db_tx") and, through
// this helper, in c.Request's context so that repositories receiving
// c.Request.Context() (instead of the *gin.Context) still run inside the
// request transaction rather than on a separate pool connection.
func WithTx(ctx context.Context, tx *sql.Tx) context.Context {
	return context.WithValue(ctx, requestTxKey{}, tx)
}

// FromContext extracts the RLS transaction from a Gin context when present,
// falling back to the provided *sql.DB for background workers and pre-auth paths.
func FromContext(ctx context.Context, db *sql.DB) Querier {
	if ctx == nil {
		return db
	}
	// Plain request context populated by RLSMiddleware via WithTx.
	if tx, ok := ctx.Value(requestTxKey{}).(*sql.Tx); ok && tx != nil {
		return tx
	}
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
	// Check for a transaction injected by an MCP tool handler via mcpcontext
	if tx := mcpcontext.TxFromContext(ctx); tx != nil {
		return tx
	}
	return db
}

// InTx runs fn atomically.
//
// When ctx carries a request-scoped transaction (RLSMiddleware or an MCP tool
// handler), fn runs directly on it: no nested transaction is opened and
// nothing is committed here. If fn fails, the error must be propagated so
// the request fails (c.Error / status >= 400) and the middleware rolls the
// whole request back — callers must never write compensating updates.
//
// Without a request transaction (background workers, tests) InTx opens a
// transaction on db, commits it when fn succeeds and rolls it back otherwise.
func InTx(ctx context.Context, db *sql.DB, fn func(q Querier) error) error {
	if q := FromContext(ctx, db); q != Querier(db) {
		return fn(q)
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit()
}
