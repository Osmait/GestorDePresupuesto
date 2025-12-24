package config

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadConfig(t *testing.T) {
	// Save original environment
	originalEnv := make(map[string]string)
	envVars := []string{
		"SERVER_HOST", "SERVER_PORT", "ENV", "DB_USER", "DB_PASSWORD",
		"DB_HOST", "DB_NAME", "DB_PORT", "DB_TYPE", "JWT_SECRET",
	}

	for _, env := range envVars {
		originalEnv[env] = os.Getenv(env)
	}

	// Clean environment
	for _, env := range envVars {
		os.Unsetenv(env)
	}

	// Restore environment after test
	defer func() {
		for env, value := range originalEnv {
			if value != "" {
				os.Setenv(env, value)
			} else {
				os.Unsetenv(env)
			}
		}
	}()

	t.Run("default configuration", func(t *testing.T) {
		config, err := LoadConfig()
		require.NoError(t, err)

		assert.Equal(t, "localhost", config.Server.Host)
		assert.Equal(t, uint(8080), config.Server.Port)
		assert.Equal(t, EnvironmentDevelopment, config.Server.Environment)
		assert.Equal(t, DatabaseTypePostgres, config.Database.Type)
		assert.True(t, config.RateLimit.Enabled)
		assert.True(t, config.FeatureFlags.EnableMetrics)
	})

	t.Run("environment variables override", func(t *testing.T) {
		os.Setenv("SERVER_HOST", "0.0.0.0")
		os.Setenv("SERVER_PORT", "9000")
		os.Setenv("ENV", "development") // Use development instead of production
		os.Setenv("DB_TYPE", "sqlite")
		os.Setenv("JWT_SECRET", "test-secret-that-is-long-enough-for-validation")

		config, err := LoadConfig()
		require.NoError(t, err)

		assert.Equal(t, "0.0.0.0", config.Server.Host)
		assert.Equal(t, uint(9000), config.Server.Port)
		assert.Equal(t, EnvironmentDevelopment, config.Server.Environment)
		assert.Equal(t, DatabaseTypeSQLite, config.Database.Type)
		assert.Equal(t, "test-secret-that-is-long-enough-for-validation", config.JWT.Secret)
	})

	t.Run("invalid configuration", func(t *testing.T) {
		os.Setenv("SERVER_PORT", "70000") // Invalid port

		_, err := LoadConfig()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "configuration validation failed")
	})
}

