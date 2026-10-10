package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A Postgres data error escaping a handler (e.g. the card payment that hit
// "value too long for type character varying(32)") must become a 4xx with a
// stable code, never a 500 carrying the driver text.
func TestErrorHandler_MapsPostgresDataErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(ErrorHandler(DefaultErrorHandlerConfig()))
	r.POST("/credit-cards/:id/payments", func(c *gin.Context) {
		raw := &pq.Error{Code: "22001", Message: "value too long for type character varying(32)"}
		_ = c.Error(fmt.Errorf("save card payment: %w", raw))
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/credit-cards/x/payments", nil))

	require.Equal(t, http.StatusBadRequest, w.Code)
	assert.NotContains(t, w.Body.String(), "pq:")
	assert.NotContains(t, w.Body.String(), "character varying")

	var body ErrorResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, "VALUE_TOO_LONG", body.Error.Code)
	assert.Equal(t, "validation", body.Error.Type)
	assert.NotEmpty(t, body.Error.Message)
}
