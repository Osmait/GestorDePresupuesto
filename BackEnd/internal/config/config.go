package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// DatabaseType represents the type of database being used
type DatabaseType string

// Environment represents the application environment
type Environment string

const (
	DatabaseTypePostgres DatabaseType = "postgres"
	DatabaseTypeSQLite   DatabaseType = "sqlite"
)

const (
	EnvironmentDevelopment Environment = "development"
	EnvironmentTest        Environment = "test"
	EnvironmentProduction  Environment = "production"
)

// ServerConfig holds server-related configuration
type ServerConfig struct {
	Host            string        `json:"host" validate:"required"`
	Port            uint          `json:"port" validate:"required,min=1,max=65535"`
	ShutdownTimeout time.Duration `json:"shutdown_timeout" validate:"required"`
	Environment     Environment   `json:"environment" validate:"required,oneof=development test production"`
	ReadTimeout     time.Duration `json:"read_timeout"`
	WriteTimeout    time.Duration `json:"write_timeout"`
	IdleTimeout     time.Duration `json:"idle_timeout"`
	MaxHeaderBytes  int           `json:"max_header_bytes"`
}

// DatabaseConfig holds database-related configuration
type DatabaseConfig struct {
	User            string        `json:"user" validate:"required"`
	Password        string        `json:"-"` // Don't include password in JSON output
	Host            string        `json:"host" validate:"required"`
	Name            string        `json:"name" validate:"required"`
	Port            uint          `json:"port" validate:"required,min=1,max=65535"`
	Type            DatabaseType  `json:"type" validate:"required,oneof=postgres sqlite"`
	MaxOpenConns    int           `json:"max_open_conns" validate:"min=1"`
	MaxIdleConns    int           `json:"max_idle_conns" validate:"min=1"`
	ConnMaxLifetime time.Duration `json:"conn_max_lifetime"`
	ConnMaxIdleTime time.Duration `json:"conn_max_idle_time"`
	SSLMode         string        `json:"ssl_mode"`
}

// JWTConfig holds JWT-related configuration
type JWTConfig struct {
	Secret            string        `json:"-"` // Don't include secret in JSON output
	Expiration        time.Duration `json:"expiration" validate:"required"`
	RefreshExpiration time.Duration `json:"refresh_expiration"`
	Issuer            string        `json:"issuer"`
	Algorithm         string        `json:"algorithm"`
}

// SecurityConfig holds security-related configuration
type SecurityConfig struct {
	PasswordMinLength     int           `json:"password_min_length" validate:"min=8,max=128"`
	PasswordRequireUpper  bool          `json:"password_require_upper"`
	PasswordRequireLower  bool          `json:"password_require_lower"`
	PasswordRequireDigit  bool          `json:"password_require_digit"`
	PasswordRequireSymbol bool          `json:"password_require_symbol"`
	MaxLoginAttempts      int           `json:"max_login_attempts" validate:"min=1,max=100"`
	AccountLockTime       time.Duration `json:"account_lock_time" validate:"required"`
	SessionTimeout        time.Duration `json:"session_timeout"`
	EnableTLS             bool          `json:"enable_tls"`
	TLSCertFile           string        `json:"tls_cert_file"`
	TLSKeyFile            string        `json:"tls_key_file"`
}

// RateLimitConfig holds rate limiting configuration
type RateLimitConfig struct {
	Enabled     bool                      `json:"enabled"`
	Requests    int                       `json:"requests" validate:"min=1"`
	Window      time.Duration             `json:"window" validate:"required"`
	Burst       int                       `json:"burst" validate:"min=1"`
	IPWhitelist []string                  `json:"ip_whitelist"`
	UserBased   bool                      `json:"user_based"`
	Endpoints   []EndpointRateLimitConfig `json:"endpoints"`
}

// EndpointRateLimitConfig holds rate limiting configuration for a specific endpoint
type EndpointRateLimitConfig struct {
	Path     string        `json:"path" validate:"required"`
	Requests int           `json:"requests" validate:"min=1"`
	Window   time.Duration `json:"window" validate:"required"`
	Burst    int           `json:"burst" validate:"min=1"`
}

