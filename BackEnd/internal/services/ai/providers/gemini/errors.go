package gemini

import (
	"errors"
)

var (
	ErrAPIKeyRequired = errors.New("gemini API key is required")
	ErrClientNotInit  = errors.New("gemini client not initialized")
	ErrGenerationFail = errors.New("gemini content generation failed")
	ErrEmptyResponse  = errors.New("gemini returned empty response")
	ErrInvalidModel   = errors.New("invalid model name")
)

type GeminiError struct {
	Code    int
	Message string
	Err     error
}

func (e *GeminiError) Error() string {
	if e.Err != nil {
		return e.Err.Error()
	}
	return e.Message
}

func (e *GeminiError) Unwrap() error {
	return e.Err
}

func NewGeminiError(code int, message string, err error) *GeminiError {
	return &GeminiError{
		Code:    code,
		Message: message,
		Err:     err,
	}
}
