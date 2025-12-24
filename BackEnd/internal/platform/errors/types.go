package errors

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

type ContextKey string

const (
	ContextKeyUserID    ContextKey = "user_id"
	ContextKeyRequestID ContextKey = "request_id"
)

// ErrorType represents the category of error
type ErrorType string

const (
	// Domain errors
	ErrorTypeValidation   ErrorType = "validation"
	ErrorTypeBusiness     ErrorType = "business"
	ErrorTypeNotFound     ErrorType = "not_found"
	ErrorTypeConflict     ErrorType = "conflict"
	ErrorTypeUnauthorized ErrorType = "unauthorized"
	ErrorTypeForbidden    ErrorType = "forbidden"

	// Infrastructure errors
	ErrorTypeDatabase  ErrorType = "database"
	ErrorTypeNetwork   ErrorType = "network"
	ErrorTypeExternal  ErrorType = "external"
	ErrorTypeTimeout   ErrorType = "timeout"
	ErrorTypeRateLimit ErrorType = "rate_limit"

	// System errors
	ErrorTypeInternal    ErrorType = "internal"
	ErrorTypeUnavailable ErrorType = "unavailable"
	ErrorTypeUnknown     ErrorType = "unknown"
	ErrorTypePanic       ErrorType = "panic"
)

// Severity represents the severity level of an error
type Severity string

const (
	SeverityLow      Severity = "low"      // Business logic errors, validation errors
	SeverityMedium   Severity = "medium"   // External service errors, network issues
	SeverityHigh     Severity = "high"     // Database errors, authentication failures
	SeverityCritical Severity = "critical" // System failures, panics
)

// AppError represents a structured application error
type AppError struct {
	// Error identification
	Code    string    `json:"code"`
	Type    ErrorType `json:"type"`
	Message string    `json:"message"`

	// Error context
	Details   map[string]interface{} `json:"details,omitempty"`
	Severity  Severity               `json:"severity"`
	Timestamp time.Time              `json:"timestamp"`
	TraceID   string                 `json:"trace_id,omitempty"`
	SpanID    string                 `json:"span_id,omitempty"`
	UserID    string                 `json:"user_id,omitempty"`
	RequestID string                 `json:"request_id,omitempty"`
	Operation string                 `json:"operation,omitempty"`

	// Error chain
	Cause error `json:"-"`

	// HTTP context
	HTTPStatus int `json:"http_status,omitempty"`

	// Metadata
	Retryable bool `json:"retryable"`
	Temporary bool `json:"temporary"`
}

// Error implements the error interface
func (e *AppError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Cause)
	}
	return e.Message
}

// Unwrap returns the underlying error
func (e *AppError) Unwrap() error {
	return e.Cause
}

// WithContext adds context information to the error
func (e *AppError) WithContext(ctx context.Context) *AppError {
	// Extract trace information
	if span := trace.SpanFromContext(ctx); span != nil {
		spanContext := span.SpanContext()
		if spanContext.IsValid() {
			e.TraceID = spanContext.TraceID().String()
			e.SpanID = spanContext.SpanID().String()
		}
	}

	// Extract user ID from context if available
	if userID, ok := ctx.Value(ContextKeyUserID).(string); ok {
		e.UserID = userID
	}

	// Extract request ID from context if available
	if requestID, ok := ctx.Value(ContextKeyRequestID).(string); ok {
		e.RequestID = requestID
	}

	return e
}

// WithDetails adds additional details to the error
func (e *AppError) WithDetails(details map[string]interface{}) *AppError {
	if e.Details == nil {
		e.Details = make(map[string]interface{})
	}
	for k, v := range details {
		e.Details[k] = v
	}
	return e
}

// WithOperation sets the operation where the error occurred
func (e *AppError) WithOperation(operation string) *AppError {
	e.Operation = operation
	return e
}

// WithUserID sets the user ID associated with the error
func (e *AppError) WithUserID(userID string) *AppError {
	e.UserID = userID
	return e
}

// WithCause sets the underlying cause of the error
func (e *AppError) WithCause(cause error) *AppError {
	e.Cause = cause
	return e
}

// IsRetryable returns true if the error is retryable
func (e *AppError) IsRetryable() bool {
	return e.Retryable
}

// IsTemporary returns true if the error is temporary
func (e *AppError) IsTemporary() bool {
	return e.Temporary
}

// ToHTTPStatus returns the appropriate HTTP status code
func (e *AppError) ToHTTPStatus() int {
	if e.HTTPStatus != 0 {
		return e.HTTPStatus
	}

	switch e.Type {
	case ErrorTypeValidation:
		return http.StatusBadRequest
	case ErrorTypeNotFound:
		return http.StatusNotFound
	case ErrorTypeConflict:
		return http.StatusConflict
	case ErrorTypeUnauthorized:
		return http.StatusUnauthorized
	case ErrorTypeForbidden:
		return http.StatusForbidden
	case ErrorTypeRateLimit:
		return http.StatusTooManyRequests
	case ErrorTypeTimeout:
		return http.StatusRequestTimeout
	case ErrorTypeUnavailable:
		return http.StatusServiceUnavailable
	case ErrorTypeDatabase, ErrorTypeNetwork, ErrorTypeExternal:
		return http.StatusBadGateway
	default:
		return http.StatusInternalServerError
	}
}

