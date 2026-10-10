package middleware

import (
	"bufio"
	"bytes"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/klauspost/compress/gzip"
)

// DefaultCompressionMinSize is the smallest body worth compressing: below
// ~1 KB the gzip header/trailer and the CPU cost outweigh the savings.
const DefaultCompressionMinSize = 1024

// DefaultCompressionLevel trades a little ratio for speed: JSON compresses
// 7-10x at level 1 already, and CPU per request matters more here.
const DefaultCompressionLevel = gzip.BestSpeed

// maxPooledCompressBuffer caps the buffers kept in the pool, so one huge
// response does not pin its memory for the life of the process.
const maxPooledCompressBuffer = 256 << 10

// CompressionConfig configures Compression.
type CompressionConfig struct {
	// MinSize is the minimum body size compressed (default 1024 bytes).
	MinSize int
	// Level is the gzip level (default gzip.BestSpeed).
	Level int
	// ExcludedPaths are request paths never compressed (exact match).
	ExcludedPaths map[string]bool
	// ExcludedPrefixes are request path prefixes never compressed.
	ExcludedPrefixes []string
}

// DefaultCompressionConfig skips the SSE stream, the MCP transports (they
// stream and manage their own framing) and /metrics (promhttp negotiates its
// own compression).
func DefaultCompressionConfig() CompressionConfig {
	return CompressionConfig{
		MinSize:          DefaultCompressionMinSize,
		Level:            DefaultCompressionLevel,
		ExcludedPaths:    map[string]bool{"/notifications": true, "/metrics": true},
		ExcludedPrefixes: []string{"/mcp"},
	}
}

// Compression gzips response bodies for clients that accept it.
//
// The whole compressed body is buffered and sent at the end of the request
// with an exact Content-Length (responses below RLSMiddleware are buffered
// until the commit anyway, so this adds no latency); a Flush switches to
// streaming (chunked, no Content-Length). It must be registered outside
// (before) RLSMiddleware, so compression happens after the commit, when the
// buffered body is written out.
//
// Not compressed: HEAD requests, excluded paths, clients without gzip in
// Accept-Encoding (or gzip;q=0), bodies below MinSize, statuses without a
// body, text/event-stream and other non-text content types, and responses
// that already carry a Content-Encoding. Every response that could have
// been compressed gets Vary: Accept-Encoding.
func Compression(cfg CompressionConfig) gin.HandlerFunc {
	if cfg.MinSize <= 0 {
		cfg.MinSize = DefaultCompressionMinSize
	}
	if cfg.Level == 0 {
		cfg.Level = DefaultCompressionLevel
	}
	pool := &compressPool{level: cfg.Level}
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodHead || cfg.excluded(c.Request.URL.Path) {
			c.Next()
			return
		}
		addVary(c.Writer.Header(), "Accept-Encoding")
		if !acceptsGzip(c.Request.Header.Get("Accept-Encoding")) {
			c.Next()
			return
		}

		w := pool.getWriter(c.Writer, cfg.MinSize)
		c.Writer = w
		defer func() {
			w.finish()
			c.Writer = w.ResponseWriter
			pool.putWriter(w)
		}()
		c.Next()
	}
}

