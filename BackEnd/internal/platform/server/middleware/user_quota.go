package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// UserQuotaConfig limits one user's requests to a path prefix.
type UserQuotaConfig struct {
	Prefix      string
	PerMinute   int
	PerDay      int
	MaxInFlight int
}

type userQuotaState struct {
	minute   []time.Time
	day      []time.Time
	inFlight int
}

// UserQuota limits, per authenticated user, the requests to cfg.Prefix: per
// minute, per day and at the same time. The global limiter runs before
// authentication and can only count per IP; this one counts per user, which
// is what bounds the cost of the AI endpoints (each call goes to the paid
// provider) and how many of them hold a database connection at once while
// waiting for it. Register it after AuthMiddleware and before RLSMiddleware so
// a rejected request never takes a connection. State is per process.
func UserQuota(cfg UserQuotaConfig) gin.HandlerFunc {
	var mu sync.Mutex
	users := map[string]*userQuotaState{}
	now := time.Now

	return func(c *gin.Context) {
		userID := c.GetString("X-User-Id")
		if userID == "" || !strings.HasPrefix(c.Request.URL.Path, cfg.Prefix) {
			c.Next()
			return
		}

		t := now()
		mu.Lock()
		st := users[userID]
		if st == nil {
			st = &userQuotaState{}
			users[userID] = st
		}
		st.minute = pruneLocked(st.minute, t, time.Minute)
		st.day = pruneLocked(st.day, t, 24*time.Hour)
		var reason string
		switch {
		case cfg.MaxInFlight > 0 && st.inFlight >= cfg.MaxInFlight:
			reason = "too many requests in progress"
		case cfg.PerMinute > 0 && len(st.minute) >= cfg.PerMinute:
			reason = fmt.Sprintf("limit of %d requests per minute reached", cfg.PerMinute)
		case cfg.PerDay > 0 && len(st.day) >= cfg.PerDay:
			reason = fmt.Sprintf("daily limit of %d requests reached", cfg.PerDay)
		}
		if reason != "" {
			mu.Unlock()
			c.Header("Retry-After", "60")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": reason})
			return
		}
		if cfg.PerMinute > 0 {
			st.minute = append(st.minute, t)
		}
		if cfg.PerDay > 0 {
			st.day = append(st.day, t)
		}
		st.inFlight++
		mu.Unlock()

		defer func() {
			mu.Lock()
			st.inFlight--
			if st.inFlight == 0 && len(st.minute) == 0 && len(st.day) == 0 {
				delete(users, userID)
			}
			mu.Unlock()
		}()
		c.Next()
	}
}
