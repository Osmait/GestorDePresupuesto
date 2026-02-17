package ai

import (
	"context"
	"fmt"
	"time"

	domain "github.com/osmait/gestorDePresupuesto/internal/domain/ai"
	"github.com/rs/zerolog"
)

type Service struct {
	provider AIProvider
	tasks    map[domain.AITaskType]domain.AITask
	config   *Config
	logger   zerolog.Logger
}

func NewService(config *Config, logger zerolog.Logger) (*Service, error) {
	if config == nil {
		config = DefaultConfig()
	}

	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid AI config: %w", err)
	}

	if err := config.Provider.ValidateConfig(); err != nil {
		return nil, fmt.Errorf("invalid provider config: %w", err)
	}

	return &Service{
		provider: config.Provider,
		tasks:    make(map[domain.AITaskType]domain.AITask),
		config:   config,
		logger:   logger,
	}, nil
}

func (s *Service) RegisterTask(taskType domain.AITaskType, task domain.AITask) {
	s.tasks[taskType] = task
	s.logger.Info().Str("task_type", string(taskType)).Msg("AI task registered")
}

func (s *Service) Execute(
	ctx context.Context,
	taskType domain.AITaskType,
	input interface{},
	files []domain.DocumentFile,
) (*domain.AIResult, error) {
	startTime := time.Now()

	task, ok := s.tasks[taskType]
	if !ok {
		return nil, NewServiceError("TASK_NOT_FOUND", fmt.Sprintf("task %s not registered", taskType), nil)
	}

	if err := task.ValidateInput(input); err != nil {
		return nil, NewServiceError("INVALID_INPUT", err.Error(), err)
	}

	if err := s.validateFiles(files); err != nil {
		return nil, NewServiceError("INVALID_FILES", err.Error(), err)
	}

	prompt, err := task.BuildPrompt(input)
	if err != nil {
		return nil, NewServiceError("PROMPT_BUILD_FAILED", err.Error(), err)
	}

	var lastErr error
	for attempt := 0; attempt <= s.config.MaxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(attempt*attempt) * s.config.RetryBackoff
			s.logger.Warn().
				Int("attempt", attempt).
				Dur("backoff", backoff).
				Err(lastErr).
				Msg("Retrying AI request")

			select {
			case <-ctx.Done():
				return nil, domain.ErrContextCanceled
			case <-time.After(backoff):
			}
		}

		result, err := s.executeAttempt(ctx, task, prompt, files, startTime)
		if err == nil {
			return result, nil
		}

		lastErr = err

		if !s.isRetryableError(err) {
			break
		}
	}

	return nil, NewServiceError("MAX_RETRIES_EXCEEDED", "all retry attempts failed", lastErr)
}

func (s *Service) executeAttempt(
	ctx context.Context,
	task domain.AITask,
	prompt string,
	files []domain.DocumentFile,
	startTime time.Time,
) (*domain.AIResult, error) {
	ctx, cancel := context.WithTimeout(ctx, s.config.RequestTimeout)
	defer cancel()

	resp, err := s.provider.GenerateContent(ctx, prompt, files)
	if err != nil {
		return nil, fmt.Errorf("provider error: %w", err)
	}

	data, err := task.ParseResponse(resp.Content)
	if err != nil {
		return nil, fmt.Errorf("parse error: %w", err)
	}

	processingTime := time.Since(startTime)

	s.logger.Info().
		Str("task_type", string(task.GetType())).
		Str("model", resp.Model).
		Int("prompt_tokens", resp.Usage.PromptTokens).
		Int("completion_tokens", resp.Usage.CompletionTokens).
		Int("total_tokens", resp.Usage.TotalTokens).
		Dur("processing_time", processingTime).
		Msg("AI task executed successfully")

	return domain.NewAIResult(
		task.GetType(),
		data,
		resp.Usage,
		processingTime,
		resp.Model,
	), nil
}

func (s *Service) validateFiles(files []domain.DocumentFile) error {
	if len(files) > s.config.MaxFiles {
		return fmt.Errorf("too many files: %d (max %d)", len(files), s.config.MaxFiles)
	}

	for _, file := range files {
		if file.Size > s.config.MaxFileSize {
			return fmt.Errorf("file too large: %s (max %d bytes)", file.Filename, s.config.MaxFileSize)
		}

		if !domain.IsValidContentType(file.ContentType) {
			return fmt.Errorf("invalid content type: %s for file %s", file.ContentType, file.Filename)
		}
	}

	return nil
}

func (s *Service) isRetryableError(err error) bool {
	return domain.IsRetryableError(err) ||
		domain.IsAIError(err)
}

func (s *Service) Close() error {
	if s.provider != nil {
		return s.provider.Close()
	}
	return nil
}

func (s *Service) GetProviderName() string {
	if s.provider != nil {
		return s.provider.GetProviderName()
	}
	return "none"
}

func (s *Service) GetModel() string {
	if s.provider != nil {
		return s.provider.GetModel()
	}
	return "unknown"
}