func TestConfigValidation(t *testing.T) {
	t.Run("valid configuration", func(t *testing.T) {
		config := &Config{
			Server: ServerConfig{
				Host:            "localhost",
				Port:            8080,
				ShutdownTimeout: 30 * time.Second,
				Environment:     EnvironmentDevelopment,
			},
			Database: DatabaseConfig{
				User:         "testuser",
				Password:     "testpass",
				Host:         "localhost",
				Name:         "testdb",
				Port:         5432,
				Type:         DatabaseTypePostgres,
				MaxOpenConns: 10,
				MaxIdleConns: 5,
			},
			JWT: JWTConfig{
				Secret:            "test-secret-that-is-long-enough-for-validation",
				Expiration:        24 * time.Hour,
				RefreshExpiration: 168 * time.Hour,
			},
			Security: SecurityConfig{
				PasswordMinLength: 8,
				MaxLoginAttempts:  5,
				AccountLockTime:   15 * time.Minute,
			},
			RateLimit: RateLimitConfig{
				Enabled:     true,
				Requests:    100,
				Window:      time.Minute,
				Burst:       50,
				IPWhitelist: []string{"127.0.0.1"},
			},
			CORS: CORSConfig{
				AllowedOrigins: []string{"http://localhost:3000"},
				AllowedMethods: []string{"GET", "POST"},
				AllowedHeaders: []string{"Content-Type"},
			},
			Logging: LoggingConfig{
				Level:  "info",
				Format: "json",
				Output: "stdout",
			},
			OpenTelemetry: OpenTelemetryConfig{
				ServiceName:    "test-service",
				ServiceVersion: "1.0.0",
				Environment:    "test",
				SamplingRate:   1.0,
				MaxBatchSize:   512,
				MaxQueueSize:   1024,
			},
			Prometheus: PrometheusConfig{
				MetricsPath: "/metrics",
			},
		}

		err := config.Validate()
		assert.NoError(t, err)
	})

	t.Run("invalid server configuration", func(t *testing.T) {
		config := &Config{
			Server: ServerConfig{
				Host:            "", // Invalid empty host
				Port:            8080,
				ShutdownTimeout: 30 * time.Second,
				Environment:     EnvironmentDevelopment,
			},
		}

		err := config.Validate()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "server host cannot be empty")
	})

	t.Run("invalid database configuration", func(t *testing.T) {
		config := &Config{
			Server: ServerConfig{
				Host:            "localhost",
				Port:            8080,
				ShutdownTimeout: 30 * time.Second,
				Environment:     EnvironmentDevelopment,
			},
			Database: DatabaseConfig{
				User:         "testuser",
				Password:     "testpass",
				Host:         "localhost",
				Name:         "testdb",
				Port:         5432,
				Type:         DatabaseTypePostgres,
				MaxOpenConns: 0, // Invalid
				MaxIdleConns: 5,
			},
		}

		err := config.Validate()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "database max open connections must be positive")
	})

	t.Run("invalid JWT configuration", func(t *testing.T) {
		config := &Config{
			Server: ServerConfig{
				Host:            "localhost",
				Port:            8080,
				ShutdownTimeout: 30 * time.Second,
				Environment:     EnvironmentDevelopment,
			},
			Database: DatabaseConfig{
				User:         "testuser",
				Password:     "testpass",
				Host:         "localhost",
				Name:         "testdb",
				Port:         5432,
				Type:         DatabaseTypePostgres,
				MaxOpenConns: 10,
				MaxIdleConns: 5,
			},
			JWT: JWTConfig{
				Secret:            "short", // Invalid short secret
				Expiration:        24 * time.Hour,
				RefreshExpiration: 168 * time.Hour,
			},
		}

		err := config.Validate()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "JWT secret must be at least 32 characters long")
	})

	t.Run("production environment validation", func(t *testing.T) {
		config := &Config{
			Server: ServerConfig{
				Host:            "localhost",
				Port:            8080,
				ShutdownTimeout: 30 * time.Second,
				Environment:     EnvironmentProduction,
			},
			Database: DatabaseConfig{
				User:         "testuser",
				Password:     "testpass",
				Host:         "localhost",
				Name:         "testdb",
				Port:         5432,
				Type:         DatabaseTypePostgres,
				MaxOpenConns: 10,
				MaxIdleConns: 5,
			},
			JWT: JWTConfig{
				Secret:            "development-secret-key-change-in-production-please-use-env-var", // Invalid in production
				Expiration:        24 * time.Hour,
				RefreshExpiration: 168 * time.Hour,
			},
			Security: SecurityConfig{
				PasswordMinLength: 8,
				MaxLoginAttempts:  5,
				AccountLockTime:   15 * time.Minute,
				EnableTLS:         false, // Invalid in production
			},
			RateLimit: RateLimitConfig{
				Enabled:     true,
				Requests:    100,
				Window:      time.Minute,
				Burst:       50,
				IPWhitelist: []string{"127.0.0.1"},
			},
			CORS: CORSConfig{
				AllowedOrigins: []string{"http://localhost:3000"},
				AllowedMethods: []string{"GET", "POST"},
				AllowedHeaders: []string{"Content-Type"},
			},
			Logging: LoggingConfig{
				Level:  "info",
				Format: "json",
				Output: "stdout",
			},
			OpenTelemetry: OpenTelemetryConfig{
				ServiceName:    "test-service",
				ServiceVersion: "1.0.0",
				Environment:    "production",
				SamplingRate:   1.0,
				MaxBatchSize:   512,
				MaxQueueSize:   1024,
			},
			Prometheus: PrometheusConfig{
				MetricsPath: "/metrics",
			},
		}

		err := config.Validate()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "default JWT secret cannot be used in production")
	})
}

