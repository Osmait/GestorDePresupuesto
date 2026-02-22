package middleware

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/stretchr/testify/require"
)

func TestErrorHandler_ReturnsStructuredValidationError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RequestContext())
	r.Use(ErrorHandler(DefaultErrorHandlerConfig()))

	r.GET("/validation", func(c *gin.Context) {
		_ = c.Error(apperrors.NewValidationError("INVALID_INPUT", "name is required").WithContext(c.Request.Context()).WithOperation("test.validation"))
	})

	req := httptest.NewRequest(http.MethodGet, "/validation", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusBadRequest, w.Code)
	require.NotEmpty(t, w.Header().Get("X-Request-ID"))
	require.Equal(t, "INVALID_INPUT", w.Header().Get("X-Error-Code"))

	var response ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	require.Equal(t, "INVALID_INPUT", response.Error.Code)
	require.Equal(t, "name is required", response.Error.Message)
	require.Equal(t, "validation", response.Error.Type)
}

func TestErrorHandler_WrapsUnknownErrorAsInternal(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RequestContext())
	r.Use(ErrorHandler(DefaultErrorHandlerConfig()))

	r.GET("/internal", func(c *gin.Context) {
		_ = c.Error(errors.New("database exploded"))
	})

	req := httptest.NewRequest(http.MethodGet, "/internal", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusInternalServerError, w.Code)

	var response ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	require.Equal(t, "INTERNAL_ERROR", response.Error.Code)
	require.Equal(t, "Internal server error", response.Error.Message)
	require.Equal(t, "internal", response.Error.Type)
}