// CORSConfig holds CORS configuration
type CORSConfig struct {
	AllowedOrigins   []string `json:"allowed_origins" validate:"required"`
	AllowedMethods   []string `json:"allowed_methods" validate:"required"`
	AllowedHeaders   []string `json:"allowed_headers" validate:"required"`
	ExposedHeaders   []string `json:"exposed_headers"`
	AllowCredentials bool     `json:"allow_credentials"`
	MaxAge           int      `json:"max_age"`
}

// LoggingConfig holds logging configuration
type LoggingConfig struct {
	Level      string `json:"level" validate:"required,oneof=debug info warn error fatal panic"`
	Format     string `json:"format" validate:"required,oneof=json console"`
	Output     string `json:"output" validate:"required,oneof=stdout stderr file"`
	Filename   string `json:"filename"`
	MaxSize    int    `json:"max_size"` // MB
	MaxBackups int    `json:"max_backups"`
	MaxAge     int    `json:"max_age"` // Days
	Compress   bool   `json:"compress"`
	Caller     bool   `json:"caller"`
	StackTrace bool   `json:"stack_trace"`
}

// FeatureFlagsConfig holds feature flags configuration
type FeatureFlagsConfig struct {
	EnableMetrics     bool `json:"enable_metrics"`
	EnableTracing     bool `json:"enable_tracing"`
	EnableHealthCheck bool `json:"enable_health_check"`
	EnableSwaggerDocs bool `json:"enable_swagger_docs"`
	EnableProfiling   bool `json:"enable_profiling"`
	EnableDebugMode   bool `json:"enable_debug_mode"`
}

// OpenTelemetryConfig holds OpenTelemetry configuration
type OpenTelemetryConfig struct {
	ServiceName       string            `json:"service_name" validate:"required"`
	ServiceVersion    string            `json:"service_version" validate:"required"`
	Environment       string            `json:"environment" validate:"required"`
	SamplingRate      float64           `json:"sampling_rate" validate:"min=0,max=1"`
	OTLPEndpoint      string            `json:"otlp_endpoint"`
	JaegerEndpoint    string            `json:"jaeger_endpoint"`
	EnableStdout      bool              `json:"enable_stdout"`
	BatchTimeout      time.Duration     `json:"batch_timeout"`
	MaxBatchSize      int               `json:"max_batch_size" validate:"min=1"`
	MaxQueueSize      int               `json:"max_queue_size" validate:"min=1"`
	EnableCompression bool              `json:"enable_compression"`
	Headers           map[string]string `json:"headers"`
	Attributes        map[string]string `json:"attributes"`
}

// PrometheusConfig holds Prometheus configuration
type PrometheusConfig struct {
	Endpoint    string        `json:"endpoint"`
	MetricsPath string        `json:"metrics_path" validate:"required"`
	Namespace   string        `json:"namespace"`
	Subsystem   string        `json:"subsystem"`
	PushGateway string        `json:"push_gateway"`
	Interval    time.Duration `json:"interval"`
}

// MiddlewareConfig holds middleware configuration
type MiddlewareConfig struct {
	EnableLogging        bool `json:"enable_logging"`
	EnableTracing        bool `json:"enable_tracing"`
	EnableMetrics        bool `json:"enable_metrics"`
	EnableRecovery       bool `json:"enable_recovery"`
	EnableRateLimit      bool `json:"enable_rate_limit"`
	EnableCORS           bool `json:"enable_cors"`
	EnableCompression    bool `json:"enable_compression"`
	EnableAuthentication bool `json:"enable_authentication"`
	EnableValidation     bool `json:"enable_validation"`
}

// Config holds all application configuration settings
type Config struct {
	Server        ServerConfig        `json:"server"`
	Database      DatabaseConfig      `json:"database"`
	JWT           JWTConfig           `json:"jwt"`
	Security      SecurityConfig      `json:"security"`
	RateLimit     RateLimitConfig     `json:"rate_limit"`
	CORS          CORSConfig          `json:"cors"`
	Logging       LoggingConfig       `json:"logging"`
	FeatureFlags  FeatureFlagsConfig  `json:"feature_flags"`
	OpenTelemetry OpenTelemetryConfig `json:"opentelemetry"`
	Prometheus    PrometheusConfig    `json:"prometheus"`
	Middleware    MiddlewareConfig    `json:"middleware"`
}

