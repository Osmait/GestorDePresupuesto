package notification

import (
	"bytes"
	"errors"
	"net/http"
	"sync"
	"time"
)

// errStreamClosed is returned for writes after the SSE handler returned.
var errStreamClosed = errors.New("sse: stream closed")

// heartbeatWriter wraps the SSE ResponseWriter so heartbeat comments can be
// interleaved with the events written by the SSE library without corrupting
// them: the library's writes are buffered and only reach the client, as one
// block, on Flush (the library flushes after every complete event), while the
// heartbeat goroutine writes whole comment lines under the same lock.
type heartbeatWriter struct {
	mu      sync.Mutex
	w       http.ResponseWriter
	flusher http.Flusher
	buf     bytes.Buffer
	started chan struct{}
	once    sync.Once
	closed  bool
}

func newHeartbeatWriter(w http.ResponseWriter) *heartbeatWriter {
	flusher, _ := w.(http.Flusher)
	return &heartbeatWriter{w: w, flusher: flusher, started: make(chan struct{})}
}

func (hw *heartbeatWriter) Header() http.Header { return hw.w.Header() }

// WriteHeader sends the status line followed immediately by a `: connected`
// comment, so the headers and a first body byte leave right away.
func (hw *heartbeatWriter) WriteHeader(status int) {
	hw.mu.Lock()
	defer hw.mu.Unlock()
	if hw.closed {
		return
	}
	hw.w.Header().Set("X-Accel-Buffering", "no")
	hw.w.WriteHeader(status)
	if status == http.StatusOK && hw.w.Header().Get("Content-Type") == "text/event-stream" {
		_, _ = hw.w.Write([]byte(": connected\n\n"))
		hw.flushLocked()
		hw.once.Do(func() { close(hw.started) })
	}
}

func (hw *heartbeatWriter) Write(p []byte) (int, error) {
	hw.mu.Lock()
	defer hw.mu.Unlock()
	if hw.closed {
		return 0, errStreamClosed
	}
	return hw.buf.Write(p)
}

// Flush delivers the buffered (complete) event to the client.
func (hw *heartbeatWriter) Flush() {
	hw.mu.Lock()
	defer hw.mu.Unlock()
	if hw.closed {
		return
	}
	hw.flushLocked()
}

func (hw *heartbeatWriter) flushLocked() {
	if hw.buf.Len() > 0 {
		_, _ = hw.w.Write(hw.buf.Bytes())
		hw.buf.Reset()
	}
	if hw.flusher != nil {
		hw.flusher.Flush()
	}
}

// Unwrap lets http.ResponseController reach the underlying writer.
func (hw *heartbeatWriter) Unwrap() http.ResponseWriter { return hw.w }

func (hw *heartbeatWriter) ping() {
	hw.mu.Lock()
	defer hw.mu.Unlock()
	if hw.closed {
		return
	}
	// Any partially written event stays buffered until the library flushes it.
	_, _ = hw.w.Write([]byte(":ping\n\n"))
	if hw.flusher != nil {
		hw.flusher.Flush()
	}
}

// run emits a heartbeat every interval once the stream has started, until
// stop or ctxDone is closed.
func (hw *heartbeatWriter) run(interval time.Duration, stop <-chan struct{}, ctxDone <-chan struct{}) {
	select {
	case <-hw.started:
	case <-stop:
		return
	case <-ctxDone:
		return
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			hw.ping()
		case <-stop:
			return
		case <-ctxDone:
			return
		}
	}
}

// close stops every further write to the underlying writer (the handler has returned).
func (hw *heartbeatWriter) close() {
	hw.mu.Lock()
	defer hw.mu.Unlock()
	hw.flushLocked()
	hw.closed = true
}
