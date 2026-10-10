package recurring_transaction

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/segmentio/ksuid"

	"github.com/osmait/gestorDePresupuesto/internal/domain/recurring_transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/mcp/mcpcontext"
	recurringRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/recurring_transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/notification"
	"github.com/osmait/gestorDePresupuesto/internal/services/transaction"
)

// DefaultTimezone is used when no location is configured.
const DefaultTimezone = "America/Santo_Domingo"

// maxOccurrencesPerRun bounds a single processing run as a safety net.
const maxOccurrencesPerRun = 10000

var (
	// ErrNotFound is returned when the rule does not exist or belongs to another user.
	ErrNotFound = recurringRepo.ErrNotFound
	// ErrInvalidReference is returned when account_id, category_id or
	// budget_id do not exist or are not owned by the authenticated user.
	ErrInvalidReference = errors.New("invalid reference")
	// ErrInvalidInput is returned for invalid rule fields (e.g. day_of_month).
	ErrInvalidInput = errors.New("invalid input")
)

type RecurringTransactionService struct {
	repo                *recurringRepo.RecurringTransactionRepository
	transactionService  *transaction.TransactionService
	notificationService *notification.NotificationService
	loc                 *time.Location
	now                 func() time.Time
}

// Option configures a RecurringTransactionService.
type Option func(*RecurringTransactionService)

// WithLocation sets the time zone in which calendar days are evaluated.
func WithLocation(loc *time.Location) Option {
	return func(s *RecurringTransactionService) {
		if loc != nil {
			s.loc = loc
		}
	}
}

// WithClock overrides the time source (used by tests).
func WithClock(now func() time.Time) Option {
	return func(s *RecurringTransactionService) {
		if now != nil {
			s.now = now
		}
	}
}

func NewRecurringTransactionService(repo *recurringRepo.RecurringTransactionRepository, transactionService *transaction.TransactionService, notificationService *notification.NotificationService, opts ...Option) *RecurringTransactionService {
	s := &RecurringTransactionService{
		repo:                repo,
		transactionService:  transactionService,
		notificationService: notificationService,
		now:                 time.Now,
	}
	for _, opt := range opts {
		opt(s)
	}
	if s.loc == nil {
		loc, err := time.LoadLocation(DefaultTimezone)
		if err != nil {
			log.Warn().Err(err).Str("timezone", DefaultTimezone).Msg("failed to load default time zone, falling back to UTC")
			loc = time.UTC
		}
		s.loc = loc
	}
	return s
}

// today returns the current calendar date in the configured time zone.
func (s *RecurringTransactionService) today() time.Time {
	return recurring_transaction.DateIn(s.now(), s.loc)
}

// validate checks the rule fields and that every referenced entity belongs to rt.UserID.
func (s *RecurringTransactionService) validate(ctx context.Context, rt *recurring_transaction.RecurringTransaction) error {
	if rt.UserID == "" {
		return fmt.Errorf("%w: missing user", ErrInvalidInput)
	}
	if err := recurring_transaction.ValidateDayOfMonth(rt.DayOfMonth); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidInput, err)
	}
	ok, err := s.repo.AccountBelongsToUser(ctx, rt.AccountID, rt.UserID)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("%w: account not found", ErrInvalidReference)
	}
	ok, err = s.repo.CategoryBelongsToUser(ctx, rt.CategoryID, rt.UserID)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("%w: category not found", ErrInvalidReference)
	}
	if rt.BudgetID != nil && *rt.BudgetID == "" {
		rt.BudgetID = nil
	}
	if rt.BudgetID != nil {
		ok, err = s.repo.BudgetBelongsToUser(ctx, *rt.BudgetID, rt.UserID)
		if err != nil {
			return err
		}
		if !ok {
			return fmt.Errorf("%w: budget not found", ErrInvalidReference)
		}
	}
	return nil
}