func TestPasswordValidation(t *testing.T) {
	config := &Config{
		Security: SecurityConfig{
			PasswordMinLength:     8,
			PasswordRequireUpper:  true,
			PasswordRequireLower:  true,
			PasswordRequireDigit:  true,
			PasswordRequireSymbol: true,
		},
	}

	tests := []struct {
		name     string
		password string
		wantErr  bool
		errMsg   string
	}{
		{
			name:     "valid password",
			password: "Test123!@#",
			wantErr:  false,
		},
		{
			name:     "too short",
			password: "Test1!",
			wantErr:  true,
			errMsg:   "password must be at least 8 characters long",
		},
		{
			name:     "no uppercase",
			password: "test123!@#",
			wantErr:  true,
			errMsg:   "password must contain at least one uppercase letter",
		},
		{
			name:     "no lowercase",
			password: "TEST123!@#",
			wantErr:  true,
			errMsg:   "password must contain at least one lowercase letter",
		},
		{
			name:     "no digit",
			password: "TestABC!@#",
			wantErr:  true,
			errMsg:   "password must contain at least one digit",
		},
		{
			name:     "no symbol",
			password: "Test123ABC",
			wantErr:  true,
			errMsg:   "password must contain at least one special character",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := config.ValidatePassword(tt.password)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestDatabaseURLGeneration(t *testing.T) {
	t.Run("PostgreSQL URL", func(t *testing.T) {
		config := &Config{
			Database: DatabaseConfig{
				Type:     DatabaseTypePostgres,
				User:     "testuser",
				Password: "testpass",
				Host:     "localhost",
				Port:     5432,
				Name:     "testdb",
				SSLMode:  "disable",
			},
		}

		expected := "postgres://testuser:testpass@localhost:5432/testdb?sslmode=disable"
		assert.Equal(t, expected, config.GetDatabaseUrl())
	})

	t.Run("SQLite URL", func(t *testing.T) {
		config := &Config{
			Database: DatabaseConfig{
				Type: DatabaseTypeSQLite,
				Name: "test.db",
			},
		}

		expected := "sqlite3://test.db"
		assert.Equal(t, expected, config.GetDatabaseUrl())
	})

	t.Run("SQLite in-memory URL", func(t *testing.T) {
		config := &Config{
			Database: DatabaseConfig{
				Type: DatabaseTypeSQLite,
				Name: ":memory:",
			},
		}

		expected := "sqlite3://:memory:"
		assert.Equal(t, expected, config.GetDatabaseUrl())
	})
}

func TestServerURLGeneration(t *testing.T) {
	t.Run("HTTP URL", func(t *testing.T) {
		config := &Config{
			Server: ServerConfig{
				Host: "localhost",
				Port: 8080,
			},
			Security: SecurityConfig{
				EnableTLS: false,
			},
		}

		expected := "http://localhost:8080"
		assert.Equal(t, expected, config.GetServerUrl())
	})

	t.Run("HTTPS URL", func(t *testing.T) {
		config := &Config{
			Server: ServerConfig{
				Host: "localhost",
				Port: 8443,
			},
			Security: SecurityConfig{
				EnableTLS: true,
			},
		}

		expected := "https://localhost:8443"
		assert.Equal(t, expected, config.GetServerUrl())
	})
}

func TestEnvironmentDetection(t *testing.T) {
	tests := []struct {
		name        string
		environment Environment
		isDev       bool
		isTest      bool
		isProd      bool
	}{
		{
			name:        "development",
			environment: EnvironmentDevelopment,
			isDev:       true,
			isTest:      false,
			isProd:      false,
		},
		{
			name:        "test",
			environment: EnvironmentTest,
			isDev:       false,
			isTest:      true,
			isProd:      false,
		},
		{
			name:        "production",
			environment: EnvironmentProduction,
			isDev:       false,
			isTest:      false,
			isProd:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := &Config{
				Server: ServerConfig{
					Environment: tt.environment,
				},
			}

			assert.Equal(t, tt.isDev, config.IsDevelopment())
			assert.Equal(t, tt.isTest, config.IsTest())
			assert.Equal(t, tt.isProd, config.IsProduction())
		})
	}
}

func TestHelperFunctions(t *testing.T) {
	t.Run("getEnvString", func(t *testing.T) {
		os.Setenv("TEST_STRING", "test_value")
		defer os.Unsetenv("TEST_STRING")

		result := getEnvString("TEST_STRING", "default")
		assert.Equal(t, "test_value", result)

		result = getEnvString("NONEXISTENT", "default")
		assert.Equal(t, "default", result)
	})

	t.Run("getEnvInt", func(t *testing.T) {
		os.Setenv("TEST_INT", "42")
		defer os.Unsetenv("TEST_INT")

		result := getEnvInt("TEST_INT", 0)
		assert.Equal(t, 42, result)

		result = getEnvInt("NONEXISTENT", 10)
		assert.Equal(t, 10, result)

		os.Setenv("INVALID_INT", "not_a_number")
		defer os.Unsetenv("INVALID_INT")

		result = getEnvInt("INVALID_INT", 20)
		assert.Equal(t, 20, result)
	})

	t.Run("getEnvBool", func(t *testing.T) {
		os.Setenv("TEST_BOOL", "true")
		defer os.Unsetenv("TEST_BOOL")

		result := getEnvBool("TEST_BOOL", false)
		assert.True(t, result)

		result = getEnvBool("NONEXISTENT", true)
		assert.True(t, result)
	})

	t.Run("getEnvStringSlice", func(t *testing.T) {
		os.Setenv("TEST_SLICE", "value1,value2,value3")
		defer os.Unsetenv("TEST_SLICE")

		result := getEnvStringSlice("TEST_SLICE", []string{"default"})
		expected := []string{"value1", "value2", "value3"}
		assert.Equal(t, expected, result)

		result = getEnvStringSlice("NONEXISTENT", []string{"default"})
		assert.Equal(t, []string{"default"}, result)
	})

	t.Run("getEnvStringMap", func(t *testing.T) {
		os.Setenv("TEST_MAP", "key1=value1,key2=value2")
		defer os.Unsetenv("TEST_MAP")

		result := getEnvStringMap("TEST_MAP", map[string]string{"default": "value"})
		expected := map[string]string{"key1": "value1", "key2": "value2"}
		assert.Equal(t, expected, result)

		result = getEnvStringMap("NONEXISTENT", map[string]string{"default": "value"})
		assert.Equal(t, map[string]string{"default": "value"}, result)
	})
}

func TestValidationHelpers(t *testing.T) {
	t.Run("isValidURL", func(t *testing.T) {
		assert.True(t, isValidURL("http://example.com"))
		assert.True(t, isValidURL("https://example.com:8080"))
		assert.True(t, isValidURL("http://localhost:3000"))
		assert.False(t, isValidURL(""))
		assert.False(t, isValidURL("not-a-url"))
		assert.False(t, isValidURL("example.com"))
	})

	t.Run("isValidIP", func(t *testing.T) {
		assert.True(t, isValidIP("127.0.0.1"))
		assert.True(t, isValidIP("192.168.1.1"))
		assert.True(t, isValidIP("::1"))
		assert.True(t, isValidIP("localhost"))
		assert.False(t, isValidIP(""))
		assert.False(t, isValidIP("not-an-ip"))
		assert.False(t, isValidIP("999.999.999.999"))
	})

	t.Run("isValidEnum", func(t *testing.T) {
		allowed := []string{"value1", "value2", "value3"}
		assert.True(t, isValidEnum("value1", allowed))
		assert.True(t, isValidEnum("value2", allowed))
		assert.False(t, isValidEnum("value4", allowed))
		assert.False(t, isValidEnum("", allowed))
	})
}

func TestSecureSecretGeneration(t *testing.T) {
	t.Run("generateSecureSecret", func(t *testing.T) {
		secret := generateSecureSecret()
		assert.NotEmpty(t, secret)
		assert.Equal(t, 64, len(secret)) // 32 bytes hex encoded = 64 characters
	})
}

// Benchmark tests
func BenchmarkLoadConfig(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, err := LoadConfig()
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkConfigValidation(b *testing.B) {
	config, err := LoadConfig()
	if err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		err := config.Validate()
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkPasswordValidation(b *testing.B) {
	config, err := LoadConfig()
	if err != nil {
		b.Fatal(err)
	}

	password := "TestPassword123!"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		err := config.ValidatePassword(password)
		if err != nil {
			b.Fatal(err)
		}
	}
}
