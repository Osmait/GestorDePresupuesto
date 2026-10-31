package config

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"

	"github.com/osmait/gestorDePresupuesto/internal/version"
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
	// Timezone is the IANA app time zone (APP_TIMEZONE): calendar days and
	// months (transaction filters, budgets, analytics, "today", recurring
	// scheduling) are cut in it. It must match the database's app_timezone()
	// (migration 000062); a mismatch is logged at startup.
	Timezone string `json:"timezone"`
	// ReadHeaderTimeout bounds how long the server waits for request headers
	// (slowloris protection).
	ReadHeaderTimeout time.Duration `json:"read_header_timeout"`
	// TrustedProxies is the list of proxy IPs/CIDRs whose X-Forwarded-For /
	// X-Real-IP headers are trusted when resolving the client IP. Empty (the
	// default) trusts nobody: the TCP peer address is used as the client IP.
	TrustedProxies []string `json:"trusted_proxies"`
	// TrustedPlatformHeader, when set, names a header injected by the hosting
	// platform's edge proxy (e.g. "X-Real-IP" on Railway, "CF-Connecting-IP"
	// on Cloudflare) that is trusted as the client IP unconditionally. Only
	// set it when the app is reachable exclusively through that proxy.
	TrustedPlatformHeader string `json:"trusted_platform_header"`
	// ProxySharedSecret (PROXY_SHARED_SECRET) authenticates the frontend
	// server, which calls the backend on behalf of browsers: requests carrying
	// it in X-Proxy-Secret have their X-Client-IP trusted as the client IP.
	// Never serialized or logged.
	ProxySharedSecret string `json:"-"`
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
	// TxAcquireTimeout bounds how long an authenticated request waits for a
	// pooled connection to open its RLS transaction (DB_TX_ACQUIRE_TIMEOUT).
	// When the pool stays exhausted that long the request fails fast with
	// 503 instead of queueing indefinitely. 0 disables the bound.
	TxAcquireTimeout time.Duration `json:"tx_acquire_timeout"`
	SSLMode          string        `json:"ssl_mode"`
	// StatementTimeout is the transaction-local statement_timeout of every
	// per-user transaction (DB_STATEMENT_TIMEOUT). 0 disables it.
	StatementTimeout time.Duration `json:"statement_timeout"`
	// IdleInTxTimeout is the transaction-local
	// idle_in_transaction_session_timeout (DB_IDLE_IN_TX_TIMEOUT). 0
	// disables it.
	IdleInTxTimeout time.Duration `json:"idle_in_tx_timeout"`
	// RequestTimeout is the deadline of an authenticated request holding the
	// RLS transaction (DB_REQUEST_TIMEOUT). 0 disables it.
	RequestTimeout time.Duration `json:"request_timeout"`
}

// CacheConfig holds the TTLs of the small in-process caches that keep
// per-request middleware off the database. A TTL of 0 disables the cache.
type CacheConfig struct {
	// AuthUserTTL caches the auth middleware's "user exists and is active"
	// lookup (AUTH_USER_CACHE_TTL). Role changes and deactivations made
	// through this instance invalidate it immediately; other instances
	// converge within the TTL, so keep it short.
	AuthUserTTL time.Duration `json:"auth_user_ttl"`
	// FeatureFlagTTL caches feature-flag evaluations used by route gates
	// (FEATURE_FLAG_CACHE_TTL). Admin updates invalidate it on this instance.
	FeatureFlagTTL time.Duration `json:"feature_flag_ttl"`
}

