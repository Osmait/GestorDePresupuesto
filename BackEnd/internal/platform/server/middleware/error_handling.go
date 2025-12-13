package middleware

import (
	"context"
	"runtime/debug"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/platform/observability"
)

// ErrorResponse represents the error response structure
type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail represents the error detail structure
type ErrorDetail struct {
	Code      string                 `json:"code"`
	Message   string                 `json:"message"`
	Details   map[string]interface{} `json:"details,omitempty"`
	Type      string                 `json:"type"`
	Severity  string                 `json:"severity"`
	Timestamp time.Time              `json:"timestamp"`
	Retryable bool                   `json:"retryable"`
}

// ErrorHandlerConfig contains configuration for error handling
type ErrorHandlerConfig struct {
	ShowStackTrace bool
	ShowErrorCode  bool
	LogStackTrace  bool
	EnableMetrics  bool
}

// DefaultErrorHandlerConfig returns the default error handler configuration
func DefaultErrorHandlerConfig() ErrorHandlerConfig {
	return ErrorHandlerConfig{
		ShowStackTrace: false,
		ShowErrorCode:  true,
		LogStackTrace:  true,
		EnableMetrics:  true,
	}
}

// ErrorHandler creates a middleware that handles errors and panics
func ErrorHandler(config ErrorHandlerConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Setup panic recovery
		defer func() {
			if recovered := recover(); recovered != nil {
				handlePanic(c, recovered, config)
			}
		}()

		// Process the request
		c.Next()

		// Handle any errors that were added during request processing
		if len(c.Errors) > 0 {
			handleErrors(c, c.Errors, config)
			return
		}
	}
}

// handlePanic handles panic recovery
func handlePanic(c *gin.Context, recovered interface{}, config ErrorHandlerConfig) {
	ctx := c.Request.Context()
	stack := debug.Stack()

	// Create panic error
	panicErr := apperrors.NewPanicError(recovered, stack).
		WithContext(ctx).
		WithOperation(c.Request.Method + " " + c.Request.URL.Path)

	// Log the panic with structured logging
	logger := observability.GetLogger().WithContext(ctx).
		WithFields(map[string]interface{}{
			"method":      c.Request.Method,
			"path":        c.Request.URL.Path,
			"user_agent":  c.Request.UserAgent(),
			"ip":          c.ClientIP(),
			"panic_value": recovered,
			"error_type":  string(apperrors.ErrorTypePanic),
			"severity":    string(apperrors.SeverityCritical),
		})

	if config.LogStackTrace {
		logger = logger.WithField("stack_trace", string(stack))
	}

	logger.Error("Panic recovered in HTTP handler")

	// Send error response
	sendErrorResponse(c, panicErr, config)
}

// handleErrors handles regular errors
func handleErrors(c *gin.Context, errors []*gin.Error, config ErrorHandlerConfig) {
	ctx := c.Request.Context()

	// Get the last error (most recent)
	lastError := errors[len(errors)-1]

	// Convert to AppError if possible
	var appErr *apperrors.AppError
	if apperrors.IsAppError(lastError.Err) {
		appErr, _ = apperrors.AsAppError(lastError.Err)
	} else {
		// Wrap unknown errors
		appErr = apperrors.NewInternalError("Internal server error", lastError.Err).
			WithContext(ctx).
			WithOperation(c.Request.Method + " " + c.Request.URL.Path)
	}

	// Log the error
	logError(ctx, c, appErr, config)

	// Record error metrics

	// Send error response
	sendErrorResponse(c, appErr, config)
}

// logError logs an error with appropriate level and context
func logError(ctx context.Context, c *gin.Context, appErr *apperrors.AppError, config ErrorHandlerConfig) {
	logger := observability.GetLogger().WithContext(ctx)

	// Create base fields
	fields := map[string]interface{}{
		"method":      c.Request.Method,
		"path":        c.Request.URL.Path,
		"user_agent":  c.Request.UserAgent(),
		"ip":          c.ClientIP(),
		"error_code":  appErr.Code,
		"error_type":  string(appErr.Type),
		"severity":    string(appErr.Severity),
		"retryable":   appErr.Retryable,
		"temporary":   appErr.Temporary,
		"http_status": appErr.ToHTTPStatus(),
	}

	// Add operation if available
	if appErr.Operation != "" {
		fields["operation"] = appErr.Operation
	}

	// Add user ID if available
	if appErr.UserID != "" {
		fields["user_id"] = appErr.UserID
	}

	// Add request ID if available
	if appErr.RequestID != "" {
		fields["request_id"] = appErr.RequestID
	}

	// Add details if available
	if appErr.Details != nil && len(appErr.Details) > 0 {
		fields["details"] = appErr.Details
	}

	// Add stack trace for high severity errors
	if config.LogStackTrace && appErr.Severity >= apperrors.SeverityHigh {
		if appErr.Cause != nil {
			fields["cause"] = appErr.Cause.Error()
		}
	}

	// Log with appropriate level based on severity
	loggerWithFields := logger.WithFields(fields)
	switch appErr.Severity {
	case apperrors.SeverityLow:
		loggerWithFields.Info(appErr.Message)
	case apperrors.SeverityMedium:
		loggerWithFields.Warn(appErr.Message)
	case apperrors.SeverityHigh:
		loggerWithFields.Error(appErr.Message)
	case apperrors.SeverityCritical:
		loggerWithFields.Error(appErr.Message)
	default:
		loggerWithFields.Error(appErr.Message)
	}
}

