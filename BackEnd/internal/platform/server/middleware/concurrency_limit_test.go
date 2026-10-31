package middleware

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConcurrencyLimit_RejectsBeyondTheCapAndFreesSlots(t *testing.T) {
	gin.SetMode(gin.TestMode)
	entered := make(chan struct{}, 2)
	release := make(chan struct{})
	r := gin.New()
	r.GET("/slow", ConcurrencyLimit("test", 2), func(c *gin.Context) {
		entered <- struct{}{}
		<-release
		c.Status(http.StatusOK)
	})

	var wg sync.WaitGroup
	codes := make([]int, 2)
	for i := range 2 {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/slow", nil))
			codes[i] = w.Code
		}(i)
	}
	<-entered
	<-entered

	// Both slots are busy: the third request fails fast.
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/slow", nil))
	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
	assert.NotEmpty(t, w.Header().Get("Retry-After"))

	close(release)
	wg.Wait()
	assert.Equal(t, []int{http.StatusOK, http.StatusOK}, codes)

	// Slots were released.
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/slow", nil))
	require.Equal(t, http.StatusOK, w.Code)
}

func TestConcurrencyLimit_DisabledWithNonPositiveMax(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/x", ConcurrencyLimit("test", 0), func(c *gin.Context) { c.Status(http.StatusOK) })
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/x", nil))
	assert.Equal(t, http.StatusOK, w.Code)
}
