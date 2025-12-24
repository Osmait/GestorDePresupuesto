package errors

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/sdk/trace"
)

func TestNewAppError(t *testing.T) {
	t.Run("creates app error with basic fields", func(t *testing.T) {
		appErr := NewAppError(ErrorTypeValidation, "TEST_CODE", "test message")

		assert.Equal(t, ErrorTypeValidation, appErr.Type)
		assert.Equal(t, "TEST_CODE", appErr.Code)
		assert.Equal(t, "test message", appErr.Message)
		assert.Equal(t, SeverityLow, appErr.Severity)
		assert.False(t, appErr.Retryable)
		assert.False(t, appErr.Temporary)
		assert.NotZero(t, appErr.Timestamp)
	})

	t.Run("sets correct severity for error types", func(t *testing.T) {
		tests := []struct {
			errorType        ErrorType
			expectedSeverity Severity
		}{
			{ErrorTypeValidation, SeverityLow},
			{ErrorTypeNotFound, SeverityLow},
			{ErrorTypeNetwork, SeverityMedium},
			{ErrorTypeDatabase, SeverityHigh},
			{ErrorTypePanic, SeverityCritical},
		}

		for _, tt := range tests {
			t.Run(string(tt.errorType), func(t *testing.T) {
				appErr := NewAppError(tt.errorType, "CODE", "message")
				assert.Equal(t, tt.expectedSeverity, appErr.Severity)
			})
		}
	})
}

func TestAppError_Error(t *testing.T) {
	t.Run("returns message when no cause", func(t *testing.T) {
		appErr := NewAppError(ErrorTypeValidation, "CODE", "test message")
		assert.Equal(t, "test message", appErr.Error())
	})

	t.Run("returns message with cause", func(t *testing.T) {
		cause := errors.New("original error")
		appErr := NewAppError(ErrorTypeValidation, "CODE", "test message").WithCause(cause)
		assert.Equal(t, "test message: original error", appErr.Error())
	})
}

func TestAppError_Unwrap(t *testing.T) {
	t.Run("returns nil when no cause", func(t *testing.T) {
		appErr := NewAppError(ErrorTypeValidation, "CODE", "test message")
		assert.Nil(t, appErr.Unwrap())
	})

	t.Run("returns cause when present", func(t *testing.T) {
		cause := errors.New("original error")
		appErr := NewAppError(ErrorTypeValidation, "CODE", "test message").WithCause(cause)
		assert.Equal(t, cause, appErr.Unwrap())
	})
}

func TestAppError_WithContext(t *testing.T) {
	t.Run("adds context without trace", func(t *testing.T) {
		ctx := context.Background()
		appErr := NewAppError(ErrorTypeValidation, "CODE", "message")

		result := appErr.WithContext(ctx)

		assert.Same(t, appErr, result)
		assert.Empty(t, appErr.TraceID)
		assert.Empty(t, appErr.SpanID)
	})

	t.Run("adds context with trace", func(t *testing.T) {
		// Create a test tracer provider
		tp := trace.NewTracerProvider()
		otel.SetTracerProvider(tp)

		tracer := otel.Tracer("test")
		ctx, span := tracer.Start(context.Background(), "test-operation")
		defer span.End()

		appErr := NewAppError(ErrorTypeValidation, "CODE", "message")
		result := appErr.WithContext(ctx)

		assert.Same(t, appErr, result)
		// With proper tracer provider, we should have trace IDs
		assert.NotEmpty(t, appErr.TraceID)
		assert.NotEmpty(t, appErr.SpanID)
	})

	t.Run("adds user and request context", func(t *testing.T) {
		ctx := context.Background()
		ctx = context.WithValue(ctx, ContextKeyUserID, "user123")
		ctx = context.WithValue(ctx, ContextKeyRequestID, "req456")

		appErr := NewAppError(ErrorTypeValidation, "CODE", "message")
		result := appErr.WithContext(ctx)

		assert.Same(t, appErr, result)
		assert.Equal(t, "user123", appErr.UserID)
		assert.Equal(t, "req456", appErr.RequestID)
	})
}

