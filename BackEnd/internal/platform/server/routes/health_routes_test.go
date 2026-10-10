package routes

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const healthToken = "internal-health-token-0123456789"

func healthEngine(t *testing.T, pingErr error) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New(sqlmock.MonitorPingsOption(true))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	for i := 0; i < 4; i++ {
		mock.ExpectPing().WillReturnError(pingErr)
		mock.ExpectQuery("SELECT 1").WillReturnRows(sqlmock.NewRows([]string{"?column?"}).AddRow(1))
	}
	mock.MatchExpectationsInOrder(false)
	e := gin.New()
	HealthRoutes(e, db, "1.2.3", "production", healthToken)
	return e
}

func get(e *gin.Engine, path, auth string) (int, map[string]any) {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	return rec.Code, body
}

func TestHealthDetailed_AnonymousIsTrimmed(t *testing.T) {
	code, body := get(healthEngine(t, nil), "/health/detailed", "")
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "healthy", body["status"])
	for _, leaked := range []string{"version", "environment", "uptime"} {
		assert.NotContains(t, body, leaked)
	}
	checks := body["checks"].(map[string]any)
	db := checks["database"].(map[string]any)
	assert.Equal(t, map[string]any{"status": "healthy"}, db, "pool stats must not be public")
}

func TestHealthDetailed_FullWithToken(t *testing.T) {
	code, body := get(healthEngine(t, nil), "/health/detailed", "Bearer "+healthToken)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "1.2.3", body["version"])
	db := body["checks"].(map[string]any)["database"].(map[string]any)
	assert.Contains(t, db, "data")
}

func TestHealthReady_DoesNotLeakDriverError(t *testing.T) {
	code, body := get(healthEngine(t, errors.New("dial tcp db.internal:5432: secret-host")), "/health/ready", "")
	assert.Equal(t, http.StatusServiceUnavailable, code)
	raw, _ := json.Marshal(body)
	assert.NotContains(t, string(raw), "secret-host")
}

func TestHealthLiveAndBasicStayPublic(t *testing.T) {
	e := healthEngine(t, nil)
	for _, p := range []string{"/health", "/health/live", "/health/ready", "/ping"} {
		code, _ := get(e, p, "")
		assert.Equal(t, http.StatusOK, code, p)
	}
}
