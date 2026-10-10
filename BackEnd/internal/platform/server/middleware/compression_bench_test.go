package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/klauspost/compress/gzip"
)

// BenchmarkCompression measures the CPU and allocation cost of gzipping a
// JSON page (rows=20 ≈ 4 KB, rows=100 ≈ 21 KB, rows=400 ≈ 85 KB, about the
// size of the unbounded notification history) per compression level.
//
//	go test ./internal/platform/server/middleware -run '^$' -bench Compression -benchmem
func BenchmarkCompression(b *testing.B) {
	gin.SetMode(gin.ReleaseMode)
	for _, n := range []int{20, 100, 400} {
		page := benchPage(n)
		h := func(c *gin.Context) { c.JSON(http.StatusOK, page) }
		b.Run(fmt.Sprintf("identity/rows=%d", n), func(b *testing.B) {
			r := gin.New()
			r.Use(Compression(DefaultCompressionConfig()))
			r.GET("/x", h)
			serveBench(b, r, "/x")
		})
		for _, level := range []int{gzip.BestSpeed, gzip.DefaultCompression} {
			b.Run(fmt.Sprintf("gzip-%d/rows=%d", level, n), func(b *testing.B) {
				r := gin.New()
				cfg := DefaultCompressionConfig()
				cfg.Level = level
				r.Use(Compression(cfg))
				r.GET("/x", h)
				req := httptest.NewRequest(http.MethodGet, "/x", nil)
				req.Header.Set("Accept-Encoding", "gzip")
				b.ReportAllocs()
				var size int
				for b.Loop() {
					w := httptest.NewRecorder()
					r.ServeHTTP(w, req)
					size = w.Body.Len()
				}
				b.ReportMetric(float64(size), "wire-bytes")
			})
		}
	}
}