// LoadConfig loads configuration from environment variables with comprehensive validation
func LoadConfig() (*Config, error) {
	// Load .env file if it exists (ignore error in production)
	if !isProduction() {
		_ = godotenv.Load()
	}

	config := &Config{
		Server: ServerConfig{
			Host:            getEnvString("SERVER_HOST", "localhost"),
			Port:            uint(getEnvInt("SERVER_PORT", 8080)),
			ShutdownTimeout: getDuration(getEnvString("SHUTDOWN_TIMEOUT", "30s")),
			Environment:     Environment(getEnvString("ENV", "development")),
			ReadTimeout:     getDuration(getEnvString("SERVER_READ_TIMEOUT", "30s")),
			WriteTimeout:    getDuration(getEnvString("SERVER_WRITE_TIMEOUT", "30s")),
			IdleTimeout:     getDuration(getEnvString("SERVER_IDLE_TIMEOUT", "60s")),
			MaxHeaderBytes:  getEnvInt("SERVER_MAX_HEADER_BYTES", 1<<20), // 1MB
		},

		Database: DatabaseConfig{
			User:            getEnvString("DB_USER", "osmait"),
			Password:        getEnvString("DB_PASSWORD", "admin123"),
			Host:            getEnvString("DB_HOST", "localhost"),
			Name:            getEnvString("DB_NAME", "my_store"),
			Port:            uint(getEnvInt("DB_PORT", 5432)),
			Type:            DatabaseType(getEnvString("DB_TYPE", "postgres")),
			MaxOpenConns:    getEnvInt("DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    getEnvInt("DB_MAX_IDLE_CONNS", 25),
			ConnMaxLifetime: getDuration(getEnvString("DB_CONN_MAX_LIFETIME", "5m")),
			ConnMaxIdleTime: getDuration(getEnvString("DB_CONN_MAX_IDLE_TIME", "5m")),
			SSLMode:         getEnvString("DB_SSL_MODE", "disable"),
		},

		JWT: JWTConfig{
			Secret:            getJWTSecret(),
			Expiration:        getDuration(getEnvString("JWT_EXPIRATION", "24h")),
			RefreshExpiration: getDuration(getEnvString("JWT_REFRESH_EXPIRATION", "168h")), // 7 days
			Issuer:            getEnvString("JWT_ISSUER", "gestor-de-presupuesto"),
			Algorithm:         getEnvString("JWT_ALGORITHM", "HS256"),
		},

		Security: SecurityConfig{
			PasswordMinLength:     getEnvInt("PASSWORD_MIN_LENGTH", 8),
			PasswordRequireUpper:  getEnvBool("PASSWORD_REQUIRE_UPPER", true),
			PasswordRequireLower:  getEnvBool("PASSWORD_REQUIRE_LOWER", true),
			PasswordRequireDigit:  getEnvBool("PASSWORD_REQUIRE_DIGIT", true),
			PasswordRequireSymbol: getEnvBool("PASSWORD_REQUIRE_SYMBOL", false),
			MaxLoginAttempts:      getEnvInt("MAX_LOGIN_ATTEMPTS", 5),
			AccountLockTime:       getDuration(getEnvString("ACCOUNT_LOCK_TIME", "15m")),
			SessionTimeout:        getDuration(getEnvString("SESSION_TIMEOUT", "30m")),
			EnableTLS:             getEnvBool("ENABLE_TLS", false),
			TLSCertFile:           getEnvString("TLS_CERT_FILE", ""),
			TLSKeyFile:            getEnvString("TLS_KEY_FILE", ""),
		},

		RateLimit: RateLimitConfig{
			Enabled:     getEnvBool("RATE_LIMIT_ENABLED", true),
			Requests:    getEnvInt("RATE_LIMIT_REQUESTS", 100),
			Window:      getDuration(getEnvString("RATE_LIMIT_WINDOW", "1m")),
			Burst:       getEnvInt("RATE_LIMIT_BURST", 50),
			IPWhitelist: getEnvStringSlice("RATE_LIMIT_IP_WHITELIST", []string{"127.0.0.1", "::1"}),
			UserBased:   getEnvBool("RATE_LIMIT_USER_BASED", false),
			Endpoints: []EndpointRateLimitConfig{
				{
					Path:     "/auth/demo",  // Strict limit for demo user creation
					Requests: 5,             // Only 5 requests
					Window:   1 * time.Hour, // Per hour
					Burst:    1,             // No burst allowed
				},
			},
		},

		CORS: CORSConfig{
			AllowedOrigins: getEnvStringSlice("CORS_ALLOWED_ORIGINS", []string{
				"http://localhost:3000",
				"http://localhost:4321",
				"http://localhost:8080",
			}),
			AllowedMethods: getEnvStringSlice("CORS_ALLOWED_METHODS", []string{
				"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH",
			}),
			AllowedHeaders: getEnvStringSlice("CORS_ALLOWED_HEADERS", []string{
				"Origin", "Content-Type", "Authorization", "X-Requested-With", "X-Trace-ID",
			}),
			ExposedHeaders:   getEnvStringSlice("CORS_EXPOSED_HEADERS", []string{"X-Trace-ID"}),
			AllowCredentials: getEnvBool("CORS_ALLOW_CREDENTIALS", true),
			MaxAge:           getEnvInt("CORS_MAX_AGE", 86400), // 24 hours
		},

		Logging: LoggingConfig{
			Level:      getEnvString("LOG_LEVEL", "info"),
			Format:     getEnvString("LOG_FORMAT", "json"),
			Output:     getEnvString("LOG_OUTPUT", "stdout"),
			Filename:   getEnvString("LOG_FILENAME", "app.log"),
			MaxSize:    getEnvInt("LOG_MAX_SIZE", 100), // MB
			MaxBackups: getEnvInt("LOG_MAX_BACKUPS", 3),
			MaxAge:     getEnvInt("LOG_MAX_AGE", 28), // days
			Compress:   getEnvBool("LOG_COMPRESS", true),
			Caller:     getEnvBool("LOG_CALLER", false),
			StackTrace: getEnvBool("LOG_STACK_TRACE", false),
		},

		FeatureFlags: FeatureFlagsConfig{
			EnableMetrics:     getEnvBool("ENABLE_METRICS", true),
			EnableTracing:     getEnvBool("ENABLE_TRACING", false),
			EnableHealthCheck: getEnvBool("ENABLE_HEALTH_CHECK", true),
			EnableSwaggerDocs: getEnvBool("ENABLE_SWAGGER_DOCS", false),
			EnableProfiling:   getEnvBool("ENABLE_PROFILING", false),
			EnableDebugMode:   getEnvBool("ENABLE_DEBUG_MODE", false),
		},

		OpenTelemetry: OpenTelemetryConfig{
			ServiceName:       getEnvString("OTEL_SERVICE_NAME", "gestor-de-presupuesto"),
			ServiceVersion:    getEnvString("OTEL_SERVICE_VERSION", "1.0.0"),
			Environment:       getEnvString("OTEL_ENVIRONMENT", "development"),
			SamplingRate:      getEnvFloat("OTEL_SAMPLING_RATE", 1.0),
			OTLPEndpoint:      getEnvString("OTEL_OTLP_ENDPOINT", "http://localhost:4317"),
			JaegerEndpoint:    getEnvString("OTEL_JAEGER_ENDPOINT", "http://localhost:14268"),
			EnableStdout:      getEnvBool("OTEL_ENABLE_STDOUT", true),
			BatchTimeout:      getDuration(getEnvString("OTEL_BATCH_TIMEOUT", "10s")),
			MaxBatchSize:      getEnvInt("OTEL_MAX_BATCH_SIZE", 512),
			MaxQueueSize:      getEnvInt("OTEL_MAX_QUEUE_SIZE", 1024),
			EnableCompression: getEnvBool("OTEL_ENABLE_COMPRESSION", true),
			Headers:           getEnvStringMap("OTEL_HEADERS", make(map[string]string)),
			Attributes:        getEnvStringMap("OTEL_ATTRIBUTES", make(map[string]string)),
		},

		Prometheus: PrometheusConfig{
			Endpoint:    getEnvString("PROMETHEUS_ENDPOINT", "http://localhost:9090"),
			MetricsPath: getEnvString("PROMETHEUS_METRICS_PATH", "/metrics"),
			Namespace:   getEnvString("PROMETHEUS_NAMESPACE", "gestor_presupuesto"),
			Subsystem:   getEnvString("PROMETHEUS_SUBSYSTEM", "api"),
			PushGateway: getEnvString("PROMETHEUS_PUSH_GATEWAY", ""),
			Interval:    getDuration(getEnvString("PROMETHEUS_INTERVAL", "15s")),
		},

		Middleware: MiddlewareConfig{
			EnableLogging:        getEnvBool("MIDDLEWARE_ENABLE_LOGGING", true),
			EnableTracing:        getEnvBool("MIDDLEWARE_ENABLE_TRACING", true),
			EnableMetrics:        getEnvBool("MIDDLEWARE_ENABLE_METRICS", true),
			EnableRecovery:       getEnvBool("MIDDLEWARE_ENABLE_RECOVERY", true),
			EnableRateLimit:      getEnvBool("MIDDLEWARE_ENABLE_RATE_LIMIT", true),
			EnableCORS:           getEnvBool("MIDDLEWARE_ENABLE_CORS", true),
			EnableCompression:    getEnvBool("MIDDLEWARE_ENABLE_COMPRESSION", false),
			EnableAuthentication: getEnvBool("MIDDLEWARE_ENABLE_AUTHENTICATION", true),
			EnableValidation:     getEnvBool("MIDDLEWARE_ENABLE_VALIDATION", true),
		},
	}

	// Validate configuration
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("configuration validation failed: %w", err)
	}

	return config, nil
}

