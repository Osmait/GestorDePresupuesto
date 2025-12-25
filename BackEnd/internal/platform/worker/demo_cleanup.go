package worker

import (
	"context"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/services/user"
	"github.com/rs/zerolog/log"
)

type DemoCleanupWorker struct {
	userService *user.UserService
	interval    time.Duration
}

func NewDemoCleanupWorker(userService *user.UserService, interval time.Duration) *DemoCleanupWorker {
	return &DemoCleanupWorker{
		userService: userService,
		interval:    interval,
	}
}

func (w *DemoCleanupWorker) Start(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(w.interval)
		defer ticker.Stop()

		log.Info().Msg("Starting Demo Cleanup Worker")

		for {
			select {
			case <-ctx.Done():
				log.Info().Msg("Stopping Demo Cleanup Worker")
				return
			case <-ticker.C:
				log.Info().Msg("Running scheduled demo user cleanup")
				// Worker keeps 24h retention
				if err := w.userService.DeleteDemoUsers(ctx, 24*time.Hour); err != nil {
					log.Error().Err(err).Msg("Failed to cleanup demo users")
				} else {
					log.Info().Msg("Demo user cleanup completed successfully")
				}
			}
		}
	}()
}
