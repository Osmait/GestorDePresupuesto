package middleware

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type compressItem struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	Message string `json:"message"`
}

func bigPayload(n int) []compressItem {
	out := make([]compressItem, n)
	for i := range out {
		out[i] = compressItem{ID: i, Name: "Supermercado Nacional", Message: "⚠️ Warning: You have used 75% of your budget"}
	}
	return out
}

func newCompressionRouter(extra ...gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(Compression(DefaultCompressionConfig()))
	for _, m := range extra {
		r.Use(m)
	}
	r.GET("/big", func(c *gin.Context) { c.JSON(http.StatusOK, bigPayload(200)) })
	r.GET("/small", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })
	r.GET("/nocontent", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	r.GET("/encoded", func(c *gin.Context) {
		c.Header("Content-Encoding", "br")
		c.Data(http.StatusOK, "application/json", bytes.Repeat([]byte("x"), 4096))
	})
	r.GET("/png", func(c *gin.Context) {
		c.Data(http.StatusOK, "image/png", bytes.Repeat([]byte{0x89}, 4096))
	})
	r.GET("/chunks", func(c *gin.Context) {
		c.Header("Content-Type", "text/plain; charset=utf-8")
		for range 100 {
			_, _ = c.Writer.WriteString("0123456789abcdefghij") // 20 B per write, 2000 B total
		}
	})
	r.GET("/late-status", func(c *gin.Context) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "first"})
		c.JSON(http.StatusInternalServerError, gin.H{"error": "second"}) // ignored, like gin
	})
	r.GET("/error", func(c *gin.Context) {
		c.JSON(http.StatusBadRequest, gin.H{"error": strings.Repeat("bad ", 400)})
	})
	return r
}

func doGet(r http.Handler, path, acceptEncoding string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if acceptEncoding != "" {
		req.Header.Set("Accept-Encoding", acceptEncoding)
	}
	r.ServeHTTP(w, req)
	return w
}

func gunzip(t *testing.T, b []byte) []byte {
	t.Helper()
	zr, err := gzip.NewReader(bytes.NewReader(b))
	require.NoError(t, err)
	out, err := io.ReadAll(zr)
	require.NoError(t, err)
	return out
}

func TestCompression_LargeJSONIsGzippedWithExactLength(t *testing.T) {
	r := newCompressionRouter()
	plain := doGet(r, "/big", "")
	w := doGet(r, "/big", "gzip, deflate, br")

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "gzip", w.Header().Get("Content-Encoding"))
	assert.Equal(t, "Accept-Encoding", w.Header().Get("Vary"))
	assert.Equal(t, "application/json; charset=utf-8", w.Header().Get("Content-Type"))
	assert.Equal(t, strconv.Itoa(w.Body.Len()), w.Header().Get("Content-Length"))
	assert.Less(t, w.Body.Len(), plain.Body.Len()/5)
	assert.Equal(t, plain.Body.Bytes(), gunzip(t, w.Body.Bytes()))
}

func TestCompression_SkipsWhenNotWorthIt(t *testing.T) {
	r := newCompressionRouter()
	cases := []struct {
		name, path, accept string
		status             int
	}{
		{"no accept-encoding", "/big", "", http.StatusOK},
		{"gzip refused", "/big", "gzip;q=0, deflate", http.StatusOK},
		{"identity only", "/big", "identity", http.StatusOK},
		{"small body", "/small", "gzip", http.StatusOK},
		{"no content", "/nocontent", "gzip", http.StatusNoContent},
		{"already encoded", "/encoded", "gzip", http.StatusOK},
		{"binary type", "/png", "gzip", http.StatusOK},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := doGet(r, tc.path, tc.accept)
			assert.Equal(t, tc.status, w.Code)
			if tc.path == "/encoded" {
				assert.Equal(t, "br", w.Header().Get("Content-Encoding"))
			} else {
				assert.Empty(t, w.Header().Get("Content-Encoding"))
			}
			assert.Equal(t, "Accept-Encoding", w.Header().Get("Vary"))
		})
	}
	assert.JSONEq(t, `{"ok":true}`, doGet(r, "/small", "gzip").Body.String())
}

func TestCompression_WildcardAndManySmallWrites(t *testing.T) {
	r := newCompressionRouter()
	w := doGet(r, "/chunks", "*")
	assert.Equal(t, "gzip", w.Header().Get("Content-Encoding"))
	assert.Equal(t, strings.Repeat("0123456789abcdefghij", 100), string(gunzip(t, w.Body.Bytes())))
}

func TestCompression_StatusIsFixedOnceBodyWritten(t *testing.T) {
	r := newCompressionRouter()
	for _, ae := range []string{"", "gzip"} {
		w := doGet(r, "/late-status", ae)
		assert.Equal(t, http.StatusBadRequest, w.Code, ae)
	}
}

func TestCompression_ErrorResponsesAreCompressedToo(t *testing.T) {
	r := newCompressionRouter()
	w := doGet(r, "/error", "gzip")
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "gzip", w.Header().Get("Content-Encoding"))
	assert.Contains(t, string(gunzip(t, w.Body.Bytes())), "bad bad")
}

func TestCompression_HeadAndExcludedPaths(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(Compression(DefaultCompressionConfig()))
	r.GET("/metrics", func(c *gin.Context) { c.String(http.StatusOK, strings.Repeat("m", 4096)) })
	r.GET("/mcp", func(c *gin.Context) { c.String(http.StatusOK, strings.Repeat("m", 4096)) })

	for _, p := range []string{"/metrics", "/mcp"} {
		w := doGet(r, p, "gzip")
		assert.Empty(t, w.Header().Get("Content-Encoding"), p)
		assert.Empty(t, w.Header().Get("Vary"), p)
		assert.Equal(t, 4096, w.Body.Len(), p)
	}
}