// Validate performs comprehensive validation of the configuration
func (c *Config) Validate() error {
	validators := []func() error{
		c.validateServer,
		c.validateDatabase,
		c.validateJWT,
		c.validateSecurity,
		c.validateRateLimit,
		c.validateCORS,
		c.validateLogging,
		c.validateOpenTelemetry,
		c.validatePrometheus,
		c.validateEnvironmentSpecific,
	}

	for _, validator := range validators {
		if err := validator(); err != nil {
			return err
		}
	}

	return nil
}

// validateServer validates server configuration
func (c *Config) validateServer() error {
	if c.Server.Host == "" {
		return fmt.Errorf("server host cannot be empty")
	}

	if c.Server.Port == 0 || c.Server.Port > 65535 {
		return fmt.Errorf("server port must be between 1 and 65535")
	}

	if c.Server.ShutdownTimeout <= 0 {
		return fmt.Errorf("server shutdown timeout must be positive")
	}

	validEnvs := []Environment{EnvironmentDevelopment, EnvironmentTest, EnvironmentProduction}
	if !isValidEnum(string(c.Server.Environment), toStringSlice(validEnvs)) {
		return fmt.Errorf("invalid environment: %s", c.Server.Environment)
	}

	return nil
}

// validateDatabase validates database configuration
func (c *Config) validateDatabase() error {
	if c.Database.Type != DatabaseTypeSQLite {
		if c.Database.User == "" {
			return fmt.Errorf("database user cannot be empty")
		}
		if c.Database.Host == "" {
			return fmt.Errorf("database host cannot be empty")
		}
		if c.Database.Port == 0 || c.Database.Port > 65535 {
			return fmt.Errorf("database port must be between 1 and 65535")
		}
	}

	if c.Database.Name == "" {
		return fmt.Errorf("database name cannot be empty")
	}

	validTypes := []DatabaseType{DatabaseTypePostgres, DatabaseTypeSQLite}
	if !isValidEnum(string(c.Database.Type), toStringSlice(validTypes)) {
		return fmt.Errorf("invalid database type: %s", c.Database.Type)
	}

	if c.Database.MaxOpenConns <= 0 {
		return fmt.Errorf("database max open connections must be positive")
	}

	if c.Database.MaxIdleConns <= 0 {
		return fmt.Errorf("database max idle connections must be positive")
	}

	return nil
}

