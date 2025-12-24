package worker

import (
	"context"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/services/recurring_transaction"
	"github.com/rs/zerolog/log"
)

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

func (s *TransactionScheduler) runJob(ctx context.Context) {
	log.Debug().Msg("Running scheduled transaction check")
	if err := s.service.ProcessDueTransactions(ctx); err != nil {
		log.Error().Err(err).Msg("Error running scheduled transaction check")
	}
}
