// Package ownership centralises the checks that keep one user from reading,
// changing or referencing another user's rows.
//
// The application role bypasses row level security, so every query that
// touches a user-owned row must be scoped explicitly. Repositories use the
// helpers in this package to:
//
//   - report "not found" and "not owned" with the same error (ErrNotFound), so
//     callers cannot probe for the existence of other users' ids, and
//   - verify that client supplied foreign keys (account_id, category_id, ...)
//     belong to the authenticated user before they are written.
package ownership

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	txhelper "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
)

// ErrNotFound is returned when a row does not exist or belongs to another user.
// It matches both errorhttp.ErrNotFound (mapped to HTTP 404 by the error
// middleware) and sql.ErrNoRows (which existing services already check for).
var ErrNotFound = fmt.Errorf("%w: %w", errorhttp.ErrNotFound, sql.ErrNoRows)

// ErrReferenceNotOwned is returned when a client supplied foreign key does not
// exist or belongs to another user. It wraps errorhttp.ErrBadRequest (HTTP 400).
var ErrReferenceNotOwned = fmt.Errorf("%w: referenced resource not found", errorhttp.ErrBadRequest)

// Table identifies a user-owned table that can be the target of a foreign key.
// Only the constants below are valid; the value is interpolated into SQL.
type Table string

const (
	Account     Table = "account"
	Category    Table = "categorys"
	Budget      Table = "budgets"
	Transaction Table = "transactions"
	Investment  Table = "investments"
	Certificate Table = "certificates"
)

func (t Table) label() string {
	switch t {
	case Account:
		return "account"
	case Category:
		return "category"
	case Budget:
		return "budget"
	case Transaction:
		return "transaction"
	case Investment:
		return "investment"
	case Certificate:
		return "certificate"
	default:
		return "resource"
	}
}

func (t Table) valid() bool {
	switch t {
	case Account, Category, Budget, Transaction, Investment, Certificate:
		return true
	default:
		return false
	}
}

// NotFoundIfNoRows converts sql.ErrNoRows into ErrNotFound and returns every
// other error unchanged.
func NotFoundIfNoRows(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

// RequireAffected returns ErrNotFound when an UPDATE/DELETE touched no rows.
func RequireAffected(result sql.Result) error {
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

// VerifyReference checks that the row `id` in `table` belongs to userID.
// An empty id is treated as "no reference" and accepted. The returned error
// wraps ErrReferenceNotOwned when the row is missing or owned by someone else.
func VerifyReference(ctx context.Context, q txhelper.Querier, userID string, table Table, id string) error {
	if id == "" {
		return nil
	}
	if !table.valid() {
		return fmt.Errorf("ownership: unsupported table %q", string(table))
	}
	if userID == "" {
		return fmt.Errorf("%w (%s)", ErrReferenceNotOwned, table.label())
	}

	var exists bool
	query := "SELECT EXISTS (SELECT 1 FROM " + string(table) + " WHERE id = $1 AND user_id = $2)"
	if err := q.QueryRowContext(ctx, query, id, userID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("%w (%s)", ErrReferenceNotOwned, table.label())
	}
	return nil
}

// Reference is a (table, id) pair to be verified with VerifyReferences.
type Reference struct {
	Table Table
	ID    string
}

// VerifyReferences runs VerifyReference for every reference, stopping at the
// first failure.
func VerifyReferences(ctx context.Context, q txhelper.Querier, userID string, refs ...Reference) error {
	for _, ref := range refs {
		if err := VerifyReference(ctx, q, userID, ref.Table, ref.ID); err != nil {
			return err
		}
	}
	return nil
}