// validateJWT validates JWT configuration
func (c *Config) validateJWT() error {
	if c.JWT.Secret == "" {
		return fmt.Errorf("JWT secret cannot be empty")
	}

	if len(c.JWT.Secret) < 32 {
		return fmt.Errorf("JWT secret must be at least 32 characters long")
	}

	if c.JWT.Expiration <= 0 {
		return fmt.Errorf("JWT expiration must be positive")
	}

	if c.JWT.RefreshExpiration <= 0 {
		return fmt.Errorf("JWT refresh expiration must be positive")
	}

	if c.JWT.RefreshExpiration <= c.JWT.Expiration {
		return fmt.Errorf("JWT refresh expiration must be greater than access token expiration")
	}

	return nil
}

// validateSecurity validates security configuration
func (c *Config) validateSecurity() error {
	if c.Security.PasswordMinLength < 8 || c.Security.PasswordMinLength > 128 {
		return fmt.Errorf("password minimum length must be between 8 and 128")
	}

	if c.Security.MaxLoginAttempts <= 0 || c.Security.MaxLoginAttempts > 100 {
		return fmt.Errorf("max login attempts must be between 1 and 100")
	}

	if c.Security.AccountLockTime <= 0 {
		return fmt.Errorf("account lock time must be positive")
	}

	if c.Security.EnableTLS {
		if c.Security.TLSCertFile == "" {
			return fmt.Errorf("TLS cert file is required when TLS is enabled")
		}
		if c.Security.TLSKeyFile == "" {
			return fmt.Errorf("TLS key file is required when TLS is enabled")
		}
	}

	return nil
}

