package gemini

import (
	"fmt"
	"time"
)

type Config struct {
	APIKey      string
	Model       string
	Temperature float32
	TopP        float32
	MaxRetries  int
	Timeout     time.Duration
}

func DefaultConfig() *Config {
	return &Config{
		Model:       "gemini-2.0-flash-exp",
		Temperature: 0.1,
		TopP:        0.1,
		MaxRetries:  2,
		Timeout:     30 * time.Second,
	}
}

func (c *Config) Validate() error {
	if c.APIKey == "" {
		return ErrAPIKeyRequired
	}
	if c.Model == "" {
		c.Model = "gemini-2.0-flash-exp"
	}
	if c.Temperature < 0 || c.Temperature > 2 {
		c.Temperature = 0.1
	}
	if c.TopP < 0 || c.TopP > 1 {
		c.TopP = 0.1
	}
	if c.Timeout <= 0 {
		c.Timeout = 30 * time.Second
	}
	return nil
}

func (c *Config) String() string {
	return fmt.Sprintf("GeminiConfig{Model: %s, Temperature: %.2f, TopP: %.2f}", c.Model, c.Temperature, c.TopP)
}