// JWTConfig holds JWT-related configuration
type JWTConfig struct {
	Secret            string        `json:"-"` // Don't include secret in JSON output
	Expiration        time.Duration `json:"expiration" validate:"required"`
	RefreshExpiration time.Duration `json:"refresh_expiration"`
	Issuer            string        `json:"issuer"`
	Audience          string        `json:"audience"`
	Algorithm         string        `json:"algorithm"`
	// RefreshReuseGrace is the window after a refresh token was rotated during
	// which presenting it again is rejected (401) WITHOUT revoking every
	// session of the user. It absorbs legitimate parallel refreshes (two tabs,
	// app + widget). Reuse after the window is treated as token theft.
	RefreshReuseGrace time.Duration `json:"refresh_reuse_grace"`
	// RefreshSessionMaxAge is the absolute lifetime of a refresh session
	// (REFRESH_SESSION_MAX_AGE, default 30 days): rotated refresh tokens
	// inherit the session start and are not rotated past it, so the user
	// signs in again. It also caps the MCP OAuth (Claude connector) grants.
	// 0 disables the cap.
	RefreshSessionMaxAge time.Duration `json:"refresh_session_max_age"`
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
	// AccessLog controls the one-line-per-request access log: "all" logs
	// every request (sampled by AccessLogSampleRate), "errors" only 5xx and
	// slow requests, "off" disables it (ACCESS_LOG).
	AccessLog string `json:"access_log" validate:"oneof=all errors off"`
	// AccessLogSampleRate is the fraction (0..1) of fast, successful requests
	// logged in "all" mode; errors and slow requests are always logged.
	AccessLogSampleRate float64 `json:"access_log_sample_rate"`
	// SlowRequestThreshold marks a request as slow in the access log.
	SlowRequestThreshold time.Duration `json:"slow_request_threshold"`
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
	Headers           map[string]string `json:"-"` // may carry API keys
	Attributes        map[string]string `json:"attributes"`
	// OTLPProtocol is "grpc" or "http/protobuf" (OTEL_EXPORTER_OTLP_PROTOCOL).
	OTLPProtocol string `json:"otlp_protocol"`
}

// MetricsConfig controls the OpenTelemetry MeterProvider and the Prometheus
// /metrics endpoint. Everything is off unless METRICS_ENABLED=true.
type MetricsConfig struct {
	Enabled bool `json:"enabled"`
	// Exporters is any of "prometheus" (pull, /metrics) and "otlp" (push to
	// OTEL_EXPORTER_OTLP_ENDPOINT) (METRICS_EXPORTER, comma separated).
	Exporters []string `json:"exporters"`
	// Token is the bearer token required to scrape /metrics on the public
	// port (METRICS_TOKEN). Without it /metrics is not mounted there.
	Token string `json:"-"`
	// Port, when non-zero, serves /metrics on a separate listener (e.g. the
	// Railway private network) instead of the public API port (METRICS_PORT).
	Port uint `json:"port"`
	// Host is the interface the METRICS_PORT listener binds to (METRICS_HOST,
	// default SERVER_HOST). E.g. "::" for Railway's private network or the
	// Docker bridge IP for a local Prometheus container.
	Host string `json:"host"`
	// ExportInterval is the OTLP push interval (METRICS_EXPORT_INTERVAL).
	ExportInterval time.Duration `json:"export_interval"`
}

