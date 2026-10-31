package server

import (
	"bufio"
	"context"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	notificationHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/notification"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	"github.com/osmait/gestorDePresupuesto/internal/platform/telemetry"
	"github.com/osmait/gestorDePresupuesto/internal/services/notification"
	"github.com/stretchr/testify/require"
)

func freeAddr(t *testing.T) string {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	addr := l.Addr().String()
	require.NoError(t, l.Close())
	return addr
}

// An open SSE stream must not hold the graceful shutdown until its deadline,
// and a clean shutdown returns nil (the process exits 0 on deploys).
func TestRun_ShutdownEndsOpenSSEStreamsPromptly(t *testing.T) {
	gin.SetMode(gin.TestMode)
	svc := notification.NewNotificationService(nil)
	h := notificationHandler.NewNotificationHandler(svc)
	h.SetHeartbeatInterval(time.Hour)

	streamsCtx, cancelStreams := context.WithCancel(context.Background())
	engine := gin.New()
	engine.GET("/notifications", func(c *gin.Context) {
		c.Set("X-User-Id", "user-1")
		c.Next()
	}, middleware.EndOnShutdown(streamsCtx), h.Subscribe)

	addr := freeAddr(t)
	shutdownTimeout := 20 * time.Second
	s := &Server{
		Engine:          engine,
		httpAddr:        addr,
		config:          &config.Config{},
		shutdownTimeout: &shutdownTimeout,
		telemetry:       telemetry.Disabled(),
		streamsCtx:      streamsCtx,
		cancelStreams:   cancelStreams,
	}

	ctx, stop := context.WithCancel(context.Background())
	runErr := make(chan error, 1)
	go func() { runErr <- s.Run(ctx) }()

	var resp *http.Response
	require.Eventually(t, func() bool {
		var err error
		resp, err = http.Get("http://" + addr + "/notifications")
		return err == nil
	}, 5*time.Second, 20*time.Millisecond)
	defer func() { _ = resp.Body.Close() }()
	line, err := bufio.NewReader(resp.Body).ReadString('\n')
	require.NoError(t, err)
	require.Equal(t, ": connected\n", line)

	start := time.Now()
	stop()
	select {
	case err := <-runErr:
		require.NoError(t, err, "a clean shutdown is not an error")
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not return: the open SSE stream is holding the shutdown")
	}
	require.Less(t, time.Since(start), 5*time.Second)
	require.Eventually(t, func() bool { return svc.ActiveStreams() == 0 }, 2*time.Second, 10*time.Millisecond)
}

// Past the deadline the remaining connections are closed and Run still
// returns nil.
func TestRun_ShutdownDeadlineIsNotAnError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	release := make(chan struct{})
	defer close(release)
	engine := gin.New()
	engine.GET("/slow", func(c *gin.Context) {
		select {
		case <-release:
		case <-time.After(10 * time.Second):
		}
		c.Status(http.StatusOK)
	})

	addr := freeAddr(t)
	shutdownTimeout := 100 * time.Millisecond
	s := &Server{
		Engine:          engine,
		httpAddr:        addr,
		config:          &config.Config{},
		shutdownTimeout: &shutdownTimeout,
		telemetry:       telemetry.Disabled(),
	}
	ctx, stop := context.WithCancel(context.Background())
	runErr := make(chan error, 1)
	go func() { runErr <- s.Run(ctx) }()

	started := make(chan struct{})
	go func() {
		require.Eventually(t, func() bool {
			conn, err := net.Dial("tcp", addr)
			if err == nil {
				_ = conn.Close()
			}
			return err == nil
		}, 5*time.Second, 20*time.Millisecond)
		close(started)
		resp, err := http.Get("http://" + addr + "/slow")
		if err == nil {
			_ = resp.Body.Close()
		}
	}()
	<-started
	time.Sleep(100 * time.Millisecond) // let the slow request reach the handler

	stop()
	select {
	case err := <-runErr:
		require.NoError(t, err)
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not return after the shutdown deadline")
	}
}
