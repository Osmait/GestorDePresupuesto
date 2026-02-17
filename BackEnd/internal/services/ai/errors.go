package ai

import (
	"errors"
	"fmt"
)

var (
	ErrServiceNotInitialized = errors.New("AI service not initialized")
	ErrProviderNotConfigured = errors.New("AI provider not configured")
	ErrTaskNotRegistered     = errors.New("AI task not registered")
	ErrInvalidTaskInput      = errors.New("invalid task input")
	ErrMaxRetriesExceeded    = errors.New("max retries exceeded")
)

type ServiceError struct {
	Code    string
	Message string
	Err     error
}

func (e *ServiceError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

func (e *ServiceError) Unwrap() error {
	return e.Err
}

func NewServiceError(code, message string, err error) *ServiceError {
	return &ServiceError{
		Code:    code,
		Message: message,
		Err:     err,
	}
}

func IsServiceError(err error) bool {
	var svcErr *ServiceError
	return errors.As(err, &svcErr)
}
