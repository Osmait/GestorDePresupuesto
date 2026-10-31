package notification

import (
	"bufio"
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSubscribe_StreamIsRemovedWhenTheClientDisconnects(t *testing.T) {
	srv, svc := newSSETestServer(t, time.Hour)

	ctx, cancel := context.WithCancel(context.Background())
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+"/notifications", nil)
	require.NoError(t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	reader := bufio.NewReader(resp.Body)
	assert.Equal(t, ": connected", readLine(t, reader, 2*time.Second))
	assert.Equal(t, 1, svc.ActiveStreams())

	cancel()
	_ = resp.Body.Close()

	require.Eventually(t, func() bool { return svc.ActiveStreams() == 0 }, 2*time.Second, 10*time.Millisecond,
		"the stream must be removed with its last subscriber")
	assert.False(t, svc.GetServer().StreamExists("user-1"))
}