func TestAppError_WithDetails(t *testing.T) {
	t.Run("adds details to empty error", func(t *testing.T) {
		appErr := NewAppError(ErrorTypeValidation, "CODE", "message")
		details := map[string]interface{}{
			"field": "email",
			"value": "invalid@",
		}

		result := appErr.WithDetails(details)

		assert.Same(t, appErr, result)
		assert.Equal(t, details, appErr.Details)
	})

	t.Run("merges details with existing", func(t *testing.T) {
		appErr := NewAppError(ErrorTypeValidation, "CODE", "message")
		appErr.Details = map[string]interface{}{
			"existing": "value",
		}

		newDetails := map[string]interface{}{
			"field": "email",
			"value": "invalid@",
		}

		result := appErr.WithDetails(newDetails)

		assert.Same(t, appErr, result)
		assert.Equal(t, "value", appErr.Details["existing"])
		assert.Equal(t, "email", appErr.Details["field"])
		assert.Equal(t, "invalid@", appErr.Details["value"])
	})
}

func TestAppError_ToHTTPStatus(t *testing.T) {
	tests := []struct {
		errorType      ErrorType
		expectedStatus int
	}{
		{ErrorTypeValidation, 400},
		{ErrorTypeNotFound, 404},
		{ErrorTypeConflict, 409},
		{ErrorTypeUnauthorized, 401},
		{ErrorTypeForbidden, 403},
		{ErrorTypeRateLimit, 429},
		{ErrorTypeTimeout, 408},
		{ErrorTypeUnavailable, 503},
		{ErrorTypeDatabase, 502},
		{ErrorTypeNetwork, 502},
		{ErrorTypeExternal, 502},
		{ErrorTypeInternal, 500},
	}

	for _, tt := range tests {
		t.Run(string(tt.errorType), func(t *testing.T) {
			appErr := NewAppError(tt.errorType, "CODE", "message")
			assert.Equal(t, tt.expectedStatus, appErr.ToHTTPStatus())
		})
	}

	t.Run("returns custom HTTP status when set", func(t *testing.T) {
		appErr := NewAppError(ErrorTypeValidation, "CODE", "message")
		appErr.HTTPStatus = 422
		assert.Equal(t, 422, appErr.ToHTTPStatus())
	})
}

func TestSpecificErrorCreators(t *testing.T) {
	t.Run("NewValidationError", func(t *testing.T) {
		err := NewValidationError("INVALID_EMAIL", "email is invalid")

		assert.Equal(t, ErrorTypeValidation, err.Type)
		assert.Equal(t, "INVALID_EMAIL", err.Code)
		assert.Equal(t, "email is invalid", err.Message)
		assert.Equal(t, SeverityLow, err.Severity)
	})

	t.Run("NewNotFoundError", func(t *testing.T) {
		err := NewNotFoundError("user", "123")

		assert.Equal(t, ErrorTypeNotFound, err.Type)
		assert.Equal(t, "RESOURCE_NOT_FOUND", err.Code)
		assert.Contains(t, err.Message, "user")
		assert.Contains(t, err.Message, "123")
		assert.Equal(t, "user", err.Details["resource"])
		assert.Equal(t, "123", err.Details["id"])
	})

	t.Run("NewConflictError", func(t *testing.T) {
		err := NewConflictError("user", "email already exists")

		assert.Equal(t, ErrorTypeConflict, err.Type)
		assert.Equal(t, "RESOURCE_CONFLICT", err.Code)
		assert.Contains(t, err.Message, "user")
		assert.Contains(t, err.Message, "email already exists")
	})

	t.Run("NewDatabaseError", func(t *testing.T) {
		originalErr := errors.New("connection failed")
		err := NewDatabaseError("SaveUser", originalErr)

		assert.Equal(t, ErrorTypeDatabase, err.Type)
		assert.Equal(t, "DATABASE_ERROR", err.Code)
		assert.Contains(t, err.Message, "SaveUser")
		assert.Equal(t, "SaveUser", err.Operation)
		assert.Equal(t, originalErr, err.Cause)
	})

	t.Run("NewTimeoutError", func(t *testing.T) {
		timeout := 5 * time.Second
		err := NewTimeoutError("GetUser", timeout)

		assert.Equal(t, ErrorTypeTimeout, err.Type)
		assert.Equal(t, "TIMEOUT_ERROR", err.Code)
		assert.Contains(t, err.Message, "GetUser")
		assert.Contains(t, err.Message, "5s")
		assert.Equal(t, "GetUser", err.Operation)
		assert.Equal(t, timeout.String(), err.Details["timeout"])
	})

	t.Run("NewPanicError", func(t *testing.T) {
		panicValue := "something went wrong"
		stackTrace := []byte("stack trace here")
		err := NewPanicError(panicValue, stackTrace)

		assert.Equal(t, ErrorTypePanic, err.Type)
		assert.Equal(t, "PANIC_RECOVERED", err.Code)
		assert.Contains(t, err.Message, panicValue)
		assert.Equal(t, panicValue, err.Details["panic_value"])
		assert.Equal(t, string(stackTrace), err.Details["stack_trace"])
	})
}

