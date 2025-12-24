# Error Handling System

## Overview

This document describes the comprehensive error handling system implemented in the GestorDePresupuesto backend application. The system provides structured error management with proper context propagation, OpenTelemetry integration, and robust recovery patterns.

## Architecture

### Core Components

1. **AppError**: Structured error type with metadata
2. **Error Utilities**: Helper functions for wrapping and handling errors
3. **Error Middleware**: HTTP middleware for error processing
4. **Context Propagation**: Automatic trace and context integration
5. **Recovery Patterns**: Panic recovery and safe execution

### Error Types

The system categorizes errors into specific types for better handling:

```go
// Domain errors
ErrorTypeValidation   = "validation"
ErrorTypeBusiness     = "business"
ErrorTypeNotFound     = "not_found"
ErrorTypeConflict     = "conflict"
ErrorTypeUnauthorized = "unauthorized"
ErrorTypeForbidden    = "forbidden"

// Infrastructure errors
ErrorTypeDatabase    = "database"
ErrorTypeNetwork     = "network"
ErrorTypeExternal    = "external"
ErrorTypeTimeout     = "timeout"
ErrorTypeRateLimit   = "rate_limit"

// System errors
ErrorTypeInternal    = "internal"
ErrorTypeUnavailable = "unavailable"
ErrorTypeUnknown     = "unknown"
ErrorTypePanic       = "panic"
```

### Error Severity Levels

Errors are classified by severity for proper logging and alerting:

```go
SeverityLow      = "low"      // Business logic errors, validation errors
SeverityMedium   = "medium"   // External service errors, network issues
SeverityHigh     = "high"     // Database errors, authentication failures
SeverityCritical = "critical" // System failures, panics
```

## Usage Guide

### Creating Errors

#### Basic Error Creation

```go
import apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"

// Create a validation error
err := apperrors.NewValidationError("INVALID_EMAIL", "email format is invalid")

// Create a not found error
err := apperrors.NewNotFoundError("user", "12345")

// Create a conflict error
err := apperrors.NewConflictError("user", "email already exists")
```

#### Error with Context

```go
func (s *UserService) CreateUser(ctx context.Context, req *dto.UserRequest) error {
    // Create error with context
    if req.Email == "" {
        return apperrors.NewValidationError("MISSING_EMAIL", "email is required").
            WithContext(ctx).
            WithOperation("CreateUser").
            WithDetails(map[string]interface{}{
                "field": "email",
            })
    }
    
    // ... rest of the function
}
```

### Error Wrapping

#### Database Errors

```go
user, err := s.userRepository.FindUserById(ctx, id)
if err != nil {
    return apperrors.WrapDatabaseError(ctx, err, "FindUserById")
}
```

#### Network Errors

```go
response, err := httpClient.Get(url)
if err != nil {
    return apperrors.WrapNetworkError(ctx, err, "external-service", "GET user data")
}
```

#### Generic Error Wrapping

```go
result, err := complexOperation()
if err != nil {
    return apperrors.WrapError(ctx, err, "ComplexOperation", "failed to process data")
}
```

### Safe Execution Patterns

#### Safe Call (No Return Value)

```go
func (s *UserService) DeleteUser(ctx context.Context, id string) error {
    return apperrors.SafeCall(ctx, "DeleteUser", func() error {
        // Your logic here
        return s.userRepository.Delete(ctx, id)
    })
}
```

#### Safe Call with Result

```go
func (s *UserService) GetUser(ctx context.Context, id string) (*dto.UserResponse, error) {
    return apperrors.SafeCallWithResult(ctx, "GetUser", func() (*dto.UserResponse, error) {
        // Your logic here
        user, err := s.userRepository.FindUserById(ctx, id)
        if err != nil {
            return nil, err
        }
        return dto.NewUserResponse(user), nil
    })
}
```

### Retry Patterns

#### Retry with Exponential Backoff

