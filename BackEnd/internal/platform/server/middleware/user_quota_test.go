package middleware

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func quotaEngine(cfg UserQuotaConfig, entered, hold chan struct{}) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("X-User-Id", c.GetHeader("X-Test-User"))
		c.Next()
	}, UserQuota(cfg))
	r.POST("/ai/extract", func(c *gin.Context) {
		if hold != nil {
			entered <- struct{}{}
			<-hold
		}
		c.Status(http.StatusOK)
	})
	r.POST("/transaction", func(c *gin.Context) { c.Status(http.StatusOK) })
	return r
}

func quotaCall(r *gin.Engine, path, user string) int {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, path, nil)
	req.Header.Set("X-Test-User", user)
	r.ServeHTTP(w, req)
	return w.Code
}

func TestUserQuota_PerMinuteAndPerUser(t *testing.T) {
	t.Parallel()
	r := quotaEngine(UserQuotaConfig{Prefix: "/ai/", PerMinute: 2}, nil, nil)
	assert.Equal(t, http.StatusOK, quotaCall(r, "/ai/extract", "u1"))
	assert.Equal(t, http.StatusOK, quotaCall(r, "/ai/extract", "u1"))
	assert.Equal(t, http.StatusTooManyRequests, quotaCall(r, "/ai/extract", "u1"))
	assert.Equal(t, http.StatusOK, quotaCall(r, "/ai/extract", "u2"), "limits are per user")
	assert.Equal(t, http.StatusOK, quotaCall(r, "/transaction", "u1"), "other paths are not limited")
}

func TestUserQuota_MaxInFlight(t *testing.T) {
	t.Parallel()
	entered, hold := make(chan struct{}), make(chan struct{})
	r := quotaEngine(UserQuotaConfig{Prefix: "/ai/", MaxInFlight: 1}, entered, hold)

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		assert.Equal(t, http.StatusOK, quotaCall(r, "/ai/extract", "u1"))
	}()
	<-entered // the first request holds the only slot
	assert.Equal(t, http.StatusTooManyRequests, quotaCall(r, "/ai/extract", "u1"))
	hold <- struct{}{}
	wg.Wait()
	go func() { <-entered; hold <- struct{}{} }()
	assert.Equal(t, http.StatusOK, quotaCall(r, "/ai/extract", "u1"), "the slot is released afterwards")
}