func TestWrapError(t *testing.T) {
	t.Run("wraps regular error", func(t *testing.T) {
		originalErr := errors.New("original error")
		ctx := context.Background()

		wrappedErr := WrapError(ctx, originalErr, "TestOperation", "test message")

		require.NotNil(t, wrappedErr)
		appErr, ok := AsAppError(wrappedErr)
		require.True(t, ok)

		assert.Equal(t, ErrorTypeInternal, appErr.Type)
		assert.Equal(t, "test message", appErr.Message)
		assert.Equal(t, "TestOperation", appErr.Operation)
		assert.Equal(t, originalErr, appErr.Cause)
	})

	t.Run("returns nil for nil error", func(t *testing.T) {
		ctx := context.Background()
		wrappedErr := WrapError(ctx, nil, "TestOperation", "test message")
		assert.Nil(t, wrappedErr)
	})

	t.Run("adds context to existing AppError", func(t *testing.T) {
		originalErr := NewValidationError("CODE", "message")
		ctx := context.Background()

		wrappedErr := WrapError(ctx, originalErr, "TestOperation", "test message")

		require.NotNil(t, wrappedErr)
		appErr, ok := AsAppError(wrappedErr)
		require.True(t, ok)

		// With the new implementation, WrapError always creates a new error
		// The original error becomes the cause
		assert.NotSame(t, originalErr, appErr)
		assert.Equal(t, "test message", appErr.Message)
		assert.Equal(t, "TestOperation", appErr.Operation)
		assert.Equal(t, originalErr, appErr.Cause)
		assert.Equal(t, ErrorTypeInternal, appErr.Type)
	})
}

func TestSafeCall(t *testing.T) {
	t.Run("executes function successfully", func(t *testing.T) {
		ctx := context.Background()
		executed := false

		err := SafeCall(ctx, "TestOperation", func() error {
			executed = true
			return nil
		})

		assert.NoError(t, err)
		assert.True(t, executed)
	})

	t.Run("returns function error", func(t *testing.T) {
		ctx := context.Background()
		originalErr := errors.New("function error")

		err := SafeCall(ctx, "TestOperation", func() error {
			return originalErr
		})

		assert.Equal(t, originalErr, err)
	})

	t.Run("catches panic and returns error", func(t *testing.T) {
		ctx := context.Background()

		err := SafeCall(ctx, "TestOperation", func() error {
			panic("test panic")
		})

		require.NotNil(t, err)
		appErr, ok := AsAppError(err)
		require.True(t, ok)

		assert.Equal(t, ErrorTypePanic, appErr.Type)
		assert.Equal(t, "TestOperation", appErr.Operation)
		assert.Contains(t, appErr.Message, "test panic")
	})
}

func TestSafeCallWithResult(t *testing.T) {
	t.Run("executes function successfully", func(t *testing.T) {
		ctx := context.Background()
		expectedResult := "success"

		result, err := SafeCallWithResult(ctx, "TestOperation", func() (string, error) {
			return expectedResult, nil
		})

		assert.NoError(t, err)
		assert.Equal(t, expectedResult, result)
	})

	t.Run("returns function error", func(t *testing.T) {
		ctx := context.Background()
		originalErr := errors.New("function error")

		result, err := SafeCallWithResult(ctx, "TestOperation", func() (string, error) {
			return "", originalErr
		})

		assert.Equal(t, originalErr, err)
		assert.Empty(t, result)
	})

	t.Run("catches panic and returns error", func(t *testing.T) {
		ctx := context.Background()

		result, err := SafeCallWithResult(ctx, "TestOperation", func() (string, error) {
			panic("test panic")
		})

		require.NotNil(t, err)
		appErr, ok := AsAppError(err)
		require.True(t, ok)

		assert.Equal(t, ErrorTypePanic, appErr.Type)
		assert.Equal(t, "TestOperation", appErr.Operation)
		assert.Contains(t, appErr.Message, "test panic")
		assert.Empty(t, result)
	})
}

