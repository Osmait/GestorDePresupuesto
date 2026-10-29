package postgress

import (
	"context"
	"database/sql"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	txhelper "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/rs/zerolog/log"
)

// ReconciliationRepositoryInterface persists account reconciliations
// (migration 000058). Every method is scoped to the owning user.
type ReconciliationRepositoryInterface interface {
	Save(ctx context.Context, r *account.Reconciliation) error
	FindByAccount(ctx context.Context, accountId string, userId string, limit int) ([]*account.Reconciliation, error)
	// LastReconciledAt returns, per account of userId that was ever
	// reconciled, the time of its latest reconciliation.
	LastReconciledAt(ctx context.Context, userId string) (map[string]time.Time, error)
}

type ReconciliationRepository struct {
	db *sql.DB
}

func NewReconciliationRepository(db *sql.DB) *ReconciliationRepository {
	return &ReconciliationRepository{db: db}
}

func (repo *ReconciliationRepository) Save(ctx context.Context, r *account.Reconciliation) error {
	var transactionId sql.NullString
	if r.TransactionId != "" {
		transactionId = sql.NullString{String: r.TransactionId, Valid: true}
	}
	_, err := txhelper.FromContext(ctx, repo.db).ExecContext(ctx,
		`INSERT INTO account_reconciliations (id, user_id, account_id, currency, app_balance, bank_balance, transaction_id, notes, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		r.Id, r.UserId, r.AccountId, r.Currency, r.AppBalance, r.BankBalance, transactionId, r.Notes, r.CreatedAt)
	return err
}

// FindByAccount returns the latest `limit` reconciliations of the account,
// newest first.
func (repo *ReconciliationRepository) FindByAccount(ctx context.Context, accountId string, userId string, limit int) ([]*account.Reconciliation, error) {
	rows, err := txhelper.FromContext(ctx, repo.db).QueryContext(ctx,
		`SELECT id, account_id, currency, app_balance, bank_balance, COALESCE(transaction_id, ''), notes, created_at
		 FROM account_reconciliations
		 WHERE account_id = $1 AND user_id = $2
		 ORDER BY created_at DESC, id DESC
		 LIMIT $3`, accountId, userId, limit)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	result := make([]*account.Reconciliation, 0)
	for rows.Next() {
		r := &account.Reconciliation{UserId: userId}
		if err := rows.Scan(&r.Id, &r.AccountId, &r.Currency, &r.AppBalance, &r.BankBalance, &r.TransactionId, &r.Notes, &r.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

func (repo *ReconciliationRepository) LastReconciledAt(ctx context.Context, userId string) (map[string]time.Time, error) {
	rows, err := txhelper.FromContext(ctx, repo.db).QueryContext(ctx,
		`SELECT account_id, MAX(created_at) FROM account_reconciliations WHERE user_id = $1 GROUP BY account_id`, userId)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	result := make(map[string]time.Time)
	for rows.Next() {
		var accountId string
		var at time.Time
		if err := rows.Scan(&accountId, &at); err != nil {
			return nil, err
		}
		result[accountId] = at
	}
	return result, rows.Err()
}
