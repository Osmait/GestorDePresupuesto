package errors

import (
	"context"
	"errors"
	"fmt"
	"runtime"
	"runtime/debug"
	"time"

	"go.opentelemetry.io/otel/trace"
)

// WrapError wraps an error with additional context and message
func WrapError(ctx context.Context, err error, operation, message string) error {
	if err == nil {
		return nil
	}

	// Always create a new AppError with the wrapped message
	// This ensures that the wrapping message is always included
	wrappedErr := NewInternalError(message, err).
		WithContext(ctx).
		WithOperation(operation)

	// Record in span if available
	wrappedErr.RecordInSpan(ctx)

	return wrappedErr
}

// WrapWithType wraps an error with a specific error type
func WrapWithType(ctx context.Context, err error, errorType ErrorType, operation, message string) error {
	if err == nil {
		return nil
	}

	// If it's already an AppError of the same type, just add context
	var appErr *AppError
	if errors.As(err, &appErr) && appErr.Type == errorType {
		return appErr.WithContext(ctx).WithOperation(operation)
	}

	// Create new AppError with specified type
	wrappedErr := NewAppError(errorType, string(errorType), message).
		WithContext(ctx).
		WithOperation(operation).
		WithCause(err)

	// Record in span if available
	wrappedErr.RecordInSpan(ctx)

	return wrappedErr
}

// WrapDatabaseError wraps database errors with proper context
func WrapDatabaseError(ctx context.Context, err error, operation string) error {
	if err == nil {
		return nil
	}

	return WrapWithType(ctx, err, ErrorTypeDatabase, operation,
		fmt.Sprintf("Database operation failed: %s", operation))
}

// WrapValidationError wraps validation errors
func WrapValidationError(ctx context.Context, err error, field, message string) error {
	if err == nil {
		return nil
	}

	validationErr := NewValidationError("VALIDATION_FAILED", message).
		WithContext(ctx).
		WithOperation("validation").
		WithCause(err).
		WithDetails(map[string]interface{}{
			"field": field,
		})

	validationErr.RecordInSpan(ctx)
	return validationErr
}

// WrapNetworkError wraps network/external service errors
func WrapNetworkError(ctx context.Context, err error, service, operation string) error {
	if err == nil {
		return nil
	}

	networkErr := NewNetworkError(service, err).
		WithContext(ctx).
		WithOperation(operation)

	networkErr.RecordInSpan(ctx)
	return networkErr
}

// RecoverWithError recovers from panic and returns as error
func RecoverWithError(ctx context.Context, operation string) error {
	if r := recover(); r != nil {
		stack := debug.Stack()

		panicErr := NewPanicError(r, stack).
			WithContext(ctx).
			WithOperation(operation)

		// Record in span
		panicErr.RecordInSpan(ctx)

		return panicErr
	}
	return nil
}

// RecoverWithCallback recovers from panic and calls a callback
func RecoverWithCallback(ctx context.Context, operation string, callback func(error)) {
	if r := recover(); r != nil {
		stack := debug.Stack()

		panicErr := NewPanicError(r, stack).
			WithContext(ctx).
			WithOperation(operation)

		// Record in span
		panicErr.RecordInSpan(ctx)

		if callback != nil {
			callback(panicErr)
		}
	}
}

// SafeCall executes a function and catches panics
func SafeCall(ctx context.Context, operation string, fn func() error) (err error) {
	defer func() {
		if r := recover(); r != nil {
			stack := debug.Stack()

			panicErr := NewPanicError(r, stack).
				WithContext(ctx).
				WithOperation(operation)

			// Record in span
			panicErr.RecordInSpan(ctx)

			err = panicErr
		}
	}()

	return fn()
}

// SafeCallWithResult executes a function and catches panics, returning result
func SafeCallWithResult[T any](ctx context.Context, operation string, fn func() (T, error)) (result T, err error) {
	defer func() {
		if r := recover(); r != nil {
			stack := debug.Stack()

			panicErr := NewPanicError(r, stack).
				WithContext(ctx).
				WithOperation(operation)

			// Record in span
			panicErr.RecordInSpan(ctx)

			err = panicErr
		}
	}()

	return fn()
}

// RetryWithBackoff retries a function with exponential backoff
func RetryWithBackoff(ctx context.Context, operation string, maxRetries int,
	initialDelay time.Duration, fn func() error) error {

	var lastErr error
	delay := initialDelay

	for attempt := 0; attempt < maxRetries; attempt++ {
		// Create span for retry attempt
		if span := trace.SpanFromContext(ctx); span != nil {
			span.AddEvent(fmt.Sprintf("retry attempt %d", attempt+1))
		}

		err := fn()
		if err == nil {
			return nil
		}

		lastErr = err

		// Check if error is retryable
		var appErr *AppError
		if errors.As(err, &appErr) && !appErr.IsRetryable() {
			return WrapError(ctx, err, operation, "Non-retryable error encountered")
		}

		// Don't sleep on the last attempt
		if attempt < maxRetries-1 {
			select {
			case <-ctx.Done():
				return WrapError(ctx, ctx.Err(), operation, "Context cancelled during retry")
			case <-time.After(delay):
				delay *= 2 // Exponential backoff
			}
		}
	}

	return WrapError(ctx, lastErr, operation,
		fmt.Sprintf("Max retries (%d) exceeded for operation: %s", maxRetries, operation))
}

