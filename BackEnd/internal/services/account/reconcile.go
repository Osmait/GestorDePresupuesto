package account

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	categoryDomain "github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/platform/i18n"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/osmait/gestorDePresupuesto/internal/services/systemcategory"

	"github.com/segmentio/ksuid"
)

// reconciliationHistoryLimit caps GET /account/:id/reconciliations.
const reconciliationHistoryLimit = 50

var (
	// ErrReconciliationUnavailable is returned when the service was built
	// without WithReconciliation.
	ErrReconciliationUnavailable = errors.New("account reconciliation is not configured")
)

// AdjustmentWriter creates the adjustment transaction (TransactionService).
type AdjustmentWriter interface {
	CreateTransactionWithID(ctx context.Context, name, description string, amount money.Amount, typeTransaction string, accountId string, userId string, categoryId string, budgetId string, currency string, createdAt time.Time) (string, error)
}

// Option configures an AccountService.
type Option func(*AccountService)

// WithReconciliation enables Reconcile and the last-reconciled date on
// account responses.
func WithReconciliation(repo accountRepo.ReconciliationRepositoryInterface, writer AdjustmentWriter, categories systemcategory.Store) Option {
	return func(s *AccountService) {
		s.reconciliations = repo
		s.adjustments = writer
		s.categories = categories
	}
}

// ReconcileInput is the balance the user's bank shows right now.
type ReconcileInput struct {
	BankBalance money.Amount
	// Currency of the balance; empty means the account's currency.
	Currency string
	Notes    string
}

// ReconcileResult is the outcome of one reconciliation.
type ReconcileResult struct {
	Reconciliation *account.Reconciliation `json:"reconciliation"`
	// Difference is BankBalance - AppBalance: what the adjustment moved.
	Difference money.Amount `json:"difference"`
	// Adjusted is false when the balances already matched.
	Adjusted bool `json:"adjusted"`
}

// Reconcile compares the account's balance in currency with the one the user
// typed and, when they differ, writes one adjustment transaction for the
// difference (neutral in reports) so the account ends on BankBalance. Every
// call is recorded, also when nothing had to change, so the account shows
// when it was last checked.
//
// For a credit card the balance is its debt as a negative number (a card
// statement saying "you owe 1,000" is BankBalance -1000); the currency must
// be one the card has.
func (s *AccountService) Reconcile(ctx context.Context, accountId, userId string, in ReconcileInput) (*ReconcileResult, error) {
	if s.reconciliations == nil || s.adjustments == nil || s.categories == nil {
		return nil, ErrReconciliationUnavailable
	}

	// Locked like a transfer source: two concurrent reconciliations of the
	// same account are serialised, so the second one sees the first one's
	// adjustment instead of correcting the same difference twice.
	acc, err := s.accountRepository.FindByIdAndUserIdForUpdate(ctx, accountId, userId)
	if err != nil {
		return nil, notFound(err)
	}
	accountCurrency := normalizeCurrency(acc.Currency)
	currency := normalizeCurrency(in.Currency)
	if strings.TrimSpace(in.Currency) == "" {
		currency = accountCurrency
	}

	appBalance, err := s.accountRepository.BalanceByCurrency(ctx, accountId, userId, currency)
	if err != nil {
		return nil, err
	}
	// The initial balance is in the account's own currency.
	if currency == accountCurrency {
		appBalance = appBalance.Add(acc.InitialBalance)
	}

	rec := &account.Reconciliation{
		UserId:      userId,
		AccountId:   accountId,
		Currency:    currency,
		AppBalance:  appBalance,
		BankBalance: in.BankBalance,
		Notes:       strings.TrimSpace(in.Notes),
		CreatedAt:   time.Now(),
	}
	diff := rec.Difference()

	adjustmentType, adjust := account.AdjustmentType(diff)
	if adjust {
		categoryId, err := systemcategory.Ensure(ctx, s.categories, userId, categoryDomain.SystemBalanceAdjustment)
		if err != nil {
			return nil, err
		}
		description := rec.Notes
		if description == "" {
			description = i18n.T(ctx, i18n.BalanceAdjustmentDescription)
		}
		txId, err := s.adjustments.CreateTransactionWithID(ctx,
			i18n.T(ctx, i18n.BalanceAdjustmentName), description, diff.Abs(), adjustmentType,
			accountId, userId, categoryId, "", currency, rec.CreatedAt)
		if err != nil {
			return nil, err
		}
		rec.TransactionId = txId
	}

	id, err := ksuid.NewRandom()
	if err != nil {
		return nil, err
	}
	rec.Id = id.String()
	if err := s.reconciliations.Save(ctx, rec); err != nil {
		return nil, err
	}

	return &ReconcileResult{Reconciliation: rec, Difference: diff, Adjusted: adjust}, nil
}

// Reconciliations returns the latest reconciliations of the account, newest
// first.
func (s *AccountService) Reconciliations(ctx context.Context, accountId, userId string) ([]*account.Reconciliation, error) {
	if s.reconciliations == nil {
		return nil, ErrReconciliationUnavailable
	}
	if _, err := s.accountRepository.FindByIdAndUserId(ctx, accountId, userId); err != nil {
		return nil, notFound(err)
	}
	return s.reconciliations.FindByAccount(ctx, accountId, userId, reconciliationHistoryLimit)
}

// lastReconciledAt is the latest reconciliation per account, or nil when the
// service has no reconciliation repository.
func (s *AccountService) lastReconciledAt(ctx context.Context, userId string) (map[string]time.Time, error) {
	if s.reconciliations == nil {
		return nil, nil
	}
	return s.reconciliations.LastReconciledAt(ctx, userId)
}

// notFound maps a missing row to errorhttp.ErrNotFound (404).
func notFound(err error) error {
	if errors.Is(err, sql.ErrNoRows) && !errors.Is(err, errorhttp.ErrNotFound) {
		return errorhttp.ErrNotFound
	}
	return err
}

func normalizeCurrency(c string) string {
	c = strings.ToUpper(strings.TrimSpace(c))
	if c == "" {
		return "DOP"
	}
	return c
}
