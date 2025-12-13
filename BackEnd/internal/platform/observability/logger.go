package observability

import (
	"context"
	"io"
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"
)

// Logger wraps zerolog with OpenTelemetry integration
type Logger struct {
	logger zerolog.Logger
}

// LoggerConfig holds logger configuration
type LoggerConfig struct {
	Level      string
	Format     string // json, console
	Output     string // stdout, stderr, file
	Filename   string
	TimeFormat string
	Caller     bool
}

// NewLoggerConfig creates a new logger configuration from environment variables
func NewLoggerConfig() *LoggerConfig {
	return &LoggerConfig{
		Level:      getEnv("LOG_LEVEL", "info"),
		Format:     getEnv("LOG_FORMAT", "json"),
		Output:     getEnv("LOG_OUTPUT", "stdout"),
		Filename:   getEnv("LOG_FILENAME", "app.log"),
		TimeFormat: getEnv("LOG_TIME_FORMAT", time.RFC3339),
		Caller:     getEnv("LOG_CALLER", "false") == "true",
	}
}

// NewLogger creates a new logger instance
func NewLogger(cfg *LoggerConfig) *Logger {
	// Set global log level
	level, err := zerolog.ParseLevel(cfg.Level)
	if err != nil {
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)

	// Configure output
	var output io.Writer
	switch cfg.Output {
	case "stderr":
		output = os.Stderr
	case "file":
		file, err := os.OpenFile(cfg.Filename, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			output = os.Stdout
		} else {
			output = file
		}
	default:
		output = os.Stdout
	}

	// Configure format
	var logger zerolog.Logger
	if cfg.Format == "console" {
		logger = zerolog.New(zerolog.ConsoleWriter{
			Out:        output,
			TimeFormat: cfg.TimeFormat,
			NoColor:    false,
		})
	} else {
		logger = zerolog.New(output)
	}

	// Configure time format
	zerolog.TimeFieldFormat = cfg.TimeFormat

	// Add timestamp and caller information
	logger = logger.With().Timestamp().Logger()
	if cfg.Caller {
		logger = logger.With().Caller().Logger()
	}

	return &Logger{logger: logger}
}

// WithContext adds context to the logger (currently no-op for traces)
func (l *Logger) WithContext(ctx context.Context) *Logger {
	return &Logger{logger: l.logger}
}

// WithFields adds structured fields to the logger
func (l *Logger) WithFields(fields map[string]interface{}) *Logger {
	logger := l.logger
	for key, value := range fields {
		logger = logger.With().Interface(key, value).Logger()
	}
	return &Logger{logger: logger}
}

// WithField adds a single structured field to the logger
func (l *Logger) WithField(key string, value interface{}) *Logger {
	return &Logger{logger: l.logger.With().Interface(key, value).Logger()}
}

// WithError adds an error to the logger context
func (l *Logger) WithError(err error) *Logger {
	return &Logger{logger: l.logger.With().Err(err).Logger()}
}

// WithService adds service information to the logger
func (l *Logger) WithService(service, operation string) *Logger {
	return &Logger{logger: l.logger.With().
		Str("service", service).
		Str("operation", operation).
		Logger()}
}

// WithUser adds user information to the logger
func (l *Logger) WithUser(userID string) *Logger {
	return &Logger{logger: l.logger.With().Str("user_id", userID).Logger()}
}

// WithRequest adds request information to the logger
func (l *Logger) WithRequest(method, path, userAgent, clientIP string) *Logger {
	return &Logger{logger: l.logger.With().
		Str("http_method", method).
		Str("http_path", path).
		Str("user_agent", userAgent).
		Str("client_ip", clientIP).
		Logger()}
}

// WithDuration adds duration information to the logger
func (l *Logger) WithDuration(duration time.Duration) *Logger {
	return &Logger{logger: l.logger.With().
		Dur("duration", duration).
		Float64("duration_ms", float64(duration.Nanoseconds())/1e6).
		Logger()}
}

// Debug logs a debug message
func (l *Logger) Debug(msg string) {
	l.logger.Debug().Msg(msg)
}

// Debugf logs a formatted debug message
func (l *Logger) Debugf(format string, args ...interface{}) {
	l.logger.Debug().Msgf(format, args...)
}

// Info logs an info message
func (l *Logger) Info(msg string) {
	l.logger.Info().Msg(msg)
}

// Infof logs a formatted info message
func (l *Logger) Infof(format string, args ...interface{}) {
	l.logger.Info().Msgf(format, args...)
}

// Warn logs a warning message
func (l *Logger) Warn(msg string) {
	l.logger.Warn().Msg(msg)
}

// Warnf logs a formatted warning message
func (l *Logger) Warnf(format string, args ...interface{}) {
	l.logger.Warn().Msgf(format, args...)
}

// Error logs an error message
func (l *Logger) Error(msg string) {
	l.logger.Error().Msg(msg)
}

// Errorf logs a formatted error message
func (l *Logger) Errorf(format string, args ...interface{}) {
	l.logger.Error().Msgf(format, args...)
}

// Fatal logs a fatal message and exits
func (l *Logger) Fatal(msg string) {
	l.logger.Fatal().Msg(msg)
}

// Fatalf logs a formatted fatal message and exits
func (l *Logger) Fatalf(format string, args ...interface{}) {
	l.logger.Fatal().Msgf(format, args...)
}

// Panic logs a panic message and panics
func (l *Logger) Panic(msg string) {
	l.logger.Panic().Msg(msg)
}

// Panicf logs a formatted panic message and panics
func (l *Logger) Panicf(format string, args ...interface{}) {
	l.logger.Panic().Msgf(format, args...)
}

