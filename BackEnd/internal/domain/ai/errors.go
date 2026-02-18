package ai

import "errors"

var (
	ErrInvalidInput    = errors.New("invalid input for AI task")
	ErrFileTooLarge    = errors.New("file size exceeds maximum allowed")
	ErrInvalidFileType = errors.New("invalid file type for AI processing")
	ErrTooManyFiles    = errors.New("too many files for processing")
	ErrTaskNotFound    = errors.New("AI task not found")
	ErrProviderFailed  = errors.New("AI provider request failed")
	ErrParseFailed     = errors.New("failed to parse AI response")
	ErrContextCanceled = errors.New("AI request was canceled")
	ErrTimeoutExceeded = errors.New("AI request timeout exceeded")
	ErrEmptyResponse   = errors.New("AI returned empty response")
	ErrInvalidJSON     = errors.New("AI returned invalid JSON")
)

type AIError struct {
	TaskType  AITaskType
	Operation string
	Err       error
	Message   string
}

func (e *AIError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return e.Err.Error()
}

func (e *AIError) Unwrap() error {
	return e.Err
}

func NewAIError(taskType AITaskType, operation string, err error) *AIError {
	return &AIError{
		TaskType:  taskType,
		Operation: operation,
		Err:       err,
	}
}

func IsAIError(err error) bool {
	var aiErr *AIError
	return errors.As(err, &aiErr)
}

func IsRetryableError(err error) bool {
	return errors.Is(err, ErrProviderFailed) ||
		errors.Is(err, ErrTimeoutExceeded) ||
		errors.Is(err, ErrContextCanceled)
}