func (s *RecurringTransactionService) Create(ctx context.Context, rt *recurring_transaction.RecurringTransaction) error {
	if err := s.validate(ctx, rt); err != nil {
		return err
	}
	if rt.ID == "" {
		id, err := ksuid.NewRandom()
		if err != nil {
			return err
		}
		rt.ID = id.String()
	}
	next := recurring_transaction.FirstOccurrenceOnOrAfter(s.today(), rt.DayOfMonth)
	rt.NextExecutionDate = &next
	rt.LastExecutionDate = nil
	rt.CreatedAt = s.now().UTC()
	rt.UpdatedAt = rt.CreatedAt
	return s.repo.Save(ctx, rt)
}

func (s *RecurringTransactionService) FindAllByUser(ctx context.Context, userID string) ([]*recurring_transaction.RecurringTransaction, error) {
	return s.repo.FindAllByUser(ctx, userID)
}

// Update modifies a rule owned by rt.UserID. Returns ErrNotFound for rules of
// other users.
func (s *RecurringTransactionService) Update(ctx context.Context, rt *recurring_transaction.RecurringTransaction) error {
	existing, err := s.repo.FindByID(ctx, rt.ID, rt.UserID)
	if err != nil {
		return err
	}
	if err := s.validate(ctx, rt); err != nil {
		return err
	}
	rt.NextExecutionDate = nil // keep the stored schedule unless the day changes
	if existing.DayOfMonth != rt.DayOfMonth {
		next := recurring_transaction.RescheduleOnDayChange(s.today(), existing.NextExecutionDate, rt.DayOfMonth)
		rt.NextExecutionDate = &next
	}
	rt.UpdatedAt = s.now().UTC()
	return s.repo.Update(ctx, rt)
}

// Delete removes a rule owned by userID. Returns ErrNotFound otherwise.
func (s *RecurringTransactionService) Delete(ctx context.Context, id, userID string) error {
	return s.repo.Delete(ctx, id, userID)
}

// ProcessDueTransactions executes every due occurrence for all users.
//
// Semantics:
//   - "Today" is the calendar date in the configured time zone (APP_TIMEZONE).
//   - A rule is due when next_execution_date <= today. day_of_month values that
//     do not exist in a month are clamped to the month's last day.
//   - Catch-up: if the server was down, every missed occurrence is created
//     exactly once, each dated on its own occurrence date, oldest first.
//   - Each occurrence is processed in its own DB transaction that claims the
//     rule with SELECT ... FOR UPDATE SKIP LOCKED, inserts the idempotency row
//     (unique per rule and date), creates the transaction and advances the
//     schedule. Concurrent runs (several tickers or instances) therefore never
//     create the same occurrence twice.
func (s *RecurringTransactionService) ProcessDueTransactions(ctx context.Context) error {
	return s.processDue(ctx, "")
}

// ProcessDueTransactionsForUser is like ProcessDueTransactions but only
// touches rules owned by userID.
func (s *RecurringTransactionService) ProcessDueTransactionsForUser(ctx context.Context, userID string) error {
	if userID == "" {
		return fmt.Errorf("%w: missing user", ErrInvalidInput)
	}
	return s.processDue(ctx, userID)
}

type executedOccurrence struct {
	rule          *recurring_transaction.RecurringTransaction
	occurrence    time.Time
	transactionID string
}

func (s *RecurringTransactionService) processDue(parent context.Context, userID string) error {
	// Detach from request-scoped values (e.g. a gin context carrying the
	// per-request RLS transaction) so every repository call below uses the
	// scheduler's own transaction, while still honouring cancellation.
	ctx, cancel := detach(parent)
	defer cancel()

	today := s.today()
	var failed []string
	executed := 0

	for i := 0; i < maxOccurrencesPerRun; i++ {
		res, claimedID, err := s.processOne(ctx, today, userID, failed)
		if err != nil {
			if claimedID == "" {
				return err
			}
			log.Error().Err(err).Str("recurring_id", claimedID).Msg("failed to execute recurring transaction occurrence")
			failed = append(failed, claimedID)
			continue
		}
		if claimedID == "" {
			break // nothing left to process
		}
		if res != nil {
			executed++
			s.notify(ctx, res)
		}
	}

	if executed > 0 || len(failed) > 0 {
		log.Info().Int("executed", executed).Int("failed", len(failed)).Time("today", today).Msg("processed due recurring transactions")
	}
	return nil
}

