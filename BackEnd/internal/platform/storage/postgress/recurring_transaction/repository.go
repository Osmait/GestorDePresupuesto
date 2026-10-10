package recurring_transaction

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/lib/pq"

	"github.com/osmait/gestorDePresupuesto/internal/domain/recurring_transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
)

// ErrNotFound is returned when a recurring transaction does not exist or does
// not belong to the requesting user. Both cases are reported identically so
// callers cannot probe for other users' ids.
var ErrNotFound = errors.New("recurring transaction not found")

const dateLayout = "2006-01-02"

const selectColumns = `rt.id, rt.user_id, rt.name, COALESCE(rt.description, ''), rt.amount, rt.type,
	COALESCE(rt.account_id, ''), COALESCE(rt.category_id, ''), rt.budget_id, rt.day_of_month,
	rt.last_execution_date, rt.next_execution_date, rt.created_at, rt.updated_at`

type RecurringTransactionRepository struct {
	db *sql.DB
}

func NewRecurringTransactionRepository(db *sql.DB) *RecurringTransactionRepository {
	return &RecurringTransactionRepository{db: db}
}

type scanner interface {
	Scan(dest ...any) error
}

func scanRecurring(s scanner, extra ...any) (*recurring_transaction.RecurringTransaction, error) {
	var rt recurring_transaction.RecurringTransaction
	var budgetID sql.NullString
	var lastExecution, nextExecution sql.NullTime

	dest := []any{&rt.ID, &rt.UserID, &rt.Name, &rt.Description, &rt.Amount, &rt.Type, &rt.AccountID, &rt.CategoryID, &budgetID, &rt.DayOfMonth, &lastExecution, &nextExecution, &rt.CreatedAt, &rt.UpdatedAt}
	dest = append(dest, extra...)
	if err := s.Scan(dest...); err != nil {
		return nil, err
	}
	if budgetID.Valid {
		bid := budgetID.String
		rt.BudgetID = &bid
	}
	if lastExecution.Valid {
		t := lastExecution.Time
		rt.LastExecutionDate = &t
	}
	if nextExecution.Valid {
		t := recurring_transaction.CivilDate(nextExecution.Time)
		rt.NextExecutionDate = &t
	}
	return &rt, nil
}

func formatDate(t *time.Time) any {
	if t == nil {
		return nil
	}
	return recurring_transaction.CivilDate(*t).Format(dateLayout)
}

// ---------------------------------------------------------------------------
// User-facing CRUD. Every by-id query is scoped to the owning user.
// ---------------------------------------------------------------------------

func (r *RecurringTransactionRepository) Save(ctx context.Context, rt *recurring_transaction.RecurringTransaction) error {
	if rt.NextExecutionDate == nil {
		return errors.New("next_execution_date is required")
	}
	query := `INSERT INTO recurring_transactions (id, user_id, name, description, amount, type, account_id, category_id, budget_id, day_of_month, next_execution_date, created_at, updated_at)
			  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date, $12, $13)`
	_, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, rt.ID, rt.UserID, rt.Name, rt.Description, rt.Amount, rt.Type, rt.AccountID, rt.CategoryID, rt.BudgetID, rt.DayOfMonth, formatDate(rt.NextExecutionDate), rt.CreatedAt, rt.UpdatedAt)
	return err
}

// Update modifies the user-editable fields of a rule owned by rt.UserID.
// last_execution_date is never touched here; next_execution_date is only
// changed when rt.NextExecutionDate is non-nil.
func (r *RecurringTransactionRepository) Update(ctx context.Context, rt *recurring_transaction.RecurringTransaction) error {
	query := `UPDATE recurring_transactions
			  SET name=$1, description=$2, amount=$3, type=$4, account_id=$5, category_id=$6, budget_id=$7, day_of_month=$8,
			      next_execution_date=COALESCE($9::date, next_execution_date), updated_at=$10
			  WHERE id=$11 AND user_id=$12`
	res, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, rt.Name, rt.Description, rt.Amount, rt.Type, rt.AccountID, rt.CategoryID, rt.BudgetID, rt.DayOfMonth, formatDate(rt.NextExecutionDate), time.Now().UTC(), rt.ID, rt.UserID)
	if err != nil {
		return err
	}
	return requireAffected(res)
}

func (r *RecurringTransactionRepository) Delete(ctx context.Context, id, userID string) error {
	res, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, `DELETE FROM recurring_transactions WHERE id=$1 AND user_id=$2`, id, userID)
	if err != nil {
		return err
	}
	return requireAffected(res)
}

func requireAffected(res sql.Result) error {
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *RecurringTransactionRepository) FindByID(ctx context.Context, id, userID string) (*recurring_transaction.RecurringTransaction, error) {
	query := `SELECT ` + selectColumns + ` FROM recurring_transactions rt WHERE rt.id=$1 AND rt.user_id=$2`
	rt, err := scanRecurring(txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, query, id, userID))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return rt, err
}

func (r *RecurringTransactionRepository) FindAllByUser(ctx context.Context, userID string) ([]*recurring_transaction.RecurringTransaction, error) {
	query := `SELECT ` + selectColumns + ` FROM recurring_transactions rt WHERE rt.user_id=$1 ORDER BY rt.created_at DESC`
	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var results []*recurring_transaction.RecurringTransaction
	for rows.Next() {
		rt, err := scanRecurring(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, rt)
	}
	return results, rows.Err()
}

func (r *RecurringTransactionRepository) exists(ctx context.Context, query string, args ...any) (bool, error) {
	var ok bool
	err := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, query, args...).Scan(&ok)
	return ok, err
}

