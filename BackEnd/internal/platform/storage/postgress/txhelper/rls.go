package txhelper

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"sync/atomic"
	"time"
)

// SessionLimits are the PostgreSQL timeouts applied, transaction-locally, to
// every transaction that runs on behalf of a user (the per-request RLS
// transaction, the short transactions of the AI routes, MCP tools and the
// recurring scheduler). Zero disables a limit.
type SessionLimits struct {
	// StatementTimeout cancels a single statement running longer than this
	// (statement_timeout, DB_STATEMENT_TIMEOUT).
	StatementTimeout time.Duration
	// IdleInTxTimeout terminates a session that sits idle inside an open
	// transaction longer than this (idle_in_transaction_session_timeout,
	// DB_IDLE_IN_TX_TIMEOUT), so a stuck handler cannot pin a connection.
	IdleInTxTimeout time.Duration
	// AcquireTimeout bounds the wait for a pooled connection in WithUserTx
	// (DB_TX_ACQUIRE_TIMEOUT).
	AcquireTimeout time.Duration
}

// DefaultSessionLimits are used until ConfigureSessionLimits is called.
var DefaultSessionLimits = SessionLimits{
	StatementTimeout: 15 * time.Second,
	IdleInTxTimeout:  30 * time.Second,
	AcquireTimeout:   5 * time.Second,
}

var sessionLimits atomic.Pointer[SessionLimits]

// ConfigureSessionLimits sets the limits applied by SetRLSContext and
// WithUserTx (called once at startup from the configuration).
func ConfigureSessionLimits(l SessionLimits) {
	sessionLimits.Store(&l)
}

// CurrentSessionLimits returns the configured limits.
func CurrentSessionLimits() SessionLimits {
	if l := sessionLimits.Load(); l != nil {
		return *l
	}
	return DefaultSessionLimits
}

// ErrDatabaseBusy is returned by WithUserTx when no pooled connection became
// available within SessionLimits.AcquireTimeout.
var ErrDatabaseBusy = errors.New("database busy: no connection available")

func millis(d time.Duration) string {
	if d <= 0 {
		return "0"
	}
	return strconv.FormatInt(d.Milliseconds(), 10)
}

// SetRLSContext scopes the rest of transaction q to userID: the settings read
// by the row level security policies (app.current_user_id, app.is_admin) and
// the session limits, all transaction-local (set_config(..., true) is the
// parameterized SET LOCAL), in one round trip. They are cleared when the
// transaction ends, so a pooled connection never leaks them.
func SetRLSContext(ctx context.Context, q Querier, userID string, isAdmin bool) error {
	admin := "false"
	if isAdmin {
		admin = "true"
	}
	l := CurrentSessionLimits()
	_, err := q.ExecContext(ctx,
		"SELECT set_config('app.current_user_id', $1, true),"+
			" set_config('app.is_admin', $2, true),"+
			" set_config('statement_timeout', $3, true),"+
			" set_config('idle_in_transaction_session_timeout', $4, true)",
		userID, admin, millis(l.StatementTimeout), millis(l.IdleInTxTimeout))
	return err
}

// WithUserTx runs fn in a short transaction scoped to userID (SetRLSContext)
// and commits it when fn succeeds. fn receives a context carrying the
// transaction, so repositories resolve it through FromContext, and
// AfterTx/AfterCommit callbacks registered inside fn run once it ends.
//
// It is for request code that must not hold a connection for its whole
// lifetime (routes registered before RLSMiddleware that call slow external
// services, e.g. the AI provider): do the reads, release the connection,
// call the service, then write in another WithUserTx.
//
// When ctx already carries a transaction (the route runs under
// RLSMiddleware, or an MCP tool), fn runs on it and nothing is committed
// here. The wait for a pooled connection is bounded by
// SessionLimits.AcquireTimeout (ErrDatabaseBusy).
func WithUserTx(ctx context.Context, db *sql.DB, userID string, isAdmin bool, fn func(ctx context.Context) error) error {
	if db == nil || FromContext(ctx, db) != Querier(db) {
		return fn(ctx)
	}
	if userID == "" {
		return errors.New("txhelper: WithUserTx without a user")
	}
	return withScopedTx(ctx, db, userID, isAdmin, fn)
}

// WithAdminTx is WithUserTx for system work that is not done on behalf of
// one user and must see every row: background jobs (demo cleanup) and the
// lookups that identify the user before anyone is authenticated (API key,
// passkey credential). The transaction gets app.is_admin = true and no
// app.current_user_id, so the row level security policies let it through
// even when the database role does not bypass RLS (NOBYPASSRLS, the
// recommended production setup, see docs/SECURITY.md).
//
// When ctx already carries a transaction fn runs on it unchanged: a request
// never gains admin visibility through this helper.
func WithAdminTx(ctx context.Context, db *sql.DB, fn func(ctx context.Context) error) error {
	if db == nil || FromContext(ctx, db) != Querier(db) {
		return fn(ctx)
	}
	return withScopedTx(ctx, db, "", true, fn)
}

// withScopedTx runs fn in a new transaction with the RLS settings of userID /
// isAdmin and commits it when fn succeeds.
func withScopedTx(ctx context.Context, db *sql.DB, userID string, isAdmin bool, fn func(ctx context.Context) error) error {
	conn, err := acquire(ctx, db, CurrentSessionLimits().AcquireTimeout)
	if err != nil {
		if ctx.Err() == nil {
			return fmt.Errorf("%w: %w", ErrDatabaseBusy, err)
		}
		return err
	}
	defer func() { _ = conn.Close() }()

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	hooks := NewTxHooks()
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
		hooks.Run()
	}()

	if err := SetRLSContext(ctx, tx, userID, isAdmin); err != nil {
		return fmt.Errorf("set rls context: %w", err)
	}
	if err := fn(WithTxHooks(WithTx(ctx, tx), hooks)); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	committed = true
	hooks.MarkCommitted()
	return nil
}

// acquire reserves a pooled connection, waiting at most timeout (when
// positive) on top of ctx.
func acquire(ctx context.Context, db *sql.DB, timeout time.Duration) (*sql.Conn, error) {
	if timeout <= 0 {
		return db.Conn(ctx)
	}
	acquireCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return db.Conn(acquireCtx)
}