// validateRateLimit validates rate limiting configuration
func (c *Config) validateRateLimit() error {
	if c.RateLimit.Enabled {
		if c.RateLimit.Requests <= 0 {
			return fmt.Errorf("rate limit requests must be positive")
		}
		if c.RateLimit.Window <= 0 {
			return fmt.Errorf("rate limit window must be positive")
		}
		if c.RateLimit.Burst <= 0 {
			return fmt.Errorf("rate limit burst must be positive")
		}
	}

	// Validate IP whitelist
	for _, ip := range c.RateLimit.IPWhitelist {
		if !isValidIP(ip) {
			return fmt.Errorf("invalid IP in whitelist: %s", ip)
		}
	}

	return nil
}

// validateCORS validates CORS configuration
func (c *Config) validateCORS() error {
	if len(c.CORS.AllowedOrigins) == 0 {
		return fmt.Errorf("CORS allowed origins cannot be empty")
	}

	// Validate origins are valid URLs or wildcards
	for _, origin := range c.CORS.AllowedOrigins {
		if origin != "*" && !isValidURL(origin) {
			return fmt.Errorf("invalid CORS origin: %s", origin)
		}
	}

	if len(c.CORS.AllowedMethods) == 0 {
		return fmt.Errorf("CORS allowed methods cannot be empty")
	}

	if len(c.CORS.AllowedHeaders) == 0 {
		return fmt.Errorf("CORS allowed headers cannot be empty")
	}

	return nil
}

// validateLogging validates logging configuration
func (c *Config) validateLogging() error {
	validLevels := []string{"debug", "info", "warn", "error", "fatal", "panic"}
	if !isValidEnum(c.Logging.Level, validLevels) {
		return fmt.Errorf("invalid log level: %s", c.Logging.Level)
	}

	validFormats := []string{"json", "console"}
	if !isValidEnum(c.Logging.Format, validFormats) {
		return fmt.Errorf("invalid log format: %s", c.Logging.Format)
	}

	validOutputs := []string{"stdout", "stderr", "file"}
	if !isValidEnum(c.Logging.Output, validOutputs) {
		return fmt.Errorf("invalid log output: %s", c.Logging.Output)
	}

	if c.Logging.Output == "file" && c.Logging.Filename == "" {
		return fmt.Errorf("log filename is required when output is file")
	}

	return nil
}

// validateOpenTelemetry validates OpenTelemetry configuration
func (c *Config) validateOpenTelemetry() error {
	if c.OpenTelemetry.ServiceName == "" {
		return fmt.Errorf("OpenTelemetry service name cannot be empty")
	}

	if c.OpenTelemetry.ServiceVersion == "" {
		return fmt.Errorf("OpenTelemetry service version cannot be empty")
	}

	if c.OpenTelemetry.SamplingRate < 0 || c.OpenTelemetry.SamplingRate > 1 {
		return fmt.Errorf("OpenTelemetry sampling rate must be between 0 and 1")
	}

	if c.OpenTelemetry.MaxBatchSize <= 0 {
		return fmt.Errorf("OpenTelemetry max batch size must be positive")
	}

	if c.OpenTelemetry.MaxQueueSize <= 0 {
		return fmt.Errorf("OpenTelemetry max queue size must be positive")
	}

	// Validate endpoints if provided
	if c.OpenTelemetry.OTLPEndpoint != "" && !isValidURL(c.OpenTelemetry.OTLPEndpoint) {
		return fmt.Errorf("invalid OTLP endpoint: %s", c.OpenTelemetry.OTLPEndpoint)
	}

	if c.OpenTelemetry.JaegerEndpoint != "" && !isValidURL(c.OpenTelemetry.JaegerEndpoint) {
		return fmt.Errorf("invalid Jaeger endpoint: %s", c.OpenTelemetry.JaegerEndpoint)
	}

	return nil
}