```go
func (s *UserService) GetUserWithRetry(ctx context.Context, id string) (*dto.UserResponse, error) {
    var result *dto.UserResponse
    var err error

    retryErr := apperrors.RetryWithBackoff(ctx, "GetUserWithRetry", 3, 100*time.Millisecond, func() error {
        result, err = s.FindUserById(ctx, id)
        return err
    })

    if retryErr != nil {
        return nil, apperrors.WrapError(ctx, retryErr, "GetUserWithRetry", 
            fmt.Sprintf("failed to get user after retries: %s", id))
    }

    return result, nil
}
```

#### Timeout Handling

```go
func (s *UserService) GetUserWithTimeout(ctx context.Context, id string) (*dto.UserResponse, error) {
    return apperrors.WithTimeout(ctx, 5*time.Second, "GetUserWithTimeout", 
        func(timeoutCtx context.Context) error {
            user, err := s.FindUserById(timeoutCtx, id)
            if err != nil {
                return err
            }
            // Process user...
            return nil
        })
}
```

### Error Checking

#### Type Checking

```go
if apperrors.IsErrorType(err, apperrors.ErrorTypeValidation) {
    // Handle validation error
}

if apperrors.IsErrorType(err, apperrors.ErrorTypeNotFound) {
    // Handle not found error
}
```

#### Retrieving Error Information

```go
if apperrors.IsAppError(err) {
    appErr, _ := apperrors.AsAppError(err)
    
    // Get error details
    code := appErr.Code
    severity := appErr.Severity
    httpStatus := appErr.ToHTTPStatus()
    
    // Check if retryable
    if appErr.IsRetryable() {
        // Implement retry logic
    }
}
```

## HTTP Error Handling

### Middleware Integration

The error handling middleware automatically processes errors and returns appropriate HTTP responses:

```go
// In server setup
s.Engine.Use(middleware.ErrorHandler(middleware.DefaultErrorHandlerConfig()))
```

### Handler Error Responses

```go
func (h *UserHandler) CreateUser(c *gin.Context) {
    var req dto.UserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        // This will be automatically handled by the error middleware
        c.Error(apperrors.NewValidationError("INVALID_REQUEST", "invalid request body"))
        return
    }
    
    if err := h.userService.CreateUser(c.Request.Context(), &req); err != nil {
        c.Error(err) // Middleware will handle the error
        return
    }
    
    c.JSON(http.StatusCreated, gin.H{"message": "User created successfully"})
}
```

### Error Response Format

The middleware returns errors in a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email"
    },
    "type": "validation",
    "severity": "low",
    "timestamp": "2023-12-01T10:30:00Z",
    "retryable": false
  },
  "trace_id": "abc123def456",
  "span_id": "789xyz012"
}
```

## OpenTelemetry Integration

### Automatic Trace Recording

Errors are automatically recorded in OpenTelemetry spans:

```go
// The error will be recorded in the current span
err := apperrors.NewDatabaseError("SaveUser", originalErr).
    WithContext(ctx).
    WithOperation("CreateUser")

// Span attributes will include:
// - error.type: "database"
// - error.code: "DATABASE_ERROR"
// - error.severity: "high"
// - error.operation: "CreateUser"
// - error.retryable: true
```

### Manual Span Recording

```go
if appErr, ok := apperrors.AsAppError(err); ok {
    appErr.RecordInSpan(ctx)
}
```

## Best Practices

### 1. Use Appropriate Error Types

```go
// Good: Use specific error types
return apperrors.NewValidationError("INVALID_EMAIL", "email format is invalid")

// Bad: Use generic errors
return errors.New("invalid email")
```

### 2. Add Context Information

```go
// Good: Include context and operation details
return apperrors.NewDatabaseError("SaveUser", err).
    WithContext(ctx).
    WithOperation("CreateUser").
    WithDetails(map[string]interface{}{
        "user_id": userID,
        "email": user.Email,
    })

// Bad: No context information
return err
```

### 3. Use Safe Execution Patterns

```go
// Good: Use SafeCall to prevent panics
return apperrors.SafeCall(ctx, "ProcessData", func() error {
    // Complex logic that might panic
    return processComplexData()
})