func TestAcceptsGzip(t *testing.T) {
	for header, want := range map[string]bool{
		"":                      false,
		"gzip":                  true,
		"GZIP":                  true,
		"deflate, gzip;q=0.5":   true,
		"gzip;q=0":              false,
		"gzip; q=0.0":           false,
		"*":                     true,
		"*;q=0":                 false,
		"*, gzip;q=0":           false,
		"br, identity":          false,
		"x-gzip":                true,
		"gzip;q=abc":            false,
		"deflate;q=1, *;q=0.1 ": true,
	} {
		assert.Equal(t, want, acceptsGzip(header), header)
	}
}

// The compressed body must be produced after RLSMiddleware committed, from
// the buffered response, and a failed commit must not leak the buffered
// (compressed or not) success body.
func TestCompression_WithRLSBuffering(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	mock.ExpectExec(`SELECT set_config`).WithArgs("user-1", "false", "15000", "30000").WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectCommit()
	mock.ExpectBegin()
	mock.ExpectExec(`SELECT set_config`).WithArgs("user-1", "false", "15000", "30000").WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectCommit().WillReturnError(assert.AnError)

	r := newCompressionRouter(injectUserContext("user-1", nil), RLSMiddleware(db))

	ok := doGet(r, "/big", "gzip")
	assert.Equal(t, http.StatusOK, ok.Code)
	assert.Equal(t, "gzip", ok.Header().Get("Content-Encoding"))
	assert.Equal(t, strconv.Itoa(ok.Body.Len()), ok.Header().Get("Content-Length"))
	assert.Contains(t, string(gunzip(t, ok.Body.Bytes())), "Supermercado Nacional")

	failed := doGet(r, "/big", "gzip")
	assert.Equal(t, http.StatusInternalServerError, failed.Code)
	assert.NotContains(t, failed.Body.String(), "Supermercado")
	assert.Empty(t, failed.Header().Get("Content-Encoding"))
	assert.Contains(t, failed.Body.String(), "could not commit transaction")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Over a real connection: Content-Length matches the bytes on the wire and
// a client that asks for gzip decodes the body transparently.
func TestCompression_RealServer(t *testing.T) {
	srv := httptest.NewServer(newCompressionRouter())
	defer srv.Close()

	raw := &http.Client{Transport: &http.Transport{DisableCompression: true}}
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/big", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	resp, err := raw.Do(req)
	require.NoError(t, err)
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	_ = resp.Body.Close()
	assert.Equal(t, "gzip", resp.Header.Get("Content-Encoding"))
	assert.Equal(t, int64(len(body)), resp.ContentLength)
	assert.Empty(t, resp.TransferEncoding)

	auto, err := http.Get(srv.URL + "/big") // default transport adds and strips gzip
	require.NoError(t, err)
	decoded, err := io.ReadAll(auto.Body)
	require.NoError(t, err)
	_ = auto.Body.Close()
	assert.True(t, auto.Uncompressed)
	assert.Equal(t, gunzip(t, body), decoded)
}

// SSE streams pass through untouched and are delivered as they are flushed.
func TestCompression_EventStreamIsNeverCompressed(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(Compression(CompressionConfig{}))
	release := make(chan struct{})
	r.GET("/stream", func(c *gin.Context) {
		c.Header("Content-Type", "text/event-stream")
		c.Status(http.StatusOK)
		_, _ = c.Writer.WriteString("data: " + strings.Repeat("x", 2048) + "\n\n")
		c.Writer.Flush()
		<-release
		_, _ = c.Writer.WriteString("data: second\n\n")
		c.Writer.Flush()
	})
	srv := httptest.NewServer(r)
	defer srv.Close()
	defer func() {
		select {
		case <-release:
		default:
			close(release)
		}
	}()

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/stream", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	resp, err := (&http.Client{Transport: &http.Transport{DisableCompression: true}, Timeout: 5 * time.Second}).Do(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()
	assert.Empty(t, resp.Header.Get("Content-Encoding"))

	reader := bufio.NewReader(resp.Body)
	line, err := reader.ReadString('\n') // arrives before the handler finishes
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(line, "data: xxx"))
	close(release)
	rest, _ := io.ReadAll(reader)
	assert.Contains(t, string(rest), "data: second")
}

// A flushed (non-SSE) compressible response streams gzip without a
// Content-Length.
func TestCompression_FlushSwitchesToStreaming(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(Compression(DefaultCompressionConfig()))
	r.GET("/ndjson", func(c *gin.Context) {
		c.Header("Content-Type", "application/json")
		for i := range 3 {
			_, _ = c.Writer.WriteString(strings.Repeat(strconv.Itoa(i), 1500) + "\n")
			c.Writer.Flush()
		}
	})
	srv := httptest.NewServer(r)
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/ndjson", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	resp, err := (&http.Client{Transport: &http.Transport{DisableCompression: true}}).Do(req)
	require.NoError(t, err)
	body, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	assert.Equal(t, "gzip", resp.Header.Get("Content-Encoding"))
	assert.Equal(t, int64(-1), resp.ContentLength)
	plain := string(gunzip(t, body))
	assert.Equal(t, strings.Repeat("0", 1500)+"\n"+strings.Repeat("1", 1500)+"\n"+strings.Repeat("2", 1500)+"\n", plain)
}