// AccountBelongsToUser reports whether accountID is owned by userID.
func (r *RecurringTransactionRepository) AccountBelongsToUser(ctx context.Context, accountID, userID string) (bool, error) {
	return r.exists(ctx, `SELECT EXISTS (SELECT 1 FROM account WHERE id=$1 AND user_id=$2)`, accountID, userID)
}

// CategoryBelongsToUser reports whether categoryID is owned by userID.
func (r *RecurringTransactionRepository) CategoryBelongsToUser(ctx context.Context, categoryID, userID string) (bool, error) {
	return r.exists(ctx, `SELECT EXISTS (SELECT 1 FROM categorys WHERE id=$1 AND user_id=$2)`, categoryID, userID)
}

// BudgetBelongsToUser reports whether budgetID is owned by userID.
func (r *RecurringTransactionRepository) BudgetBelongsToUser(ctx context.Context, budgetID, userID string) (bool, error) {
	return r.exists(ctx, `SELECT EXISTS (SELECT 1 FROM budgets WHERE id=$1 AND user_id=$2)`, budgetID, userID)
}

// ---------------------------------------------------------------------------
// Scheduler operations. These run inside an explicit *sql.Tx owned by the
// caller so that claiming a rule, creating the transaction, recording the
// execution and advancing the schedule commit (or roll back) together.
// ---------------------------------------------------------------------------

// BeginTx starts a scheduler transaction on a dedicated connection (never the
// per-request RLS transaction).
func (r *RecurringTransactionRepository) BeginTx(ctx context.Context) (*sql.Tx, error) {
	return r.db.BeginTx(ctx, nil)
}

// SetRLSContext sets the transaction-scoped RLS settings used by the policies
// (see migrations 000037/000039) so the scheduler works with or without the
// BYPASSRLS role attribute and the audit log records the owning user.
func (r *RecurringTransactionRepository) SetRLSContext(ctx context.Context, tx *sql.Tx, userID string, isAdmin bool) error {
	admin := "false"
	if isAdmin {
		admin = "true"
	}
	_, err := tx.ExecContext(ctx, `SELECT set_config('app.current_user_id', $1, true), set_config('app.is_admin', $2, true)`, userID, admin)
	return err
}

// DueRule is a claimed recurring transaction plus the currency of its account.
type DueRule struct {
	Rule            *recurring_transaction.RecurringTransaction
	AccountCurrency string
}

// ClaimNextDue locks (FOR UPDATE SKIP LOCKED) and returns one rule whose
// next_execution_date is on or before today. Rows locked by another worker are
// skipped, so concurrent runs never process the same occurrence. userID
// optionally restricts the claim to a single user; exclude lists rule ids that
// already failed during the current run. Returns nil when nothing is due.
func (r *RecurringTransactionRepository) ClaimNextDue(ctx context.Context, tx *sql.Tx, today time.Time, userID string, exclude []string) (*DueRule, error) {
	if exclude == nil {
		exclude = []string{}
	}
	query := `SELECT ` + selectColumns + `, COALESCE(NULLIF(a.currency, ''), 'DOP')
			  FROM recurring_transactions rt
			  JOIN account a ON a.id = rt.account_id AND a.user_id = rt.user_id
			  WHERE rt.next_execution_date <= $1::date
			    AND rt.category_id IS NOT NULL
			    AND ($2::text = '' OR rt.user_id = $2::text)
			    AND NOT (rt.id = ANY($3::varchar[]))
			  ORDER BY rt.next_execution_date, rt.id
			  LIMIT 1
			  FOR UPDATE OF rt SKIP LOCKED`
	var currency string
	rt, err := scanRecurring(tx.QueryRowContext(ctx, query, today.Format(dateLayout), userID, pq.Array(exclude)), &currency)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("claim due recurring transaction: %w", err)
	}
	return &DueRule{Rule: rt, AccountCurrency: currency}, nil
}

// RecordExecution inserts the idempotency row for (rule, occurrence date).
// It returns false when that occurrence was already executed.
func (r *RecurringTransactionRepository) RecordExecution(ctx context.Context, tx *sql.Tx, recurringID, userID string, executionDate time.Time) (bool, error) {
	res, err := tx.ExecContext(ctx, `INSERT INTO recurring_transaction_executions (recurring_transaction_id, execution_date, user_id)
		VALUES ($1, $2::date, $3)
		ON CONFLICT (recurring_transaction_id, execution_date) DO NOTHING`,
		recurringID, executionDate.Format(dateLayout), userID)
	if err != nil {
		return false, fmt.Errorf("record recurring execution: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return n == 1, nil
}

// SetExecutionTransaction links the created transaction to its execution row.
func (r *RecurringTransactionRepository) SetExecutionTransaction(ctx context.Context, tx *sql.Tx, recurringID string, executionDate time.Time, transactionID string) error {
	_, err := tx.ExecContext(ctx, `UPDATE recurring_transaction_executions SET transaction_id=$1
		WHERE recurring_transaction_id=$2 AND execution_date=$3::date`,
		transactionID, recurringID, executionDate.Format(dateLayout))
	return err
}

// AdvanceSchedule moves the rule to its next occurrence and records when it last ran.
func (r *RecurringTransactionRepository) AdvanceSchedule(ctx context.Context, tx *sql.Tx, recurringID string, next time.Time, executedAt time.Time) error {
	_, err := tx.ExecContext(ctx, `UPDATE recurring_transactions
		SET next_execution_date=$1::date, last_execution_date=$2, updated_at=$2
		WHERE id=$3`,
		next.Format(dateLayout), executedAt.UTC(), recurringID)
	return err
}
