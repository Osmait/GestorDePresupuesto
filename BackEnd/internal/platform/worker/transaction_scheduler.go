package worker

import (
	"context"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/services/recurring_transaction"
	"github.com/rs/zerolog/log"
)

// TransactionScheduler periodically executes due recurring transactions.
// It is safe to run in several replicas at once: each occurrence is claimed
// with SELECT ... FOR UPDATE SKIP LOCKED and guarded by a unique
// (recurring_transaction_id, execution_date) row, so it is created only once.
type TransactionScheduler struct {
	service *recurring_transaction.RecurringTransactionService
}

func NewTransactionScheduler(service *recurring_transaction.RecurringTransactionService) *TransactionScheduler {
	return &TransactionScheduler{
		service: service,
	}
}

func (s *TransactionScheduler) Start(ctx context.Context) {
	log.Info().Msg("Starting Transaction Scheduler")

	// Run immediately on start
	s.runJob(ctx)

	// Then run periodically
	ticker := time.NewTicker(1 * time.Hour)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				log.Info().Msg("Stopping Transaction Scheduler")
				return
			case <-ticker.C:
				s.runJob(ctx)
			}
		}
	}()
}

// schedulerRunTimeout bounds one scheduler run (the first one runs before
// the server starts listening): a stuck database must not hang startup or
// pile up runs.
const schedulerRunTimeout = 5 * time.Minute

func (s *TransactionScheduler) runJob(ctx context.Context) {
	log.Debug().Msg("Running scheduled transaction check")
	ctx, cancel := context.WithTimeout(ctx, schedulerRunTimeout)
	defer cancel()
	if err := instrumentedRun(ctx, "transaction_scheduler", s.service.ProcessDueTransactions); err != nil {
		log.Error().Err(err).Msg("Error running scheduled transaction check")
	}
}