// RecordInSpan records the error in the current trace span
func (e *AppError) RecordInSpan(ctx context.Context) {
	if span := trace.SpanFromContext(ctx); span != nil {
		// Set span status
		span.SetStatus(codes.Error, e.Message)

		// Record error
		span.RecordError(e)

		// Add error attributes
		span.SetAttributes(
			attribute.String("error.type", string(e.Type)),
			attribute.String("error.code", e.Code),
			attribute.String("error.severity", string(e.Severity)),
			attribute.Bool("error.retryable", e.Retryable),
			attribute.Bool("error.temporary", e.Temporary),
		)

		if e.Operation != "" {
			span.SetAttributes(attribute.String("error.operation", e.Operation))
		}

		if e.UserID != "" {
			span.SetAttributes(attribute.String("error.user_id", e.UserID))
		}
	}
}

// NewAppError creates a new application error
func NewAppError(errorType ErrorType, code, message string) *AppError {
	return &AppError{
		Code:      code,
		Type:      errorType,
		Message:   message,
		Severity:  getSeverityForType(errorType),
		Timestamp: time.Now(),
		Retryable: isRetryableByType(errorType),
		Temporary: isTemporaryByType(errorType),
	}
}

// NewValidationError creates a validation error
func NewValidationError(code, message string) *AppError {
	return NewAppError(ErrorTypeValidation, code, message).
		WithDetails(map[string]interface{}{"http_status": http.StatusBadRequest})
}

// NewNotFoundError creates a not found error
func NewNotFoundError(resource, id string) *AppError {
	return NewAppError(ErrorTypeNotFound, "RESOURCE_NOT_FOUND",
		fmt.Sprintf("%s with ID '%s' not found", resource, id)).
		WithDetails(map[string]interface{}{
			"resource": resource,
			"id":       id,
		})
}

// NewUnauthorizedError creates an unauthorized error
func NewUnauthorizedError(message string) *AppError {
	if message == "" {
		message = "Authentication required"
	}
	return NewAppError(ErrorTypeUnauthorized, "UNAUTHORIZED", message)
}

// NewForbiddenError creates a forbidden error
func NewForbiddenError(message string) *AppError {
	if message == "" {
		message = "Access forbidden"
	}
	return NewAppError(ErrorTypeForbidden, "FORBIDDEN", message)
}

// NewConflictError creates a conflict error
func NewConflictError(resource, reason string) *AppError {
	return NewAppError(ErrorTypeConflict, "RESOURCE_CONFLICT",
		fmt.Sprintf("Conflict with %s: %s", resource, reason)).
		WithDetails(map[string]interface{}{
			"resource": resource,
			"reason":   reason,
		})
}

// NewDatabaseError creates a database error
func NewDatabaseError(operation string, cause error) *AppError {
	return NewAppError(ErrorTypeDatabase, "DATABASE_ERROR",
		fmt.Sprintf("Database operation failed: %s", operation)).
		WithOperation(operation).
		WithCause(cause)
}

// NewNetworkError creates a network error
func NewNetworkError(service string, cause error) *AppError {
	return NewAppError(ErrorTypeNetwork, "NETWORK_ERROR",
		fmt.Sprintf("Network error communicating with %s", service)).
		WithDetails(map[string]interface{}{"service": service}).
		WithCause(cause)
}

// NewTimeoutError creates a timeout error
func NewTimeoutError(operation string, timeout time.Duration) *AppError {
	return NewAppError(ErrorTypeTimeout, "TIMEOUT_ERROR",
		fmt.Sprintf("Operation '%s' timed out after %v", operation, timeout)).
		WithOperation(operation).
		WithDetails(map[string]interface{}{"timeout": timeout.String()})
}

// NewRateLimitError creates a rate limit error
func NewRateLimitError(limit int, window time.Duration) *AppError {
	return NewAppError(ErrorTypeRateLimit, "RATE_LIMIT_EXCEEDED",
		fmt.Sprintf("Rate limit exceeded: %d requests per %v", limit, window)).
		WithDetails(map[string]interface{}{
			"limit":  limit,
			"window": window.String(),
		})
}

// NewInternalError creates an internal error
func NewInternalError(message string, cause error) *AppError {
	return NewAppError(ErrorTypeInternal, "INTERNAL_ERROR", message).
		WithCause(cause)
}

// NewPanicError creates a panic error
func NewPanicError(recovered interface{}, stack []byte) *AppError {
	return NewAppError(ErrorTypePanic, "PANIC_RECOVERED",
		fmt.Sprintf("Panic recovered: %v", recovered)).
		WithDetails(map[string]interface{}{
			"panic_value": recovered,
			"stack_trace": string(stack),
		})
}

// Helper functions

func getSeverityForType(errorType ErrorType) Severity {
	switch errorType {
	case ErrorTypeValidation, ErrorTypeBusiness, ErrorTypeNotFound:
		return SeverityLow
	case ErrorTypeNetwork, ErrorTypeExternal, ErrorTypeTimeout, ErrorTypeRateLimit:
		return SeverityMedium
	case ErrorTypeDatabase, ErrorTypeUnauthorized, ErrorTypeForbidden, ErrorTypeConflict:
		return SeverityHigh
	case ErrorTypeInternal, ErrorTypeUnavailable, ErrorTypePanic, ErrorTypeUnknown:
		return SeverityCritical
	default:
		return SeverityMedium
	}
}

func isRetryableByType(errorType ErrorType) bool {
	switch errorType {
	case ErrorTypeNetwork, ErrorTypeExternal, ErrorTypeTimeout, ErrorTypeUnavailable:
		return true
	case ErrorTypeDatabase:
		return true // Some database errors are retryable
	default:
		return false
	}
}

func isTemporaryByType(errorType ErrorType) bool {
	switch errorType {
	case ErrorTypeNetwork, ErrorTypeTimeout, ErrorTypeRateLimit, ErrorTypeUnavailable:
		return true
	default:
		return false
	}
}
