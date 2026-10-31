package worker

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"
)

const (
	// DefaultDemoCleanupInitialDelay is how long after startup the first
	// cleanup runs: deploys are frequent, so waiting for a full interval meant
	// the cleanup almost never ran. The delay keeps it off the startup path.
	DefaultDemoCleanupInitialDelay = time.Minute
	// DefaultDemoCleanupInterval is the period between cleanups after the
	// first one. Deleting expired demo users is idempotent and cheap when
	// there is nothing to delete.
	DefaultDemoCleanupInterval = time.Hour
	// demoRetention is how long a demo user is kept.
	demoRetention = 24 * time.Hour
	// demoCleanupRunTimeout bounds one cleanup run.
	demoCleanupRunTimeout = 5 * time.Minute
)

// DemoUserDeleter deletes demo users created more than retention ago
// (implemented by *user.UserService).
type DemoUserDeleter interface {
	DeleteDemoUsers(ctx context.Context, retention time.Duration) error
}

// DemoCleanupWorker deletes expired demo users shortly after startup and then
// every interval.
type DemoCleanupWorker struct {
	deleter      DemoUserDeleter
	initialDelay time.Duration
	interval     time.Duration
	runTimeout   time.Duration
}

// NewDemoCleanupWorker returns a worker that first runs after initialDelay
// and then every interval (non-positive values use the defaults).
func NewDemoCleanupWorker(deleter DemoUserDeleter, initialDelay, interval time.Duration) *DemoCleanupWorker {
	if initialDelay <= 0 {
		initialDelay = DefaultDemoCleanupInitialDelay
	}
	if interval <= 0 {
		interval = DefaultDemoCleanupInterval
	}
	return &DemoCleanupWorker{
		deleter:      deleter,
		initialDelay: initialDelay,
		interval:     interval,
		runTimeout:   demoCleanupRunTimeout,
	}
}

// Start runs the worker in the background until ctx is cancelled.
func (w *DemoCleanupWorker) Start(ctx context.Context) {
	go w.loop(ctx)
}

func (w *DemoCleanupWorker) loop(ctx context.Context) {
	log.Info().Dur("initial_delay", w.initialDelay).Dur("interval", w.interval).Msg("Starting Demo Cleanup Worker")
	timer := time.NewTimer(w.initialDelay)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Stopping Demo Cleanup Worker")
			return
		case <-timer.C:
			w.runOnce(ctx)
			timer.Reset(w.interval)
		}
	}
}

func (w *DemoCleanupWorker) runOnce(ctx context.Context) {
	runCtx, cancel := context.WithTimeout(ctx, w.runTimeout)
	defer cancel()
	err := instrumentedRun(runCtx, "demo_cleanup", func(ctx context.Context) error {
		return w.deleter.DeleteDemoUsers(ctx, demoRetention)
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to cleanup demo users")
		return
	}
	log.Debug().Msg("Demo user cleanup completed")
}
