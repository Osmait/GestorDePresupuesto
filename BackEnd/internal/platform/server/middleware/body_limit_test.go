package middleware

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func bodyLimitEngine(seen *string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(BodyLimit(16, map[string]int64{"/ai/": 64}))
	handler := func(c *gin.Context) {
		b, _ := io.ReadAll(c.Request.Body)
		*seen = string(b)
		c.Status(http.StatusOK)
	}
	r.POST("/transaction", handler)
	r.POST("/ai/extract", handler)
	r.GET("/account", handler)
	return r
}

// onlyReader hides the length so the request is sent like a chunked body.
type onlyReader struct{ io.Reader }

func TestBodyLimit(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name     string
		path     string
		body     io.Reader
		wantCode int
		wantSeen string
	}{
		{"small body reaches the handler", "/transaction", strings.NewReader(`{"a":1}`), http.StatusOK, `{"a":1}`},
		{"declared length over the cap", "/transaction", strings.NewReader(strings.Repeat("x", 17)), http.StatusRequestEntityTooLarge, ""},
		{"unknown length over the cap", "/transaction", onlyReader{strings.NewReader(strings.Repeat("x", 17))}, http.StatusRequestEntityTooLarge, ""},
		{"prefix with its own cap", "/ai/extract", strings.NewReader(strings.Repeat("x", 40)), http.StatusOK, strings.Repeat("x", 40)},
		{"prefix cap is enforced too", "/ai/extract", strings.NewReader(strings.Repeat("x", 65)), http.StatusRequestEntityTooLarge, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			var seen string
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, tc.path, tc.body)
			if _, chunked := tc.body.(onlyReader); chunked {
				req.ContentLength = -1
			}
			bodyLimitEngine(&seen).ServeHTTP(w, req)
			assert.Equal(t, tc.wantCode, w.Code)
			assert.Equal(t, tc.wantSeen, seen)
		})
	}

	t.Run("requests without a body pass", func(t *testing.T) {
		t.Parallel()
		var seen string
		w := httptest.NewRecorder()
		bodyLimitEngine(&seen).ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/account", nil))
		assert.Equal(t, http.StatusOK, w.Code)
	})
}