// Event creates a new log event with the specified level
func (l *Logger) Event(level zerolog.Level) *zerolog.Event {
	return l.logger.WithLevel(level)
}

// Logger returns the underlying zerolog logger
func (l *Logger) Logger() zerolog.Logger {
	return l.logger
}

// Global logger instance
var globalLogger *Logger

// InitializeGlobalLogger initializes the global logger
func InitializeGlobalLogger(cfg *LoggerConfig) {
	globalLogger = NewLogger(cfg)
}

// GetGlobalLogger returns the global logger instance
func GetGlobalLogger() *Logger {
	if globalLogger == nil {
		// Initialize with default config if not set
		globalLogger = NewLogger(NewLoggerConfig())
	}
	return globalLogger
}

// GetLogger returns the global logger instance (alias for GetGlobalLogger)
func GetLogger() *Logger {
	return GetGlobalLogger()
}

// Context-aware logging functions that use the global logger

// DebugCtx logs a debug message with context
func DebugCtx(ctx context.Context, msg string) {
	GetGlobalLogger().WithContext(ctx).Debug(msg)
}

// DebugfCtx logs a formatted debug message with context
func DebugfCtx(ctx context.Context, format string, args ...interface{}) {
	GetGlobalLogger().WithContext(ctx).Debugf(format, args...)
}

// InfoCtx logs an info message with context
func InfoCtx(ctx context.Context, msg string) {
	GetGlobalLogger().WithContext(ctx).Info(msg)
}

// InfofCtx logs a formatted info message with context
func InfofCtx(ctx context.Context, format string, args ...interface{}) {
	GetGlobalLogger().WithContext(ctx).Infof(format, args...)
}

// WarnCtx logs a warning message with context
func WarnCtx(ctx context.Context, msg string) {
	GetGlobalLogger().WithContext(ctx).Warn(msg)
}

// WarnfCtx logs a formatted warning message with context
func WarnfCtx(ctx context.Context, format string, args ...interface{}) {
	GetGlobalLogger().WithContext(ctx).Warnf(format, args...)
}

// ErrorCtx logs an error message with context
func ErrorCtx(ctx context.Context, msg string) {
	GetGlobalLogger().WithContext(ctx).Error(msg)
}

// ErrorfCtx logs a formatted error message with context
func ErrorfCtx(ctx context.Context, format string, args ...interface{}) {
	GetGlobalLogger().WithContext(ctx).Errorf(format, args...)
}

// LogError logs an error with context and structured fields
func LogError(ctx context.Context, err error, msg string, fields map[string]interface{}) {
	logger := GetGlobalLogger().WithContext(ctx).WithError(err)
	if fields != nil {
		logger = logger.WithFields(fields)
	}
	logger.Error(msg)
}

// LogServiceOperation logs a service operation with context
func LogServiceOperation(ctx context.Context, service, operation string, duration time.Duration, success bool, fields map[string]interface{}) {
	logger := GetGlobalLogger().WithContext(ctx).
		WithService(service, operation).
		WithDuration(duration).
		WithField("success", success)

	if fields != nil {
		logger = logger.WithFields(fields)
	}

	if success {
		logger.Info("service operation completed")
	} else {
		logger.Error("service operation failed")
	}
}

// LogHTTPRequest logs an HTTP request with context
func LogHTTPRequest(ctx context.Context, method, path, userAgent, clientIP string, duration time.Duration, statusCode int) {
	logger := GetGlobalLogger().WithContext(ctx).
		WithRequest(method, path, userAgent, clientIP).
		WithDuration(duration).
		WithField("status_code", statusCode)

	if statusCode >= 400 {
		logger.Error("HTTP request failed")
	} else {
		logger.Info("HTTP request completed")
	}
}

// LogDatabaseQuery logs a database query with context
func LogDatabaseQuery(ctx context.Context, queryType string, duration time.Duration, success bool, rowsAffected int64) {
	logger := GetGlobalLogger().WithContext(ctx).
		WithService("database", queryType).
		WithDuration(duration).
		WithField("success", success).
		WithField("rows_affected", rowsAffected)

	if success {
		logger.Debug("database query completed")
	} else {
		logger.Error("database query failed")
	}
}

// LogBusinessEvent logs a business event with context
func LogBusinessEvent(ctx context.Context, eventType, description string, fields map[string]interface{}) {
	logger := GetGlobalLogger().WithContext(ctx).
		WithField("event_type", eventType).
		WithField("description", description)

	if fields != nil {
		logger = logger.WithFields(fields)
	}

	logger.Info("business event occurred")
}

// LogSecurityEvent logs a security event with context
func LogSecurityEvent(ctx context.Context, eventType, description string, userID, clientIP string, fields map[string]interface{}) {
	logger := GetGlobalLogger().WithContext(ctx).
		WithField("event_type", eventType).
		WithField("description", description).
		WithField("user_id", userID).
		WithField("client_ip", clientIP).
		WithField("security_event", true)

	if fields != nil {
		logger = logger.WithFields(fields)
	}

	logger.Warn("security event occurred")
}

// ParseLogLevel parses log level from string
func ParseLogLevel(level string) zerolog.Level {
	switch strings.ToLower(level) {
	case "debug":
		return zerolog.DebugLevel
	case "info":
		return zerolog.InfoLevel
	case "warn", "warning":
		return zerolog.WarnLevel
	case "error":
		return zerolog.ErrorLevel
	case "fatal":
		return zerolog.FatalLevel
	case "panic":
		return zerolog.PanicLevel
	default:
		return zerolog.InfoLevel
	}
}

// getEnv gets an environment variable or returns a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