// Bad: No panic protection
return processComplexData()
```

### 4. Implement Proper Error Wrapping

```go
// Good: Wrap errors to preserve context
if err := database.Save(user); err != nil {
    return apperrors.WrapDatabaseError(ctx, err, "SaveUser")
}

// Bad: Return raw errors
if err := database.Save(user); err != nil {
    return err
}
```

### 5. Handle Retryable Errors

```go
// Good: Implement retry logic for retryable errors
if apperrors.IsRetryable(err) {
    return apperrors.RetryWithBackoff(ctx, "Operation", 3, 100*time.Millisecond, func() error {
        return performOperation()
    })
}
```

## Error Monitoring and Alerting

### Metrics Collection

The system automatically collects error metrics:

- Error count by type and severity
- Error rate by operation
- Panic occurrences
- Retry attempts and success rates

### Alerting Conditions

Set up alerts for:

- High error rates (>5% for critical operations)
- Critical severity errors
- Panic occurrences
- Database connection errors
- External service failures

### Log Correlation

All errors include trace IDs for easy correlation:

```bash
# Search logs by trace ID
grep "trace_id:abc123def456" /var/log/app.log

# Search errors by operation
grep "operation:CreateUser" /var/log/app.log | grep "severity:high"
```

## Testing Error Handling

### Unit Tests

```go
func TestUserService_CreateUser_ValidationError(t *testing.T) {
    service := NewUserService(mockRepo)
    
    // Test validation error
    err := service.CreateUser(context.Background(), &dto.UserRequest{})
    
    // Check if it's a validation error
    assert.True(t, apperrors.IsErrorType(err, apperrors.ErrorTypeValidation))
    
    // Check error details
    appErr, ok := apperrors.AsAppError(err)
    assert.True(t, ok)
    assert.Equal(t, "INVALID_EMAIL", appErr.Code)
    assert.Equal(t, apperrors.SeverityLow, appErr.Severity)
}
```

### Integration Tests

```go
func TestErrorHandling_DatabaseFailure(t *testing.T) {
    // Simulate database failure
    mockRepo.On("Save", mock.Anything, mock.Anything).Return(sql.ErrConnDone)
    
    service := NewUserService(mockRepo)
    err := service.CreateUser(context.Background(), validRequest)
    
    // Verify error wrapping
    assert.True(t, apperrors.IsErrorType(err, apperrors.ErrorTypeDatabase))
    assert.True(t, apperrors.IsRetryable(err))
}
```

## Migration Guide

### From Old Error Handling

```go
// Old approach
if err != nil {
    return err
}

// New approach
if err != nil {
    return apperrors.WrapDatabaseError(ctx, err, "Operation")
}
```

### Handler Updates

```go
// Old approach
func (h *Handler) CreateUser(c *gin.Context) {
    if err := h.service.CreateUser(req); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
}

// New approach
func (h *Handler) CreateUser(c *gin.Context) {
    if err := h.service.CreateUser(c.Request.Context(), req); err != nil {
        c.Error(err) // Middleware handles the response
        return
    }
}
```

## Troubleshooting

### Common Issues

1. **Error not recorded in traces**: Ensure context is passed correctly
2. **Panic not caught**: Use `SafeCall` or `SafeCallWithResult`
3. **Missing error details**: Add context with `WithDetails()`
4. **Incorrect HTTP status**: Check error type mapping

### Debug Mode

Enable debug mode for detailed error information:

```go
config := middleware.ErrorHandlerConfig{
    ShowStackTrace: true,
    ShowErrorCode:  true,
    LogStackTrace:  true,
    EnableMetrics:  true,
}
```

## Performance Considerations

- Error creation is lightweight
- Context propagation has minimal overhead
- Retry patterns include exponential backoff
- Metrics collection is async and non-blocking
- Stack traces are captured only when needed

## Security Considerations

- Sensitive information is filtered from error responses
- Internal errors return generic messages to clients
- Stack traces are not exposed in production
- Error details are sanitized for public APIs

---

This error handling system provides a robust foundation for reliable and observable error management in the GestorDePresupuesto application. 