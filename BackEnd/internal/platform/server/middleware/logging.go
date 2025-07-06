package middleware

import (
	"bytes"
	"io"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// LoggingConfig holds configuration for logging middleware
type LoggingConfig struct {
	Level      string
	Format     string
	Output     string
	SkipPaths  []string
	LogHeaders bool
	LogBody    bool
}

// responseWriter wraps gin.ResponseWriter to capture response body
type responseWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w *responseWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// InitializeLogger configures the global logger with the given configuration
func InitializeLogger(cfg *config.Config) {
	// Set log level
	switch cfg.Logging.Level {
	case "debug":
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	case "info":
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	case "warn":
		zerolog.SetGlobalLevel(zerolog.WarnLevel)
	case "error":
		zerolog.SetGlobalLevel(zerolog.ErrorLevel)
	case "fatal":
		zerolog.SetGlobalLevel(zerolog.FatalLevel)
	case "panic":
		zerolog.SetGlobalLevel(zerolog.PanicLevel)
	default:
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}

	// Set log format
	if cfg.Logging.Format == "console" {
		log.Logger = log.Output(zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.RFC3339,
		})
	} else {
		// JSON format (default for production)
		log.Logger = zerolog.New(os.Stdout).With().
			Timestamp().
			Str("service", "gestor-presupuesto").
			Str("environment", string(cfg.Server.Environment)).
			Logger()
	}

	// Set caller information if enabled
	if cfg.Logging.Caller {
		log.Logger = log.Logger.With().Caller().Logger()
	}
}

// StructuredLogging creates a structured logging middleware
func StructuredLogging(cfg *config.Config) gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		// Custom log formatting is handled by zerolog, return empty string
		return ""
	})
}

// RequestLogging creates comprehensive request/response logging middleware
func RequestLogging(cfg *config.Config) gin.HandlerFunc {
	skipPaths := map[string]bool{
		"/health":  true,
		"/ping":    true,
		"/metrics": true,
	}

	return func(c *gin.Context) {
		// Skip logging for certain paths
		if skipPaths[c.Request.URL.Path] {
			c.Next()
			return
		}

		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method

		// Create request ID for tracing
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
			c.Header("X-Request-ID", requestID)
		}

		// Capture request body if configured
		var requestBody []byte
		if cfg.Logging.Caller && method != "GET" {
			requestBody, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		}

		// Wrap response writer to capture response body
		var responseBody *bytes.Buffer
		if cfg.Logging.Caller {
			responseBody = &bytes.Buffer{}
			c.Writer = &responseWriter{
				ResponseWriter: c.Writer,
				body:           responseBody,
			}
		}

		// Process request
		c.Next()

		// Calculate latency
		latency := time.Since(start)
		statusCode := c.Writer.Status()
		clientIP := c.ClientIP()
		userAgent := c.Request.UserAgent()

		// Get user ID if available
		userID, _ := c.Get("X-User-Id")

		// Create log event
		logEvent := log.Info()
		if statusCode >= 400 {
			logEvent = log.Error()
		} else if statusCode >= 300 {
			logEvent = log.Warn()
		}

		// Add common fields
		logEvent = logEvent.
			Str("request_id", requestID).
			Str("method", method).
			Str("path", path).
			Str("client_ip", clientIP).
			Int("status_code", statusCode).
			Dur("latency", latency).
			Str("user_agent", userAgent)

		// Add user ID if available
		if userID != nil {
			if userIDStr, ok := userID.(string); ok {
				logEvent = logEvent.Str("user_id", userIDStr)
			}
		}

		// Add request/response body in development
		if cfg.Logging.Caller {
			if len(requestBody) > 0 && len(requestBody) < 1024 { // Limit body size
				logEvent = logEvent.RawJSON("request_body", requestBody)
			}
			if responseBody != nil && responseBody.Len() < 1024 {
				logEvent = logEvent.Str("response_body", responseBody.String())
			}
		}

		// Add error information if present
		if len(c.Errors) > 0 {
			errorMsgs := make([]string, len(c.Errors))
			for i, err := range c.Errors {
				errorMsgs[i] = err.Error()
			}
			logEvent = logEvent.Strs("errors", errorMsgs)
		}

		// Log query parameters
		if len(c.Request.URL.RawQuery) > 0 {
			logEvent = logEvent.Str("query", c.Request.URL.RawQuery)
		}

		// Add performance indicators
		if latency > time.Second {
			logEvent = logEvent.Bool("slow_request", true)
		}

		logEvent.Msg("HTTP request processed")
	}
}