// HasExporter reports whether the named metrics exporter is configured.
func (m MetricsConfig) HasExporter(name string) bool {
	for _, e := range m.Exporters {
		if strings.EqualFold(strings.TrimSpace(e), name) {
			return true
		}
	}
	return false
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

// AdminConfig holds admin seeding configuration
type AdminConfig struct {
	Email    string `json:"-"` // Don't expose in JSON
	Password string `json:"-"` // Don't expose in JSON
	Name     string `json:"name"`
	LastName string `json:"last_name"`
	Enabled  bool   `json:"enabled"`
}

// AIConfig holds AI service configuration
type AIConfig struct {
	Provider       string        `json:"provider"`
	Model          string        `json:"model"`
	GeminiAPIKey   string        `json:"-"`
	MaxRetries     int           `json:"max_retries"`
	RetryBackoff   time.Duration `json:"retry_backoff"`
	RequestTimeout time.Duration `json:"request_timeout"`
	MaxFileSize    int64         `json:"max_file_size"`
	MaxFiles       int           `json:"max_files"`
	EnableMetrics  bool          `json:"enable_metrics"`
	// Per-user limits on /ai/* (each call goes to the paid provider).
	RequestsPerMinute int `json:"requests_per_minute"`
	RequestsPerDay    int `json:"requests_per_day"`
	MaxInFlight       int `json:"max_in_flight"`
	// MaxConcurrentCalls caps provider calls in flight across all users
	// (AI_MAX_CONCURRENT_CALLS); beyond it requests fail fast with 503.
	// <= 0 disables the cap.
	MaxConcurrentCalls int `json:"max_concurrent_calls"`
}

// MCPConfig holds Model Context Protocol server configuration
type MCPConfig struct {
	Enabled       bool   `json:"enabled"`
	ServerName    string `json:"server_name"`
	ServerVersion string `json:"server_version"`
	BaseURL       string `json:"base_url"`
	// AppURL is the web app linked from the OAuth login page (MCP_APP_URL).
	AppURL string `json:"app_url"`
}

// WebAuthnConfig holds passkey / WebAuthn relying party configuration.
type WebAuthnConfig struct {
	RPDisplayName string        `json:"rp_display_name"`
	RPID          string        `json:"rp_id"`
	RPOrigins     []string      `json:"rp_origins"`
	ChallengeTTL  time.Duration `json:"challenge_ttl"`
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
	Metrics       MetricsConfig       `json:"metrics"`
	Prometheus    PrometheusConfig    `json:"prometheus"`
	Middleware    MiddlewareConfig    `json:"middleware"`
	Admin         AdminConfig         `json:"admin"`
	AI            AIConfig            `json:"ai"`
	MCP           MCPConfig           `json:"mcp"`
	WebAuthn      WebAuthnConfig      `json:"webauthn"`
	Cache         CacheConfig         `json:"cache"`
}

// LoadConfig loads configuration from environment variables with comprehensive validation
func LoadConfig() (*Config, error) {
	// Load .env file if it exists (ignore error if file not present).
	// godotenv.Load — unlike Overload — does NOT override env vars that are
	// already set in the process environment. This allows callers (CI, E2E
	// test runners, Docker) to inject values via process env and have them
	// take precedence over any local .env file.
	if !isProduction() {
		_ = godotenv.Load()
	}

	config := &Config{
		Server: ServerConfig{
			Host:            getEnvString("SERVER_HOST", "localhost"),
			Port:            uint(getEnvInt("SERVER_PORT", 8080)),
			ShutdownTimeout: getDuration(getEnvString("SHUTDOWN_TIMEOUT", "30s")),
			Environment:     Environment(getEnvString("ENV", "development")),
			// ReadTimeout covers headers + body (AI uploads can be several MB).
			ReadTimeout: getDuration(getEnvString("SERVER_READ_TIMEOUT", "60s")),
			// WriteTimeout must exceed the slowest non-streaming handler (AI
			// extraction with retries). Streaming endpoints (SSE) clear their
			// own deadlines.
			WriteTimeout:          getDuration(getEnvString("SERVER_WRITE_TIMEOUT", "120s")),
			IdleTimeout:           getDuration(getEnvString("SERVER_IDLE_TIMEOUT", "120s")),
			ReadHeaderTimeout:     getDuration(getEnvString("SERVER_READ_HEADER_TIMEOUT", "10s")),
			MaxHeaderBytes:        getEnvInt("SERVER_MAX_HEADER_BYTES", 1<<20), // 1MB
			TrustedProxies:        getEnvStringSlice("TRUSTED_PROXIES", nil),
			TrustedPlatformHeader: strings.TrimSpace(getEnvString("TRUSTED_PLATFORM_HEADER", "")),
			ProxySharedSecret:     strings.TrimSpace(getEnvString("PROXY_SHARED_SECRET", "")),
			Timezone:              getEnvString("APP_TIMEZONE", "America/Santo_Domingo"),
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
			// Each authenticated request holds exactly one connection for its
			// RLS transaction; this bounds the wait for it.
			TxAcquireTimeout: getEnvDuration("DB_TX_ACQUIRE_TIMEOUT", 5*time.Second),
			SSLMode:          getEnvString("DB_SSL_MODE", "disable"),
			// Bound how long a request can hold its pooled connection. The
			// AI routes that call the provider run outside the request
			// transaction, so these can stay short.
			StatementTimeout: getEnvDuration("DB_STATEMENT_TIMEOUT", 15*time.Second),
			IdleInTxTimeout:  getEnvDuration("DB_IDLE_IN_TX_TIMEOUT", 30*time.Second),
			RequestTimeout:   getEnvDuration("DB_REQUEST_TIMEOUT", 60*time.Second),
		},

		Cache: CacheConfig{
			AuthUserTTL:    getEnvDuration("AUTH_USER_CACHE_TTL", 15*time.Second),
			FeatureFlagTTL: getEnvDuration("FEATURE_FLAG_CACHE_TTL", 30*time.Second),
		},

		JWT: JWTConfig{
			Secret: getJWTSecret(),
			// Access tokens cannot be revoked (logout only revokes refresh
			// tokens), so they are short-lived; clients refresh them.
			Expiration:        getDuration(getEnvString("JWT_EXPIRATION", "15m")),
			RefreshExpiration: getDuration(getEnvString("JWT_REFRESH_EXPIRATION", "168h")), // 7 days
			Issuer:            getEnvString("JWT_ISSUER", "gestor-de-presupuesto"),
			Audience:          getEnvString("JWT_AUDIENCE", "gestor-de-presupuesto-api"),
			Algorithm:         getEnvString("JWT_ALGORITHM", "HS256"),
			RefreshReuseGrace: getDuration(getEnvString("JWT_REFRESH_REUSE_GRACE", "30s")),
			// 720h = 30 days.
			RefreshSessionMaxAge: getEnvDuration("REFRESH_SESSION_MAX_AGE", 720*time.Hour),
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
				"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With",
				"X-Trace-ID", "X-Request-ID", "Last-Event-ID", "Cache-Control",
			}),
			ExposedHeaders: getEnvStringSlice("CORS_EXPOSED_HEADERS", []string{
				"X-Trace-ID", "X-Request-ID", "Retry-After",
				"X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Window",
			}),
			// Clients authenticate with Bearer tokens, not cookies, so
			// credentialed CORS requests are not needed.
			AllowCredentials: getEnvBool("CORS_ALLOW_CREDENTIALS", false),
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
			// Development logs every request; other environments only log
			// 5xx and slow requests unless ACCESS_LOG=all.
			AccessLog:            strings.ToLower(getEnvString("ACCESS_LOG", defaultAccessLogMode())),
			AccessLogSampleRate:  getEnvFloat("ACCESS_LOG_SAMPLE_RATE", 1.0),
			SlowRequestThreshold: getDuration(getEnvString("ACCESS_LOG_SLOW_THRESHOLD", "1s")),
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
			ServiceName:    getEnvString("OTEL_SERVICE_NAME", "gestor-de-presupuesto"),
			ServiceVersion: getEnvString("OTEL_SERVICE_VERSION", version.Number),
			Environment:    getEnvString("OTEL_ENVIRONMENT", getEnvString("ENV", "development")),
			SamplingRate:   getEnvFloat("OTEL_SAMPLING_RATE", 1.0),
			// The standard OTEL_EXPORTER_OTLP_* variables win over the legacy
			// OTEL_OTLP_ENDPOINT / OTEL_HEADERS names.
			OTLPEndpoint:      getEnvString("OTEL_EXPORTER_OTLP_ENDPOINT", getEnvString("OTEL_OTLP_ENDPOINT", "http://localhost:4317")),
			OTLPProtocol:      strings.ToLower(getEnvString("OTEL_EXPORTER_OTLP_PROTOCOL", "grpc")),
			JaegerEndpoint:    getEnvString("OTEL_JAEGER_ENDPOINT", "http://localhost:14268"),
			EnableStdout:      getEnvBool("OTEL_ENABLE_STDOUT", true),
			BatchTimeout:      getDuration(getEnvString("OTEL_BATCH_TIMEOUT", "10s")),
			MaxBatchSize:      getEnvInt("OTEL_MAX_BATCH_SIZE", 512),
			MaxQueueSize:      getEnvInt("OTEL_MAX_QUEUE_SIZE", 1024),
			EnableCompression: getEnvBool("OTEL_ENABLE_COMPRESSION", true),
			Headers:           otlpHeaders(),
			Attributes:        getEnvStringMap("OTEL_ATTRIBUTES", make(map[string]string)),
		},

		Metrics: MetricsConfig{
			Enabled:        getEnvBool("METRICS_ENABLED", false),
			Exporters:      getEnvStringSlice("METRICS_EXPORTER", []string{"prometheus"}),
			Token:          getEnvString("METRICS_TOKEN", ""),
			Port:           uint(getEnvInt("METRICS_PORT", 0)),
			Host:           getEnvString("METRICS_HOST", ""),
			ExportInterval: getDuration(getEnvString("METRICS_EXPORT_INTERVAL", "30s")),
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

		Admin: AdminConfig{
			Email:    getEnvString("ADMIN_EMAIL", ""),
			Password: getEnvString("ADMIN_PASSWORD", ""),
			Name:     getEnvString("ADMIN_NAME", "Admin"),
			LastName: getEnvString("ADMIN_LASTNAME", "System"),
			Enabled:  getEnvBool("ADMIN_SEED_ENABLED", true),
		},

		AI: AIConfig{
			Provider:       getEnvString("AI_PROVIDER", "gemini"),
			Model:          getEnvString("AI_MODEL", "gemini-2.0-flash-exp"),
			GeminiAPIKey:   getEnvString("GEMINI_API_KEY", ""),
			MaxRetries:     getEnvInt("AI_MAX_RETRIES", 2),
			RetryBackoff:   getDuration(getEnvString("AI_RETRY_BACKOFF", "1s")),
			RequestTimeout: getDuration(getEnvString("AI_REQUEST_TIMEOUT", "30s")),
			MaxFileSize:    int64(getEnvInt("AI_MAX_FILE_SIZE_MB", 10)) * 1024 * 1024,
			MaxFiles:       getEnvInt("AI_MAX_FILES", 5),
			EnableMetrics:  getEnvBool("AI_ENABLE_METRICS", true),

			RequestsPerMinute: getEnvInt("AI_REQUESTS_PER_MINUTE", 10),
			RequestsPerDay:    getEnvInt("AI_REQUESTS_PER_DAY", 200),
			MaxInFlight:       getEnvInt("AI_MAX_IN_FLIGHT", 2),

			MaxConcurrentCalls: getEnvInt("AI_MAX_CONCURRENT_CALLS", 4),
		},

		MCP: MCPConfig{
			Enabled:       getEnvBool("MCP_ENABLED", false),
			ServerName:    getEnvString("MCP_SERVER_NAME", "Gestor de Presupuesto"),
			ServerVersion: getEnvString("MCP_SERVER_VERSION", "1.0.0"),
			BaseURL:       getEnvString("MCP_BASE_URL", ""),
			AppURL:        getEnvString("MCP_APP_URL", "https://presupuesto.saulburgos.com"),
		},

		WebAuthn: WebAuthnConfig{
			RPDisplayName: getEnvString("WEBAUTHN_RP_DISPLAY_NAME", "SBFinance"),
			RPID:          getEnvString("WEBAUTHN_RP_ID", "localhost"),
			RPOrigins:     getEnvStringSlice("WEBAUTHN_RP_ORIGINS", []string{"http://localhost:3000"}),
			ChallengeTTL:  getDuration(getEnvString("WEBAUTHN_CHALLENGE_TTL", "5m")),
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
		c.validateMetrics,
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
		if !isValidIP(ip) && !isValidCIDR(ip) {
			return fmt.Errorf("invalid IP in whitelist: %s", ip)
		}
	}

	for _, proxy := range c.Server.TrustedProxies {
		if net.ParseIP(proxy) == nil && !isValidCIDR(proxy) {
			return fmt.Errorf("invalid entry in TRUSTED_PROXIES: %s", proxy)
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
		if origin == "*" && c.CORS.AllowCredentials {
			return fmt.Errorf("CORS wildcard origin cannot be combined with CORS_ALLOW_CREDENTIALS=true")
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

	switch c.OpenTelemetry.OTLPProtocol {
	case "", "grpc", "http/protobuf", "http":
	default:
		return fmt.Errorf("invalid OTEL_EXPORTER_OTLP_PROTOCOL %q (want grpc or http/protobuf)", c.OpenTelemetry.OTLPProtocol)
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

// minMetricsTokenLength keeps METRICS_TOKEN from being guessable.
const minMetricsTokenLength = 16

// validateMetrics validates the metrics / access-log settings. A public,
// unauthenticated /metrics is never allowed in production: either
// METRICS_TOKEN or a separate METRICS_PORT is required there.
func (c *Config) validateMetrics() error {
	switch c.Logging.AccessLog {
	case "", "all", "errors", "off":
	default:
		return fmt.Errorf("invalid ACCESS_LOG %q (want all, errors or off)", c.Logging.AccessLog)
	}
	if c.Logging.AccessLogSampleRate < 0 || c.Logging.AccessLogSampleRate > 1 {
		return fmt.Errorf("ACCESS_LOG_SAMPLE_RATE must be between 0 and 1")
	}

	m := c.Metrics
	if m.Token != "" && len(m.Token) < minMetricsTokenLength {
		return fmt.Errorf("METRICS_TOKEN must be at least %d characters", minMetricsTokenLength)
	}
	if !m.Enabled {
		return nil
	}
	if len(m.Exporters) == 0 {
		return fmt.Errorf("METRICS_EXPORTER must list prometheus and/or otlp")
	}
	for _, e := range m.Exporters {
		switch strings.ToLower(strings.TrimSpace(e)) {
		case "prometheus", "otlp":
		default:
			return fmt.Errorf("invalid METRICS_EXPORTER %q (want prometheus and/or otlp)", e)
		}
	}
	if m.Port > 65535 {
		return fmt.Errorf("METRICS_PORT must be between 1 and 65535")
	}
	if m.Port != 0 && m.Port == c.Server.Port {
		return fmt.Errorf("METRICS_PORT must differ from SERVER_PORT")
	}
	if m.HasExporter("otlp") && c.OpenTelemetry.OTLPEndpoint == "" {
		return fmt.Errorf("METRICS_EXPORTER=otlp requires OTEL_EXPORTER_OTLP_ENDPOINT")
	}
	if c.IsProduction() && m.HasExporter("prometheus") && m.Port == 0 && m.Token == "" {
		return fmt.Errorf("METRICS_ENABLED with the prometheus exporter requires METRICS_TOKEN or METRICS_PORT in production")
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

// minProxySharedSecretLength is the minimum PROXY_SHARED_SECRET length
// accepted in production.
const minProxySharedSecretLength = 32

// validateEnvironmentSpecific validates environment-specific requirements
func (c *Config) validateEnvironmentSpecific() error {
	if c.Server.Environment == EnvironmentProduction {
		if c.JWT.Secret == devJWTSecret {
			return fmt.Errorf("default JWT secret cannot be used in production")
		}

		if c.Server.ProxySharedSecret != "" && len(c.Server.ProxySharedSecret) < minProxySharedSecretLength {
			return fmt.Errorf("PROXY_SHARED_SECRET must be at least %d characters long in production", minProxySharedSecretLength)
		}

		for _, origin := range c.CORS.AllowedOrigins {
			if origin == "*" {
				return fmt.Errorf("CORS wildcard origin cannot be used in production; set CORS_ALLOWED_ORIGINS")
			}
		}

		// Not fatal (a wrong value would take production down), but loud:
		// these modes may send credentials and data unencrypted.
		switch c.Database.SSLMode {
		case "", "disable", "allow", "prefer":
			fmt.Fprintf(os.Stderr, "WARNING: DB_SSL_MODE=%q in production; use require or verify-full\n", c.Database.SSLMode)
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

// GetPostgresUrl returns the PostgreSQL connection string.
//
// binary_parameters=yes makes lib/pq send a parameterised query as
// Parse+Bind+Execute in ONE round trip; without it every query with arguments
// first waits for a Parse/Describe reply (2 round trips, ~14% of the API's CPU
// and most of its per-query latency under load). The trade-off: every []byte
// argument is then sent in binary format, which is only right for BYTEA
// columns. JSON/text held in a []byte must be passed as a string (see
// passkeyRepository.jsonText); money.Amount, time.Time, numbers, strings and
// pq.Array values are unaffected (sent as text either way).
//
// User and password are URL-escaped: a password with @, :, / or % would
// otherwise break (or redirect) the connection string.
func (c *Config) GetPostgresUrl() string {
	u := url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(c.Database.User, c.Database.Password),
		Host:     net.JoinHostPort(c.Database.Host, strconv.FormatUint(uint64(c.Database.Port), 10)),
		Path:     "/" + c.Database.Name,
		RawQuery: "sslmode=" + url.QueryEscape(c.Database.SSLMode) + "&binary_parameters=yes",
	}
	return u.String()
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

// getEnvDuration returns the environment variable parsed as a
// time.Duration ("5s", "250ms", "0" to disable), or defaultValue when it is
// unset or invalid. Negative values are treated as 0.
func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return defaultValue
	}
	d, err := time.ParseDuration(value)
	if err != nil {
		return defaultValue
	}
	if d < 0 {
		return 0
	}
	return d
}

// getEnvStringSlice returns the environment variable value as string slice
func getEnvStringSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		parts := strings.Split(value, ",")
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			if p = strings.TrimSpace(p); p != "" {
				out = append(out, p)
			}
		}
		return out
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

// defaultAccessLogMode logs every request in development and only errors and
// slow requests elsewhere (keeps production log volume unchanged by default).
func defaultAccessLogMode() string {
	if getEnvString("ENV", "development") == string(EnvironmentDevelopment) {
		return "all"
	}
	return "errors"
}

// otlpHeaders reads the OTLP exporter headers. The standard
// OTEL_EXPORTER_OTLP_HEADERS ("k1=v1,k2=v2", values URL-encoded per the OTel
// spec, e.g. "Authorization=Basic%20abc") wins over the legacy OTEL_HEADERS.
func otlpHeaders() map[string]string {
	raw := getEnvStringMap("OTEL_EXPORTER_OTLP_HEADERS", nil)
	if raw == nil {
		return getEnvStringMap("OTEL_HEADERS", make(map[string]string))
	}
	out := make(map[string]string, len(raw))
	for k, v := range raw {
		if dec, err := url.PathUnescape(v); err == nil {
			v = dec
		}
		out[k] = v
	}
	return out
}

// devJWTSecret is a stable fallback used ONLY in local development and test
// environments. It is intentionally public knowledge — never use in staging/prod.
const devJWTSecret = "dev-only-jwt-secret-do-not-use-outside-local-environment-32c"

// getJWTSecret returns the JWT signing secret.
//
// Rules:
//   - If JWT_SECRET env var is set, use it always (any environment).
//   - If ENV is "development" or "test" and the var is missing, fall back to
//     the well-known dev constant and log a loud warning.  Using a stable
//     constant (not a random value) means the server can restart without
//     invalidating existing tokens during local development.
//   - Any other environment (staging, production, CI, …) panics on startup
//     so the misconfiguration is caught before serving real traffic.
func getJWTSecret() string {
	if secret := os.Getenv("JWT_SECRET"); secret != "" {
		return secret
	}

	env := os.Getenv("ENV")
	if env == "development" || env == "test" {
		fmt.Fprintf(os.Stderr,
			"\n⚠️  WARNING: JWT_SECRET is not set. Using the insecure development "+
				"fallback secret. Set JWT_SECRET in your environment before deploying.\n\n")
		return devJWTSecret
	}

	// Staging, production, or any unrecognised environment: fail fast.
	panic(fmt.Sprintf(
		"JWT_SECRET environment variable is required (ENV=%q). "+
			"Set it to a random string of at least 32 characters.", env))
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

// isValidCIDR checks if string is a valid CIDR range (e.g. 10.0.0.0/8)
func isValidCIDR(s string) bool {
	_, _, err := net.ParseCIDR(s)
	return err == nil
}

// toStringSlice converts any slice to string slice for validation
func toStringSlice[T ~string](slice []T) []string {
	result := make([]string, len(slice))
	for i, v := range slice {
		result[i] = string(v)
	}
	return result
}