// sendErrorResponse sends the error response to the client
func sendErrorResponse(c *gin.Context, appErr *apperrors.AppError, config ErrorHandlerConfig) {

	// Create error response
	errorResponse := ErrorResponse{
		Error: ErrorDetail{
			Code:      appErr.Code,
			Message:   getSafeErrorMessage(appErr),
			Type:      string(appErr.Type),
			Severity:  string(appErr.Severity),
			Timestamp: appErr.Timestamp,
			Retryable: appErr.Retryable,
		},
	}

	// Add details for non-internal errors
	if appErr.Type != apperrors.ErrorTypeInternal && appErr.Type != apperrors.ErrorTypePanic {
		errorResponse.Error.Details = getSafeErrorDetails(appErr)
	}

	// Add error code if enabled
	if !config.ShowErrorCode {
		errorResponse.Error.Code = ""
	}

	// Set response headers
	c.Header("Content-Type", "application/json")
	c.Header("X-Error-Type", string(appErr.Type))
	c.Header("X-Error-Code", appErr.Code)

	// Send response
	c.JSON(appErr.ToHTTPStatus(), errorResponse)
}

// getSafeErrorMessage returns a safe error message for the client
func getSafeErrorMessage(appErr *apperrors.AppError) string {
	switch appErr.Type {
	case apperrors.ErrorTypeInternal, apperrors.ErrorTypePanic:
		return "Internal server error"
	case apperrors.ErrorTypeDatabase:
		return "Database operation failed"
	case apperrors.ErrorTypeNetwork:
		return "Network communication error"
	case apperrors.ErrorTypeTimeout:
		return "Request timeout"
	default:
		return appErr.Message
	}
}

// getSafeErrorDetails returns safe error details for the client
func getSafeErrorDetails(appErr *apperrors.AppError) map[string]interface{} {
	if appErr.Details == nil {
		return nil
	}

	safeDetails := make(map[string]interface{})

	// Only include safe details
	for key, value := range appErr.Details {
		switch key {
		case "field", "resource", "id", "reason", "limit", "window", "timeout":
			safeDetails[key] = value
		case "http_status":
			// Don't include HTTP status in details
			continue
		default:
			// Be conservative with unknown keys
			if !containsSensitiveInfo(key) {
				safeDetails[key] = value
			}
		}
	}

	return safeDetails
}

// containsSensitiveInfo checks if a key might contain sensitive information
func containsSensitiveInfo(key string) bool {
	sensitiveKeys := []string{
		"password", "token", "secret", "key", "auth", "credential",
		"stack", "trace", "error", "panic", "sql", "query",
	}

	lowerKey := strings.ToLower(key)
	for _, sensitive := range sensitiveKeys {
		if strings.Contains(lowerKey, sensitive) {
			return true
		}
	}
	return false
}

// AbortWithError aborts the request with an error
func AbortWithError(c *gin.Context, err error) {
	c.Error(err)
	c.Abort()
}

// AbortWithAppError aborts the request with an AppError
func AbortWithAppError(c *gin.Context, appErr *apperrors.AppError) {
	c.Error(appErr)
	c.Abort()
}

// AbortWithValidationError aborts the request with a validation error
func AbortWithValidationError(c *gin.Context, field, message string) {
	ctx := c.Request.Context()
	validationErr := apperrors.NewValidationError("VALIDATION_ERROR", message).
		WithContext(ctx).
		WithOperation(c.Request.Method + " " + c.Request.URL.Path).
		WithDetails(map[string]interface{}{
			"field": field,
		})

	AbortWithAppError(c, validationErr)
}

// AbortWithNotFoundError aborts the request with a not found error
func AbortWithNotFoundError(c *gin.Context, resource, id string) {
	ctx := c.Request.Context()
	notFoundErr := apperrors.NewNotFoundError(resource, id).
		WithContext(ctx).
		WithOperation(c.Request.Method + " " + c.Request.URL.Path)

	AbortWithAppError(c, notFoundErr)
}

// AbortWithUnauthorizedError aborts the request with an unauthorized error
func AbortWithUnauthorizedError(c *gin.Context, message string) {
	ctx := c.Request.Context()
	unauthorizedErr := apperrors.NewUnauthorizedError(message).
		WithContext(ctx).
		WithOperation(c.Request.Method + " " + c.Request.URL.Path)

	AbortWithAppError(c, unauthorizedErr)
}

// AbortWithForbiddenError aborts the request with a forbidden error
func AbortWithForbiddenError(c *gin.Context, message string) {
	ctx := c.Request.Context()
	forbiddenErr := apperrors.NewForbiddenError(message).
		WithContext(ctx).
		WithOperation(c.Request.Method + " " + c.Request.URL.Path)

	AbortWithAppError(c, forbiddenErr)
}

// AbortWithConflictError aborts the request with a conflict error
func AbortWithConflictError(c *gin.Context, resource, reason string) {
	ctx := c.Request.Context()
	conflictErr := apperrors.NewConflictError(resource, reason).
		WithContext(ctx).
		WithOperation(c.Request.Method + " " + c.Request.URL.Path)

	AbortWithAppError(c, conflictErr)
}

// AbortWithInternalError aborts the request with an internal error
func AbortWithInternalError(c *gin.Context, message string, cause error) {
	ctx := c.Request.Context()
	internalErr := apperrors.NewInternalError(message, cause).
		WithContext(ctx).
		WithOperation(c.Request.Method + " " + c.Request.URL.Path)

	AbortWithAppError(c, internalErr)
}

// WrapHandlerWithErrorRecovery wraps a handler with error recovery
func WrapHandlerWithErrorRecovery(handler gin.HandlerFunc) gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		defer func() {
			if recovered := recover(); recovered != nil {
				handlePanic(c, recovered, DefaultErrorHandlerConfig())
			}
		}()

		handler(c)
	})
}