// ErrorLogging creates error-specific logging middleware
func ErrorLogging() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Log any errors that occurred during request processing
		for _, err := range c.Errors {
			log.Error().
				Err(err.Err).
				Int("type", int(err.Type)).
				Str("path", c.Request.URL.Path).
				Str("method", c.Request.Method).
				Str("client_ip", c.ClientIP()).
				Msg("Request error occurred")
		}
	}
}

// SecurityLogging creates security event logging middleware
func SecurityLogging() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Log authentication attempts
		if c.Request.URL.Path == "/login" {
			log.Info().
				Str("event", "authentication_attempt").
				Str("client_ip", c.ClientIP()).
				Str("user_agent", c.Request.UserAgent()).
				Msg("User authentication attempt")
		}

		c.Next()

		// Log authentication failures
		if c.Request.URL.Path == "/login" && c.Writer.Status() == 401 {
			log.Warn().
				Str("event", "authentication_failed").
				Str("client_ip", c.ClientIP()).
				Str("user_agent", c.Request.UserAgent()).
				Msg("User authentication failed")
		}

		// Log rate limit violations
		if c.Writer.Status() == 429 {
			log.Warn().
				Str("event", "rate_limit_exceeded").
				Str("client_ip", c.ClientIP()).
				Str("path", c.Request.URL.Path).
				Str("user_agent", c.Request.UserAgent()).
				Msg("Rate limit exceeded")
		}

		// Log suspicious activity
		if c.Writer.Status() >= 400 {
			userID, _ := c.Get("X-User-Id")
			logEvent := log.Warn().
				Str("event", "suspicious_activity").
				Str("client_ip", c.ClientIP()).
				Str("path", c.Request.URL.Path).
				Str("method", c.Request.Method).
				Int("status_code", c.Writer.Status())

			if userID != nil {
				if userIDStr, ok := userID.(string); ok {
					logEvent = logEvent.Str("user_id", userIDStr)
				}
			}

			logEvent.Msg("Suspicious activity detected")
		}
	}
}

// PerformanceLogging creates performance monitoring middleware
func PerformanceLogging(slowThreshold time.Duration) gin.HandlerFunc {
	if slowThreshold == 0 {
		slowThreshold = time.Second // Default to 1 second
	}

	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		latency := time.Since(start)

		// Log slow requests
		if latency > slowThreshold {
			log.Warn().
				Str("event", "slow_request").
				Str("path", c.Request.URL.Path).
				Str("method", c.Request.Method).
				Dur("latency", latency).
				Dur("threshold", slowThreshold).
				Str("client_ip", c.ClientIP()).
				Msg("Slow request detected")
		}

		// Log memory usage for very slow requests
		if latency > slowThreshold*5 {
			log.Error().
				Str("event", "very_slow_request").
				Str("path", c.Request.URL.Path).
				Str("method", c.Request.Method).
				Dur("latency", latency).
				Msg("Very slow request - potential performance issue")
		}
	}
}

// generateRequestID creates a simple request ID
func generateRequestID() string {
	return time.Now().Format("20060102150405") + "-" + randomString(8)
}

// randomString generates a random string of specified length
func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(b)
}

// CorrelationID middleware adds correlation ID to requests for distributed tracing
func CorrelationID() gin.HandlerFunc {
	return func(c *gin.Context) {
		correlationID := c.GetHeader("X-Correlation-ID")
		if correlationID == "" {
			correlationID = generateRequestID()
		}

		c.Header("X-Correlation-ID", correlationID)
		c.Set("correlation_id", correlationID)

		// Log correlation ID
		log.Debug().
			Str("correlation_id", correlationID).
			Msg("Request correlation ID set")

		c.Next()
	}
}