func TestRetryWithBackoff(t *testing.T) {
	t.Run("succeeds on first attempt", func(t *testing.T) {
		ctx := context.Background()
		attempts := 0

		err := RetryWithBackoff(ctx, "TestOperation", 3, 10*time.Millisecond, func() error {
			attempts++
			return nil
		})

		assert.NoError(t, err)
		assert.Equal(t, 1, attempts)
	})

	t.Run("succeeds after retries", func(t *testing.T) {
		ctx := context.Background()
		attempts := 0

		err := RetryWithBackoff(ctx, "TestOperation", 3, 10*time.Millisecond, func() error {
			attempts++
			if attempts < 3 {
				return NewNetworkError("service", errors.New("temporary failure"))
			}
			return nil
		})

		assert.NoError(t, err)
		assert.Equal(t, 3, attempts)
	})

	t.Run("fails after max retries", func(t *testing.T) {
		ctx := context.Background()
		attempts := 0
		originalErr := NewNetworkError("service", errors.New("persistent failure"))

		err := RetryWithBackoff(ctx, "TestOperation", 3, 10*time.Millisecond, func() error {
			attempts++
			return originalErr
		})

		require.NotNil(t, err)
		assert.Equal(t, 3, attempts)

		// Check if it's a wrapped error with max retries message
		// The RetryWithBackoff returns a WrapError result, so we need to check the full error message
		assert.Contains(t, err.Error(), "Max retries (3) exceeded")
	})

	t.Run("stops on non-retryable error", func(t *testing.T) {
		ctx := context.Background()
		attempts := 0
		nonRetryableErr := NewValidationError("CODE", "validation failed")

		err := RetryWithBackoff(ctx, "TestOperation", 3, 10*time.Millisecond, func() error {
			attempts++
			return nonRetryableErr
		})

		require.NotNil(t, err)
		assert.Equal(t, 1, attempts)

		// Check if it's a wrapped error with non-retryable message
		// The RetryWithBackoff returns a WrapError result, so we need to check the full error message
		assert.Contains(t, err.Error(), "Non-retryable error encountered")
	})

	t.Run("respects context cancellation", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		attempts := 0

		// Cancel context after first attempt
		go func() {
			time.Sleep(20 * time.Millisecond)
			cancel()
		}()

		err := RetryWithBackoff(ctx, "TestOperation", 5, 50*time.Millisecond, func() error {
			attempts++
			return NewNetworkError("service", errors.New("failure"))
		})

		require.NotNil(t, err)
		assert.Contains(t, err.Error(), "Context cancelled")
		assert.True(t, attempts <= 2) // Should not complete all retries
	})
}

func TestErrorChecking(t *testing.T) {
	t.Run("IsAppError", func(t *testing.T) {
		appErr := NewValidationError("CODE", "message")
		regularErr := errors.New("regular error")

		assert.True(t, IsAppError(appErr))
		assert.False(t, IsAppError(regularErr))
		assert.False(t, IsAppError(nil))
	})

	t.Run("AsAppError", func(t *testing.T) {
		appErr := NewValidationError("CODE", "message")
		regularErr := errors.New("regular error")

		converted, ok := AsAppError(appErr)
		assert.True(t, ok)
		assert.Same(t, appErr, converted)

		converted, ok = AsAppError(regularErr)
		assert.False(t, ok)
		assert.Nil(t, converted)
	})

	t.Run("IsErrorType", func(t *testing.T) {
		validationErr := NewValidationError("CODE", "message")
		notFoundErr := NewNotFoundError("resource", "id")
		regularErr := errors.New("regular error")

		assert.True(t, IsErrorType(validationErr, ErrorTypeValidation))
		assert.False(t, IsErrorType(validationErr, ErrorTypeNotFound))
		assert.True(t, IsErrorType(notFoundErr, ErrorTypeNotFound))
		assert.False(t, IsErrorType(regularErr, ErrorTypeValidation))
	})

	t.Run("IsRetryable", func(t *testing.T) {
		retryableErr := NewNetworkError("service", errors.New("network error"))
		nonRetryableErr := NewValidationError("CODE", "validation error")
		regularErr := errors.New("regular error")

		assert.True(t, IsRetryable(retryableErr))
		assert.False(t, IsRetryable(nonRetryableErr))
		assert.False(t, IsRetryable(regularErr))
	})

	t.Run("GetHTTPStatus", func(t *testing.T) {
		validationErr := NewValidationError("CODE", "message")
		notFoundErr := NewNotFoundError("resource", "id")
		regularErr := errors.New("regular error")

		assert.Equal(t, 400, GetHTTPStatus(validationErr))
		assert.Equal(t, 404, GetHTTPStatus(notFoundErr))
		assert.Equal(t, 500, GetHTTPStatus(regularErr))
	})
}

