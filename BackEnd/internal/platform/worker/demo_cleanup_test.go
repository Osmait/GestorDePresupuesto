package worker

import (
	"context"
	"sync"
	"testing"
	"time"
)

type fakeDemoDeleter struct {
	mu         sync.Mutex
	calls      []time.Duration
	deadlines  []bool
	callSignal chan struct{}
}

func (f *fakeDemoDeleter) DeleteDemoUsers(ctx context.Context, retention time.Duration) error {
	_, hasDeadline := ctx.Deadline()
	f.mu.Lock()
	f.calls = append(f.calls, retention)
	f.deadlines = append(f.deadlines, hasDeadline)
	f.mu.Unlock()
	f.callSignal <- struct{}{}
	return nil
}

func TestDemoCleanupWorker_RunsSoonAfterStartAndThenPeriodically(t *testing.T) {
	deleter := &fakeDemoDeleter{callSignal: make(chan struct{}, 10)}
	w := NewDemoCleanupWorker(deleter, 10*time.Millisecond, 20*time.Millisecond)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	start := time.Now()
	w.Start(ctx)

	for i := 0; i < 3; i++ {
		select {
		case <-deleter.callSignal:
		case <-time.After(2 * time.Second):
			t.Fatalf("run %d did not happen", i+1)
		}
		if i == 0 && time.Since(start) > time.Second {
			t.Fatalf("first run took %s; it must not wait for a full long interval", time.Since(start))
		}
	}
	cancel()

	deleter.mu.Lock()
	defer deleter.mu.Unlock()
	for i, retention := range deleter.calls {
		if retention != 24*time.Hour {
			t.Errorf("call %d: retention = %s, want 24h", i, retention)
		}
		if !deleter.deadlines[i] {
			t.Errorf("call %d: run context has no deadline", i)
		}
	}
}

func TestDemoCleanupWorker_StopsOnCancelBeforeFirstRun(t *testing.T) {
	deleter := &fakeDemoDeleter{callSignal: make(chan struct{}, 1)}
	w := NewDemoCleanupWorker(deleter, time.Hour, time.Hour)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		w.loop(ctx)
		close(done)
	}()
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("worker did not stop on cancel")
	}
	if len(deleter.calls) != 0 {
		t.Fatalf("unexpected run before the initial delay: %v", deleter.calls)
	}
}

func TestNewDemoCleanupWorker_Defaults(t *testing.T) {
	w := NewDemoCleanupWorker(&fakeDemoDeleter{}, 0, 0)
	if w.initialDelay != DefaultDemoCleanupInitialDelay || w.interval != DefaultDemoCleanupInterval {
		t.Fatalf("defaults = %s/%s", w.initialDelay, w.interval)
	}
}
