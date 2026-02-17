package ai

import (
	"time"

	domain "github.com/osmait/gestorDePresupuesto/internal/domain/ai"
)

type Config struct {
	Provider       AIProvider
	MaxRetries     int
	RetryBackoff   time.Duration
	RequestTimeout time.Duration
	MaxFileSize    int64
	MaxFiles       int
	EnableMetrics  bool
}

func DefaultConfig() *Config {
	return &Config{
		MaxRetries:     2,
		RetryBackoff:   time.Second,
		RequestTimeout: 30 * time.Second,
		MaxFileSize:    10 * 1024 * 1024,
		MaxFiles:       5,
		EnableMetrics:  true,
	}
}

func (c *Config) Validate() error {
	if c.Provider == nil {
		return domain.ErrProviderFailed
	}
	if c.MaxRetries < 0 {
		c.MaxRetries = 0
	}
	if c.RetryBackoff <= 0 {
		c.RetryBackoff = time.Second
	}
	if c.RequestTimeout <= 0 {
		c.RequestTimeout = 30 * time.Second
	}
	if c.MaxFileSize <= 0 {
		c.MaxFileSize = 10 * 1024 * 1024
	}
	if c.MaxFiles <= 0 {
		c.MaxFiles = 5
	}
	return nil
}

type TaskInput struct {
	DocumentType string
	AccountID    string
	UserID       string
	Categories   []CategoryInfo
}

type CategoryInfo struct {
	ID          string
	Name        string
	Description string
}
