package config

import (
	"fmt"
	"os"
	"strconv"
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

// Config holds all application configuration settings
type Config struct {
	// Server configuration
	Host            string
	Port            uint
	ShutdownTimeout *time.Duration
	Environment     Environment

	// Database configuration
	DbUser string
	DbPass string
	Dbhost string
	DbName string
	DbPort uint
	DbType DatabaseType

	// JWT configuration
	JWTSecret     string
	JWTExpiration time.Duration

	// Security configuration
	PasswordMinLength int
	MaxLoginAttempts  int
	AccountLockTime   time.Duration

	// Rate limiting configuration
	RateLimitEnabled  bool
	RateLimitRequests int
	RateLimitWindow   time.Duration
	RateLimitBurst    int

	// CORS configuration
	CORSAllowedOrigins []string
	CORSAllowedMethods []string
	CORSAllowedHeaders []string

	// Logging configuration
	LogLevel  string
	LogFormat string
	LogOutput string

	// Feature flags
	EnableMetrics     bool
	EnableTracing     bool
	EnableHealthCheck bool
	EnableSwaggerDocs bool
}

// LoadConfig loads configuration from environment variables
func LoadConfig() (*Config, error) {
	// Load .env file if it exists (ignore error in production)
	_ = godotenv.Load()

	config := &Config{
		// Server defaults
		Host:            getEnvString("SERVER_HOST", "localhost"),
		Port:            uint(getEnvInt("SERVER_PORT", 8080)),
		ShutdownTimeout: getDurationPtr(getEnvString("SHUTDOWN_TIMEOUT", "30s")),
		Environment:     Environment(getEnvString("ENV", "development")),

		// Database defaults
		DbUser: getEnvString("DB_USER", "osmait"),
		DbPass: getEnvString("DB_PASSWORD", "admin123"),
		Dbhost: getEnvString("DB_HOST", "localhost"),
		DbName: getEnvString("DB_NAME", "my_store"),
		DbPort: uint(getEnvInt("DB_PORT", 5432)),
		DbType: DatabaseType(getEnvString("DB_TYPE", "postgres")),

		// JWT configuration
		JWTSecret:     getEnvString("JWT_SECRET", generateDefaultSecret()),
		JWTExpiration: getDuration(getEnvString("JWT_EXPIRATION", "24h")),

		// Security configuration
		PasswordMinLength: getEnvInt("PASSWORD_MIN_LENGTH", 8),
		MaxLoginAttempts:  getEnvInt("MAX_LOGIN_ATTEMPTS", 5),
		AccountLockTime:   getDuration(getEnvString("ACCOUNT_LOCK_TIME", "15m")),

		// Rate limiting configuration
		RateLimitEnabled:  getEnvBool("RATE_LIMIT_ENABLED", true),
		RateLimitRequests: getEnvInt("RATE_LIMIT_REQUESTS", 100),
		RateLimitWindow:   getDuration(getEnvString("RATE_LIMIT_WINDOW", "1m")),
		RateLimitBurst:    getEnvInt("RATE_LIMIT_BURST", 50),

		// CORS configuration
		CORSAllowedOrigins: getEnvStringSlice("CORS_ALLOWED_ORIGINS", []string{"http://localhost:3000", "http://localhost:4321"}),
		CORSAllowedMethods: getEnvStringSlice("CORS_ALLOWED_METHODS", []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		CORSAllowedHeaders: getEnvStringSlice("CORS_ALLOWED_HEADERS", []string{"Origin", "Content-Type", "Authorization", "X-Requested-With"}),

		// Logging configuration
		LogLevel:  getEnvString("LOG_LEVEL", "info"),
		LogFormat: getEnvString("LOG_FORMAT", "json"),
		LogOutput: getEnvString("LOG_OUTPUT", "stdout"),

		// Feature flags
		EnableMetrics:     getEnvBool("ENABLE_METRICS", true),
		EnableTracing:     getEnvBool("ENABLE_TRACING", false),
		EnableHealthCheck: getEnvBool("ENABLE_HEALTH_CHECK", true),
		EnableSwaggerDocs: getEnvBool("ENABLE_SWAGGER_DOCS", false),
	}

	return config, config.validate()
}

// NewConfig creates a new configuration (deprecated, use LoadConfig instead)
func NewConfig(host string, Port, Dbport uint, shutdownTimeout *time.Duration, DbUser, DbPass, Dbhost, DbName string) *Config {
	return &Config{
		Host:            host,
		Port:            Port,
		ShutdownTimeout: shutdownTimeout,
		DbUser:          DbUser,
		Dbhost:          Dbhost,
		DbPass:          DbPass,
		DbPort:          Dbport,
		DbName:          DbName,
		DbType:          DatabaseTypePostgres, // default to postgres
	}
}

// NewConfigDb creates a new database config (deprecated, use LoadConfig instead)
func NewConfigDb(Dbport uint, DbUser, DbPass, Dbhost, DbName string) *Config {
	return &Config{
		DbUser: DbUser,
		DbPass: DbPass,
		DbPort: Dbport,
		DbName: DbName,
		DbType: DatabaseTypePostgres, // default to postgres
	}
}

// NewConfigSQLite creates a new config for SQLite (typically for testing)
func NewConfigSQLite(dbName string) *Config {
	return &Config{
		DbName: dbName,
		DbType: DatabaseTypeSQLite,
	}
}

// GetPostgresUrl returns the PostgreSQL connection string
func (c *Config) GetPostgresUrl() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable", c.DbUser, c.DbPass, c.Dbhost, c.DbPort, c.DbName)
}

// GetSQLiteUrl returns the SQLite connection string
func (c *Config) GetSQLiteUrl() string {
	// For in-memory SQLite
	if c.DbName == ":memory:" {
		return "sqlite3://:memory:"
	}
	return fmt.Sprintf("sqlite3://%s", c.DbName)
}

// GetDatabaseUrl returns the appropriate database connection string
func (c *Config) GetDatabaseUrl() string {
	switch c.DbType {
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
	return fmt.Sprintf("http://%s:%d", c.Host, c.Port)
}

// IsProduction returns true if the environment is production
func (c *Config) IsProduction() bool {
	return c.Environment == EnvironmentProduction
}

// IsDevelopment returns true if the environment is development
func (c *Config) IsDevelopment() bool {
	return c.Environment == EnvironmentDevelopment
}

// IsTest returns true if the environment is test
func (c *Config) IsTest() bool {
	return c.Environment == EnvironmentTest
}

// validate checks if the configuration is valid
func (c *Config) validate() error {
	if c.JWTSecret == "" {
		return fmt.Errorf("JWT_SECRET is required")
	}

	if len(c.JWTSecret) < 32 {
		return fmt.Errorf("JWT_SECRET must be at least 32 characters long")
	}

	if c.Port == 0 {
		return fmt.Errorf("SERVER_PORT must be greater than 0")
	}

	if c.JWTExpiration <= 0 {
		return fmt.Errorf("JWT_EXPIRATION must be greater than 0")
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

// getDuration returns the environment variable value as duration
func getDuration(value string) time.Duration {
	if duration, err := time.ParseDuration(value); err == nil {
		return duration
	}
	return 24 * time.Hour // default to 24 hours
}

// getDurationPtr returns a pointer to duration
func getDurationPtr(value string) *time.Duration {
	duration := getDuration(value)
	return &duration
}

// getEnvStringSlice returns the environment variable value as string slice
func getEnvStringSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		// Simple comma-separated parsing
		// For more complex parsing, consider using a proper CSV parser
		return []string{value}
	}
	return defaultValue
}

// generateDefaultSecret generates a default JWT secret for development
// In production, this should always be set via environment variable
func generateDefaultSecret() string {
	if os.Getenv("ENV") == "production" {
		// In production, we require an explicit JWT secret
		panic("JWT_SECRET environment variable is required in production")
	}
	return "development-secret-key-change-in-production-please-use-env-var"
}
