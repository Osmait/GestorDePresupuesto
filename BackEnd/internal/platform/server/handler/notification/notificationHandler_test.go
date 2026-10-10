package notification

import (
	"bufio"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	notificationService "github.com/osmait/gestorDePresupuesto/internal/services/notification"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newSSETestServer(t *testing.T, heartbeat time.Duration) (*httptest.Server, *notificationService.NotificationService) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	svc := notificationService.NewNotificationService(nil)
	h := NewNotificationHandler(svc)
	h.SetHeartbeatInterval(heartbeat)

	r := gin.New()
	r.GET("/notifications", func(c *gin.Context) {
		c.Set("X-User-Id", "user-1")
		c.Next()
	}, h.Subscribe)

	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)
	return srv, svc
}

// readLine reads one line from the stream or fails after timeout.
func readLine(t *testing.T, reader *bufio.Reader, timeout time.Duration) string {
	t.Helper()
	type result struct {
		line string
		err  error
	}
	ch := make(chan result, 1)
	go func() {
		line, err := reader.ReadString('\n')
		ch <- result{line, err}
	}()
	select {
	case r := <-ch:
		require.NoError(t, r.err)
		return strings.TrimRight(r.line, "\n")
	case <-time.After(timeout):
		t.Fatalf("timed out waiting for a line from the SSE stream")
		return ""
	}
}

func TestSubscribe_SendsConnectedCommentImmediatelyAndHeartbeats(t *testing.T) {
	srv, svc := newSSETestServer(t, 50*time.Millisecond)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+"/notifications", nil)
	require.NoError(t, err)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, "text/event-stream", resp.Header.Get("Content-Type"))
	assert.Equal(t, "no", resp.Header.Get("X-Accel-Buffering"))

	reader := bufio.NewReader(resp.Body)
	// First bytes arrive immediately, before any event or heartbeat tick.
	assert.Equal(t, ": connected", readLine(t, reader, 2*time.Second))
	assert.Equal(t, "", readLine(t, reader, time.Second))

	// Then a ping comment shows up periodically.
	assert.Equal(t, ":ping", readLine(t, reader, 2*time.Second))
	assert.Equal(t, "", readLine(t, reader, time.Second))

	// Published events still arrive intact between heartbeats.
	svc.Publish("user-1", "message", `{"type":"info","message":"hi"}`)
	var event []string
	for len(event) < 3 {
		line := readLine(t, reader, 2*time.Second)
		if line == ":ping" || line == "" {
			continue
		}
		event = append(event, line)
	}
	assert.Equal(t, "data: {\"type\":\"info\",\"message\":\"hi\"}", event[1])
	assert.Equal(t, "event: message", event[2])
}

func TestSubscribe_UnauthenticatedIsRejected(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewNotificationHandler(notificationService.NewNotificationService(nil))
	r := gin.New()
	r.GET("/notifications", h.Subscribe)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/notifications", nil))
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}