// processOne claims and executes a single due occurrence. It returns the id
// of the claimed rule ("" when nothing was due) and the executed occurrence
// (nil when the occurrence had already been executed).
func (s *RecurringTransactionService) processOne(ctx context.Context, today time.Time, userID string, exclude []string) (res *executedOccurrence, claimedID string, err error) {
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, "", fmt.Errorf("begin scheduler transaction: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	if err := s.repo.SetRLSContext(ctx, tx, userID, userID == ""); err != nil {
		return nil, "", fmt.Errorf("set scheduler rls context: %w", err)
	}

	due, err := s.repo.ClaimNextDue(ctx, tx, today, userID, exclude)
	if err != nil {
		return nil, "", err
	}
	if due == nil {
		return nil, "", nil
	}
	rt := due.Rule
	claimedID = rt.ID

	// Drop the admin bypass and act as the rule owner for the writes.
	if err := s.repo.SetRLSContext(ctx, tx, rt.UserID, false); err != nil {
		return nil, claimedID, fmt.Errorf("set owner rls context: %w", err)
	}

	occurrence := recurring_transaction.CivilDate(*rt.NextExecutionDate)
	inserted, err := s.repo.RecordExecution(ctx, tx, rt.ID, rt.UserID, occurrence)
	if err != nil {
		return nil, claimedID, err
	}

	if inserted {
		budgetID := ""
		if rt.BudgetID != nil {
			budgetID = *rt.BudgetID
		}
		txCtx := mcpcontext.WithTx(ctx, tx)
		txnID, err := s.transactionService.CreateTransactionWithID(
			txCtx,
			rt.Name,
			rt.Description,
			rt.Amount,
			rt.Type,
			rt.AccountID,
			rt.UserID,
			rt.CategoryID,
			budgetID,
			due.AccountCurrency,
			s.occurrenceTimestamp(occurrence, today),
		)
		if err != nil {
			return nil, claimedID, fmt.Errorf("create transaction: %w", err)
		}
		if err := s.repo.SetExecutionTransaction(ctx, tx, rt.ID, occurrence, txnID); err != nil {
			return nil, claimedID, fmt.Errorf("link execution to transaction: %w", err)
		}
		res = &executedOccurrence{rule: rt, occurrence: occurrence, transactionID: txnID}
	} else {
		log.Warn().Str("recurring_id", rt.ID).Time("occurrence", occurrence).Msg("occurrence already executed, advancing schedule only")
	}

	next := recurring_transaction.NextOccurrenceAfter(occurrence, rt.DayOfMonth)
	if err := s.repo.AdvanceSchedule(ctx, tx, rt.ID, next, s.now()); err != nil {
		return nil, claimedID, fmt.Errorf("advance schedule: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, claimedID, fmt.Errorf("commit scheduler transaction: %w", err)
	}
	committed = true
	return res, claimedID, nil
}

// occurrenceTimestamp returns the created_at for an occurrence: the current
// instant for today's occurrence, or noon (in the configured zone) of the
// occurrence date for catch-up occurrences so they land on the right day.
func (s *RecurringTransactionService) occurrenceTimestamp(occurrence, today time.Time) time.Time {
	if occurrence.Equal(today) {
		return s.now()
	}
	return time.Date(occurrence.Year(), occurrence.Month(), occurrence.Day(), 12, 0, 0, 0, s.loc)
}

func (s *RecurringTransactionService) notify(ctx context.Context, res *executedOccurrence) {
	if s.notificationService == nil {
		return
	}
	payload, err := json.Marshal(map[string]any{
		"type":    "recurring_executed",
		"message": fmt.Sprintf("Transaction '%s' executed", res.rule.Name),
		"amount":  res.rule.Amount,
	})
	if err != nil {
		return
	}
	s.notificationService.SendToUser(ctx, res.rule.UserID, string(payload))
}

// detach returns a context that carries no values from parent but is
// cancelled when parent is.
func detach(parent context.Context) (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(context.Background())
	stop := context.AfterFunc(parent, cancel)
	return ctx, func() {
		stop()
		cancel()
	}
}