// validatePrometheus validates Prometheus configuration
func (c *Config) validatePrometheus() error {
	if c.Prometheus.MetricsPath == "" {
		return fmt.Errorf("prometheus metrics path cannot be empty")
	}

	if !strings.HasPrefix(c.Prometheus.MetricsPath, "/") {
		return fmt.Errorf("prometheus metrics path must start with /")
	}

	if c.Prometheus.Endpoint != "" && !isValidURL(c.Prometheus.Endpoint) {
		return fmt.Errorf("invalid Prometheus endpoint: %s", c.Prometheus.Endpoint)
	}

	if c.Prometheus.PushGateway != "" && !isValidURL(c.Prometheus.PushGateway) {
		return fmt.Errorf("invalid Prometheus push gateway: %s", c.Prometheus.PushGateway)
	}

	return nil
}

// validateEnvironmentSpecific validates environment-specific requirements
func (c *Config) validateEnvironmentSpecific() error {
	if c.Server.Environment == EnvironmentProduction {
		if c.JWT.Secret == "development-secret-key-change-in-production-please-use-env-var" {
			return fmt.Errorf("default JWT secret cannot be used in production")
		}

		// if !c.Security.EnableTLS {
		// 	return fmt.Errorf("TLS must be enabled in production")
		// }

		if c.FeatureFlags.EnableDebugMode {
			return fmt.Errorf("debug mode cannot be enabled in production")
		}

		if c.Logging.Level == "debug" {
			return fmt.Errorf("debug log level should not be used in production")
		}
	}

	return nil
}

// NewConfig creates a new configuration (deprecated, use LoadConfig instead)
func NewConfig(host string, Port, Dbport uint, shutdownTimeout *time.Duration, DbUser, DbPass, Dbhost, DbName string) *Config {
	return &Config{
		Server: ServerConfig{
			Host:            host,
			Port:            Port,
			ShutdownTimeout: *shutdownTimeout,
		},
		Database: DatabaseConfig{
			User:     DbUser,
			Host:     Dbhost,
			Password: DbPass,
			Port:     Dbport,
			Name:     DbName,
			Type:     DatabaseTypePostgres,
		},
	}
}

// NewConfigDb creates a new database config (deprecated, use LoadConfig instead)
func NewConfigDb(Dbport uint, DbUser, DbPass, Dbhost, DbName string) *Config {
	return &Config{
		Database: DatabaseConfig{
			User:     DbUser,
			Password: DbPass,
			Port:     Dbport,
			Name:     DbName,
			Type:     DatabaseTypePostgres,
		},
	}
}

// NewConfigSQLite creates a new config for SQLite (typically for testing)
func NewConfigSQLite(dbName string) *Config {
	return &Config{
		Database: DatabaseConfig{
			Name: dbName,
			Type: DatabaseTypeSQLite,
		},
	}
}

// GetPostgresUrl returns the PostgreSQL connection string
func (c *Config) GetPostgresUrl() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		c.Database.User, c.Database.Password, c.Database.Host, c.Database.Port, c.Database.Name, c.Database.SSLMode)
}

// GetSQLiteUrl returns the SQLite connection string
func (c *Config) GetSQLiteUrl() string {
	// For in-memory SQLite
	if c.Database.Name == ":memory:" {
		return "sqlite3://:memory:"
	}
	return fmt.Sprintf("sqlite3://%s", c.Database.Name)
}

// GetDatabaseUrl returns the appropriate database connection string
func (c *Config) GetDatabaseUrl() string {
	switch c.Database.Type {
	case DatabaseTypeSQLite:
		return c.GetSQLiteUrl()
	case DatabaseTypePostgres:
		return c.GetPostgresUrl()
	default:
		return c.GetPostgresUrl()
	}
}

// GetServerUrl returns the server URL
func (c *Config) GetServerUrl() string {
	protocol := "http"
	if c.Security.EnableTLS {
		protocol = "https"
	}
	return fmt.Sprintf("%s://%s:%d", protocol, c.Server.Host, c.Server.Port)
}

// IsProduction returns true if the environment is production
func (c *Config) IsProduction() bool {
	return c.Server.Environment == EnvironmentProduction
}

// IsDevelopment returns true if the environment is development
func (c *Config) IsDevelopment() bool {
	return c.Server.Environment == EnvironmentDevelopment
}