func TestErrorGroup(t *testing.T) {
	t.Run("empty group", func(t *testing.T) {
		group := NewErrorGroup()

		assert.False(t, group.HasErrors())
		assert.Empty(t, group.Errors())
		assert.Empty(t, group.Error())
		assert.Nil(t, group.ToAppError(context.Background(), "test"))
	})

	t.Run("single error", func(t *testing.T) {
		group := NewErrorGroup()
		err := errors.New("single error")

		group.Add(err)

		assert.True(t, group.HasErrors())
		assert.Len(t, group.Errors(), 1)
		assert.Equal(t, "single error", group.Error())

		appErr := group.ToAppError(context.Background(), "test")
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Error(), "single error")
	})

	t.Run("multiple errors", func(t *testing.T) {
		group := NewErrorGroup()
		err1 := errors.New("error 1")
		err2 := errors.New("error 2")

		group.Add(err1)
		group.Add(err2)

		assert.True(t, group.HasErrors())
		assert.Len(t, group.Errors(), 2)
		assert.Contains(t, group.Error(), "error 1")
		assert.Contains(t, group.Error(), "error 2")

		appErr := group.ToAppError(context.Background(), "test")
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Error(), "Multiple errors")
	})

	t.Run("ignores nil errors", func(t *testing.T) {
		group := NewErrorGroup()
		group.Add(nil)
		group.Add(errors.New("real error"))
		group.Add(nil)

		assert.True(t, group.HasErrors())
		assert.Len(t, group.Errors(), 1)
		assert.Equal(t, "real error", group.Error())
	})
}

func TestWithTimeout(t *testing.T) {
	t.Run("completes within timeout", func(t *testing.T) {
		ctx := context.Background()

		err := WithTimeout(ctx, 100*time.Millisecond, "TestOperation", func(ctx context.Context) error {
			time.Sleep(10 * time.Millisecond)
			return nil
		})

		assert.NoError(t, err)
	})

	t.Run("times out", func(t *testing.T) {
		ctx := context.Background()

		err := WithTimeout(ctx, 50*time.Millisecond, "TestOperation", func(ctx context.Context) error {
			time.Sleep(100 * time.Millisecond)
			return nil
		})

		require.NotNil(t, err)
		appErr, ok := AsAppError(err)
		require.True(t, ok)

		assert.Equal(t, ErrorTypeTimeout, appErr.Type)
		assert.Equal(t, "TestOperation", appErr.Operation)
	})

	t.Run("returns function error", func(t *testing.T) {
		ctx := context.Background()
		expectedErr := errors.New("function error")

		err := WithTimeout(ctx, 100*time.Millisecond, "TestOperation", func(ctx context.Context) error {
			return expectedErr
		})

		assert.Equal(t, expectedErr, err)
	})

	t.Run("catches panic", func(t *testing.T) {
		ctx := context.Background()

		err := WithTimeout(ctx, 100*time.Millisecond, "TestOperation", func(ctx context.Context) error {
			panic("test panic")
		})

		require.NotNil(t, err)
		appErr, ok := AsAppError(err)
		require.True(t, ok)

		assert.Equal(t, ErrorTypePanic, appErr.Type)
		assert.Contains(t, appErr.Message, "test panic")
	})
}