func (cfg CompressionConfig) excluded(path string) bool {
	if cfg.ExcludedPaths[path] {
		return true
	}
	for _, p := range cfg.ExcludedPrefixes {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}

// acceptsGzip reports whether an Accept-Encoding value allows gzip (an
// explicit gzip or a wildcard with a non-zero q-value).
func acceptsGzip(header string) bool {
	if header == "" {
		return false
	}
	gzipQ, starQ := -1.0, -1.0
	for _, part := range strings.Split(header, ",") {
		name, params, _ := strings.Cut(strings.TrimSpace(part), ";")
		q := 1.0
		if params != "" {
			for _, p := range strings.Split(params, ";") {
				k, v, ok := strings.Cut(strings.TrimSpace(p), "=")
				if ok && strings.EqualFold(strings.TrimSpace(k), "q") {
					if f, err := strconv.ParseFloat(strings.TrimSpace(v), 64); err == nil {
						q = f
					} else {
						q = 0
					}
				}
			}
		}
		switch strings.ToLower(strings.TrimSpace(name)) {
		case "gzip", "x-gzip":
			gzipQ = q
		case "*":
			starQ = q
		}
	}
	if gzipQ >= 0 {
		return gzipQ > 0
	}
	return starQ > 0
}

func addVary(h http.Header, value string) {
	for _, v := range h.Values("Vary") {
		for _, item := range strings.Split(v, ",") {
			item = strings.TrimSpace(item)
			if item == "*" || strings.EqualFold(item, value) {
				return
			}
		}
	}
	h.Add("Vary", value)
}

// compressible reports whether a Content-Type is worth compressing.
func compressible(contentType string) bool {
	ct := strings.ToLower(strings.TrimSpace(contentType))
	if i := strings.IndexByte(ct, ';'); i >= 0 {
		ct = strings.TrimSpace(ct[:i])
	}
	switch {
	case ct == "text/event-stream":
		return false
	case strings.HasPrefix(ct, "text/"),
		ct == "application/json",
		strings.HasSuffix(ct, "+json"),
		ct == "application/javascript",
		ct == "application/xml",
		strings.HasSuffix(ct, "+xml"),
		ct == "image/svg+xml":
		return true
	}
	return false
}

type compressPool struct {
	level   int
	writers sync.Pool // *gzipResponseWriter
	gzips   sync.Pool // *gzip.Writer
}

func (p *compressPool) getWriter(w gin.ResponseWriter, minSize int) *gzipResponseWriter {
	gw, _ := p.writers.Get().(*gzipResponseWriter)
	if gw == nil {
		gw = &gzipResponseWriter{}
	}
	gw.ResponseWriter = w
	gw.pool = p
	gw.minSize = minSize
	gw.status = w.Status()
	return gw
}

func (p *compressPool) putWriter(w *gzipResponseWriter) {
	pending, out := w.pending, w.out
	pending.Reset()
	out.Reset()
	if pending.Cap() > maxPooledCompressBuffer {
		pending = bytes.Buffer{}
	}
	if out.Cap() > maxPooledCompressBuffer {
		out = bytes.Buffer{}
	}
	*w = gzipResponseWriter{pending: pending, out: out}
	p.writers.Put(w)
}

func (p *compressPool) getGzip(dst *bytes.Buffer) *gzip.Writer {
	if z, ok := p.gzips.Get().(*gzip.Writer); ok {
		z.Reset(dst)
		return z
	}
	z, err := gzip.NewWriterLevel(dst, p.level)
	if err != nil {
		z = gzip.NewWriter(dst)
	}
	return z
}

type compressMode uint8

const (
	modeUndecided compressMode = iota
	modeCompress
	modePassthrough
)

// gzipResponseWriter decides on the first MinSize bytes (or the first
// Flush / the end of the request) whether to compress.
type gzipResponseWriter struct {
	gin.ResponseWriter
	pool    *compressPool
	minSize int

	mode        compressMode
	status      int
	wroteHeader bool // a status or body was produced (gin's Written())
	headersSent bool // headers went to the underlying writer
	size        int  // uncompressed bytes accepted

	pending bytes.Buffer // uncompressed bytes before the decision
	out     bytes.Buffer // compressed bytes not yet sent
	gz      *gzip.Writer
}

func (w *gzipResponseWriter) WriteHeader(code int) {
	if w.headersSent {
		w.ResponseWriter.WriteHeader(code)
		return
	}
	// Like gin's writer: once a body (or WriteHeaderNow) was produced the
	// status is fixed, even though it has not reached the client yet.
	if code > 0 && !w.wroteHeader {
		w.status = code
	}
}

func (w *gzipResponseWriter) WriteHeaderNow() {
	if w.headersSent || w.mode == modePassthrough {
		w.sendHeaders(-1)
		w.ResponseWriter.WriteHeaderNow()
		return
	}
	w.wroteHeader = true
}

func (w *gzipResponseWriter) Write(data []byte) (int, error) {
	w.wroteHeader = true
	w.size += len(data)
	switch w.mode {
	case modePassthrough:
		return w.ResponseWriter.Write(data)
	case modeCompress:
		return w.gz.Write(data)
	}
	ct := w.Header().Get("Content-Type")
	if ct == "" && w.pending.Len() == 0 && len(data) > 0 {
		// What net/http would do on the first write; it can no longer sniff
		// once the body is gzip.
		ct = http.DetectContentType(data)
		w.Header().Set("Content-Type", ct)
	}
	if ct != "" && !compressible(ct) {
		w.decide(false)
		return w.ResponseWriter.Write(data)
	}
	if w.pending.Len() == 0 && len(data) >= w.minSize {
		// Common case: the whole body in one write (gin renderers, the
		// RLS buffer) — no copy into pending.
		w.decide(true)
		if w.mode == modeCompress {
			return w.gz.Write(data)
		}
		return w.ResponseWriter.Write(data)
	}
	n, _ := w.pending.Write(data)
	if w.pending.Len() >= w.minSize {
		w.decideWithPending(true)
	}
	return n, nil
}

func (w *gzipResponseWriter) WriteString(s string) (int, error) {
	return w.Write([]byte(s))
}

// decideWithPending makes the decision and drains the pending bytes.
func (w *gzipResponseWriter) decideWithPending(bigEnough bool) {
	w.decide(bigEnough)
	if w.pending.Len() == 0 {
		return
	}
	if w.mode == modeCompress {
		_, _ = w.gz.Write(w.pending.Bytes())
	} else {
		_, _ = w.ResponseWriter.Write(w.pending.Bytes())
	}
	w.pending.Reset()
}

// decide picks compression or pass-through. Pass-through sends the headers
// right away; compression defers them until the compressed size is known.
func (w *gzipResponseWriter) decide(bigEnough bool) {
	if w.mode != modeUndecided {
		return
	}
	h := w.Header()
	if bigEnough && bodyAllowed(w.status) && h.Get("Content-Encoding") == "" &&
		compressible(h.Get("Content-Type")) {
		w.mode = modeCompress
		w.gz = w.pool.getGzip(&w.out)
		return
	}
	w.mode = modePassthrough
	w.sendHeaders(-1)
}

func bodyAllowed(status int) bool {
	return status >= http.StatusOK && status != http.StatusNoContent && status != http.StatusNotModified
}

// sendHeaders writes the status line. For a compressed body contentLength
// is its exact size, or -1 when it is streamed.
func (w *gzipResponseWriter) sendHeaders(contentLength int) {
	if w.headersSent {
		return
	}
	w.headersSent = true
	if w.mode == modeCompress {
		h := w.Header()
		h.Set("Content-Encoding", "gzip")
		h.Del("Accept-Ranges")
		if contentLength >= 0 {
			h.Set("Content-Length", strconv.Itoa(contentLength))
		} else {
			h.Del("Content-Length")
		}
	}
	w.ResponseWriter.WriteHeader(w.status)
}

// Flush sends everything produced so far and switches to streaming.
func (w *gzipResponseWriter) Flush() {
	w.wroteHeader = true
	if w.mode == modeUndecided {
		w.decideWithPending(w.pending.Len() >= w.minSize)
	}
	if w.mode == modeCompress {
		_ = w.gz.Flush()
		w.sendHeaders(-1)
		if w.out.Len() > 0 {
			_, _ = w.ResponseWriter.Write(w.out.Bytes())
			w.out.Reset()
		}
	} else {
		w.sendHeaders(-1)
	}
	w.ResponseWriter.Flush()
}

func (w *gzipResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if w.mode == modeUndecided {
		w.mode = modePassthrough
		w.headersSent = true // the hijacker owns the connection now
	}
	return w.ResponseWriter.Hijack()
}

// finish runs after the handler chain: it sends whatever is still buffered,
// with an exact Content-Length when the body was never flushed.
func (w *gzipResponseWriter) finish() {
	switch w.mode {
	case modeUndecided:
		if !w.wroteHeader {
			// Nothing produced: leave the real writer untouched so outer
			// middleware can still respond. Propagate a c.Status() though.
			if w.status != w.ResponseWriter.Status() {
				w.ResponseWriter.WriteHeader(w.status)
			}
			return
		}
		w.decideWithPending(false)
		w.sendHeaders(-1)
		w.ResponseWriter.WriteHeaderNow()
	case modeCompress:
		_ = w.gz.Close()
		w.sendHeaders(w.out.Len())
		if w.out.Len() > 0 {
			_, _ = w.ResponseWriter.Write(w.out.Bytes())
		}
		w.pool.gzips.Put(w.gz)
		w.gz = nil
	case modePassthrough:
	}
}

func (w *gzipResponseWriter) Status() int {
	if w.headersSent {
		return w.ResponseWriter.Status()
	}
	return w.status
}

func (w *gzipResponseWriter) Size() int {
	if !w.wroteHeader {
		return -1
	}
	return w.size
}

func (w *gzipResponseWriter) Written() bool {
	return w.wroteHeader || w.ResponseWriter.Written()
}

func (w *gzipResponseWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}