// IsTest returns true if the environment is test
func (c *Config) IsTest() bool {
	return c.Server.Environment == EnvironmentTest
}

// ValidatePassword validates a password against the configured security rules
func (c *Config) ValidatePassword(password string) error {
	if len(password) < c.Security.PasswordMinLength {
		return fmt.Errorf("password must be at least %d characters long", c.Security.PasswordMinLength)
	}

	if c.Security.PasswordRequireUpper && !regexp.MustCompile(`[A-Z]`).MatchString(password) {
		return fmt.Errorf("password must contain at least one uppercase letter")
	}

	if c.Security.PasswordRequireLower && !regexp.MustCompile(`[a-z]`).MatchString(password) {
		return fmt.Errorf("password must contain at least one lowercase letter")
	}

	if c.Security.PasswordRequireDigit && !regexp.MustCompile(`[0-9]`).MatchString(password) {
		return fmt.Errorf("password must contain at least one digit")
	}

	if c.Security.PasswordRequireSymbol && !regexp.MustCompile(`[^a-zA-Z0-9]`).MatchString(password) {
		return fmt.Errorf("password must contain at least one special character")
	}

	return nil
}

// Helper functions for environment variable parsing

// getEnvString returns the environment variable value or the default value
func getEnvString(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvInt returns the environment variable value as int or the default value
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// getEnvBool returns the environment variable value as bool or the default value
func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

// getEnvFloat returns the environment variable value as float64 or the default value
func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
			return floatValue
		}
	}
	return defaultValue
}

// getDuration returns the environment variable value as duration
// getDuration returns the environment variable value as duration
func getDuration(value string) time.Duration {
	if duration, err := time.ParseDuration(value); err == nil {
		return duration
	}
	return 24 * time.Hour // default to 24 hours
}

// getEnvStringSlice returns the environment variable value as string slice
func getEnvStringSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		return strings.Split(value, ",")
	}
	return defaultValue
}

// getEnvStringMap returns the environment variable value as string map
func getEnvStringMap(key string, defaultValue map[string]string) map[string]string {
	if value := os.Getenv(key); value != "" {
		result := make(map[string]string)
		pairs := strings.Split(value, ",")
		for _, pair := range pairs {
			if kv := strings.SplitN(pair, "=", 2); len(kv) == 2 {
				result[strings.TrimSpace(kv[0])] = strings.TrimSpace(kv[1])
			}
		}
		return result
	}
	return defaultValue
}

// getJWTSecret returns JWT secret with environment-specific handling
func getJWTSecret() string {
	if secret := os.Getenv("JWT_SECRET"); secret != "" {
		return secret
	}

	if isProduction() {
		panic("JWT_SECRET environment variable is required in production")
	}

	// Generate a random secret for non-production environments
	if secret := generateSecureSecret(); secret != "" {
		return secret
	}

	// Fallback to development secret
	return "development-secret-key-change-in-production-please-use-env-var"
}

// generateSecureSecret generates a cryptographically secure secret
func generateSecureSecret() string {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return ""
	}
	return hex.EncodeToString(bytes)
}

// isProduction checks if running in production environment
func isProduction() bool {
	return os.Getenv("ENV") == "production" || os.Getenv("GO_ENV") == "production"
}

// Validation helper functions

// isValidEnum checks if value is in allowed values
func isValidEnum(value string, allowed []string) bool {
	for _, v := range allowed {
		if v == value {
			return true
		}
	}
	return false
}

// isValidURL checks if string is a valid URL
func isValidURL(str string) bool {
	if str == "" {
		return false
	}
	u, err := url.Parse(str)
	return err == nil && u.Scheme != "" && u.Host != ""
}

// isValidIP checks if string is a valid IP address
func isValidIP(ip string) bool {
	// Handle common cases
	if ip == "localhost" || ip == "::1" {
		return true
	}

	// IPv4 validation
	ipv4Regex := regexp.MustCompile(`^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$`)
	if ipv4Regex.MatchString(ip) {
		return true
	}

	// IPv6 validation (basic)
	ipv6Regex := regexp.MustCompile(`^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$`)
	return ipv6Regex.MatchString(ip)
}

// toStringSlice converts any slice to string slice for validation
func toStringSlice[T ~string](slice []T) []string {
	result := make([]string, len(slice))
	for i, v := range slice {
		result[i] = string(v)
	}
	return result
}