// WithTimeout executes a function with timeout
func WithTimeout(ctx context.Context, timeout time.Duration, operation string,
	fn func(context.Context) error) error {

	timeoutCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	done := make(chan error, 1)

	go func() {
		defer func() {
			if r := recover(); r != nil {
				stack := debug.Stack()
				panicErr := NewPanicError(r, stack).
					WithContext(timeoutCtx).
					WithOperation(operation)
				done <- panicErr
			}
		}()

		done <- fn(timeoutCtx)
	}()

	select {
	case err := <-done:
		return err
	case <-timeoutCtx.Done():
		return NewTimeoutError(operation, timeout).WithContext(ctx)
	}
}

// IsAppError checks if an error is an AppError
func IsAppError(err error) bool {
	var appErr *AppError
	return errors.As(err, &appErr)
}

// AsAppError converts an error to AppError if possible
func AsAppError(err error) (*AppError, bool) {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr, true
	}
	return nil, false
}

// IsErrorType checks if an error is of a specific type
func IsErrorType(err error, errorType ErrorType) bool {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.Type == errorType
	}
	return false
}

// IsRetryable checks if an error is retryable
func IsRetryable(err error) bool {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.IsRetryable()
	}
	return false
}

// IsTemporary checks if an error is temporary
func IsTemporary(err error) bool {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.IsTemporary()
	}
	return false
}

// GetErrorCode returns the error code if it's an AppError
func GetErrorCode(err error) string {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.Code
	}
	return "UNKNOWN_ERROR"
}

// GetHTTPStatus returns the HTTP status code for an error
func GetHTTPStatus(err error) int {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.ToHTTPStatus()
	}
	return 500
}

// GetErrorSeverity returns the severity of an error
func GetErrorSeverity(err error) Severity {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.Severity
	}
	return SeverityMedium
}

// AddErrorContext adds contextual information to an error
func AddErrorContext(err error, key string, value interface{}) error {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.WithDetails(map[string]interface{}{key: value})
	}
	return err
}

// GetStackTrace returns the stack trace for the current goroutine
func GetStackTrace(skip int) string {
	buf := make([]byte, 4096)
	n := runtime.Stack(buf, false)
	return string(buf[:n])
}

// CaptureStackTrace captures stack trace and returns it as string
func CaptureStackTrace(skip int) []string {
	pc := make([]uintptr, 50)
	n := runtime.Callers(skip, pc)
	frames := runtime.CallersFrames(pc[:n])

	var traces []string
	for {
		frame, more := frames.Next()
		traces = append(traces, fmt.Sprintf("%s:%d %s", frame.File, frame.Line, frame.Function))
		if !more {
			break
		}
	}
	return traces
}

// ErrorGroup manages multiple errors
type ErrorGroup struct {
	errors []error
}

// NewErrorGroup creates a new error group
func NewErrorGroup() *ErrorGroup {
	return &ErrorGroup{
		errors: make([]error, 0),
	}
}

// Add adds an error to the group
func (eg *ErrorGroup) Add(err error) {
	if err != nil {
		eg.errors = append(eg.errors, err)
	}
}

// HasErrors returns true if there are any errors
func (eg *ErrorGroup) HasErrors() bool {
	return len(eg.errors) > 0
}

// Errors returns all errors
func (eg *ErrorGroup) Errors() []error {
	return eg.errors
}

// Error returns a combined error message
func (eg *ErrorGroup) Error() string {
	if len(eg.errors) == 0 {
		return ""
	}
	if len(eg.errors) == 1 {
		return eg.errors[0].Error()
	}

	var message string
	for i, err := range eg.errors {
		if i > 0 {
			message += "; "
		}
		message += err.Error()
	}
	return message
}

// ToAppError converts the error group to an AppError
func (eg *ErrorGroup) ToAppError(ctx context.Context, operation string) error {
	if len(eg.errors) == 0 {
		return nil
	}

	if len(eg.errors) == 1 {
		return WrapError(ctx, eg.errors[0], operation, "Single error in group")
	}

	return NewInternalError("Multiple errors occurred", fmt.Errorf(eg.Error())).
		WithContext(ctx).
		WithOperation(operation).
		WithDetails(map[string]interface{}{
			"error_count": len(eg.errors),
			"errors":      eg.errors,
		})
}
