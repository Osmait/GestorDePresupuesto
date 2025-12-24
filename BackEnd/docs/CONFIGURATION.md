# Configuration Guide

This document provides a comprehensive guide to configuring the Gestor de Presupuesto application.

## Table of Contents

- [Overview](#overview)
- [Environment Variables](#environment-variables)
- [Configuration Sections](#configuration-sections)
- [Environment-Specific Settings](#environment-specific-settings)
- [Security Best Practices](#security-best-practices)
- [Docker & Kubernetes](#docker--kubernetes)
- [Troubleshooting](#troubleshooting)

## Overview

The application uses a comprehensive configuration system that supports:

- **Environment-based configuration**: Different settings for development, test, and production
- **Environment variables**: All settings can be overridden via environment variables
- **Validation**: Comprehensive validation of all configuration values
- **Security**: Secure defaults and environment-specific requirements
- **Observability**: Built-in support for OpenTelemetry and Prometheus

## Environment Variables

### Environment Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ENV` | `development` | Environment: `development`, `test`, `production` |

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_HOST` | `localhost` | Server host address |
| `SERVER_PORT` | `8080` | Server port (1-65535) |
| `SHUTDOWN_TIMEOUT` | `30s` | Graceful shutdown timeout |
| `SERVER_READ_TIMEOUT` | `30s` | HTTP read timeout |
| `SERVER_WRITE_TIMEOUT` | `30s` | HTTP write timeout |
| `SERVER_IDLE_TIMEOUT` | `60s` | HTTP idle timeout |
| `SERVER_MAX_HEADER_BYTES` | `1048576` | Maximum header size (1MB) |

### Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_TYPE` | `postgres` | Database type: `postgres`, `sqlite` |
| `DB_USER` | `osmait` | Database username |
| `DB_PASSWORD` | `admin123` | Database password |
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5432` | Database port |
| `DB_NAME` | `my_store` | Database name |
| `DB_MAX_OPEN_CONNS` | `25` | Maximum open connections |
| `DB_MAX_IDLE_CONNS` | `25` | Maximum idle connections |
| `DB_CONN_MAX_LIFETIME` | `5m` | Connection maximum lifetime |
| `DB_CONN_MAX_IDLE_TIME` | `5m` | Connection maximum idle time |
| `DB_SSL_MODE` | `disable` | SSL mode: `disable`, `require`, `verify-ca`, `verify-full` |

### JWT Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | Generated | JWT secret key (minimum 32 characters) |
| `JWT_EXPIRATION` | `24h` | JWT token expiration |
| `JWT_REFRESH_EXPIRATION` | `168h` | JWT refresh token expiration (7 days) |
| `JWT_ISSUER` | `gestor-de-presupuesto` | JWT issuer |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |

### Security Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PASSWORD_MIN_LENGTH` | `8` | Minimum password length (8-128) |
| `PASSWORD_REQUIRE_UPPER` | `true` | Require uppercase letters |
| `PASSWORD_REQUIRE_LOWER` | `true` | Require lowercase letters |
| `PASSWORD_REQUIRE_DIGIT` | `true` | Require digits |
| `PASSWORD_REQUIRE_SYMBOL` | `false` | Require special characters |
| `MAX_LOGIN_ATTEMPTS` | `5` | Maximum login attempts (1-100) |
| `ACCOUNT_LOCK_TIME` | `15m` | Account lock duration |
| `SESSION_TIMEOUT` | `30m` | Session timeout |
| `ENABLE_TLS` | `false` | Enable TLS/HTTPS |
| `TLS_CERT_FILE` | | TLS certificate file |
| `TLS_KEY_FILE` | | TLS private key file |

### Rate Limiting Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_ENABLED` | `true` | Enable rate limiting |
| `RATE_LIMIT_REQUESTS` | `100` | Requests per window |
| `RATE_LIMIT_WINDOW` | `1m` | Rate limit window |
| `RATE_LIMIT_BURST` | `50` | Burst size |
| `RATE_LIMIT_IP_WHITELIST` | `127.0.0.1,::1` | IP whitelist (comma-separated) |
| `RATE_LIMIT_USER_BASED` | `true` | Enable user-based rate limiting |

### CORS Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000,...` | Allowed origins (comma-separated) |
| `CORS_ALLOWED_METHODS` | `GET,POST,PUT,DELETE,...` | Allowed methods (comma-separated) |
| `CORS_ALLOWED_HEADERS` | `Origin,Content-Type,...` | Allowed headers (comma-separated) |
| `CORS_EXPOSED_HEADERS` | `X-Trace-ID` | Exposed headers (comma-separated) |
| `CORS_ALLOW_CREDENTIALS` | `true` | Allow credentials |
| `CORS_MAX_AGE` | `86400` | CORS max age (24 hours) |

### Logging Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error`, `fatal`, `panic` |
| `LOG_FORMAT` | `json` | Log format: `json`, `console` |
| `LOG_OUTPUT` | `stdout` | Log output: `stdout`, `stderr`, `file` |
| `LOG_FILENAME` | `app.log` | Log file name (when output=file) |
| `LOG_MAX_SIZE` | `100` | Log file max size (MB) |
| `LOG_MAX_BACKUPS` | `3` | Log file max backups |
| `LOG_MAX_AGE` | `28` | Log file max age (days) |
| `LOG_COMPRESS` | `true` | Compress old log files |
| `LOG_CALLER` | `false` | Include caller information |
| `LOG_STACK_TRACE` | `false` | Include stack trace |

### Feature Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_METRICS` | `true` | Enable metrics collection |
| `ENABLE_TRACING` | `false` | Enable distributed tracing |
| `ENABLE_HEALTH_CHECK` | `true` | Enable health check endpoint |
| `ENABLE_SWAGGER_DOCS` | `false` | Enable Swagger documentation |
| `ENABLE_PROFILING` | `false` | Enable profiling endpoints |
| `ENABLE_DEBUG_MODE` | `false` | Enable debug mode |

### OpenTelemetry Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_SERVICE_NAME` | `gestor-de-presupuesto` | Service name |
| `OTEL_SERVICE_VERSION` | `1.0.0` | Service version |
| `OTEL_ENVIRONMENT` | `development` | Environment name |
| `OTEL_SAMPLING_RATE` | `1.0` | Sampling rate (0.0-1.0) |
| `OTEL_OTLP_ENDPOINT` | `http://localhost:4317` | OTLP endpoint |
| `OTEL_JAEGER_ENDPOINT` | `http://localhost:14268` | Jaeger endpoint |
| `OTEL_ENABLE_STDOUT` | `true` | Enable stdout exporter |
| `OTEL_BATCH_TIMEOUT` | `10s` | Batch timeout |
| `OTEL_MAX_BATCH_SIZE` | `512` | Maximum batch size |
| `OTEL_MAX_QUEUE_SIZE` | `1024` | Maximum queue size |
| `OTEL_ENABLE_COMPRESSION` | `true` | Enable compression |
| `OTEL_HEADERS` | | Custom headers (key1=value1,key2=value2) |
| `OTEL_ATTRIBUTES` | | Custom attributes (key1=value1,key2=value2) |

### Prometheus Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PROMETHEUS_ENDPOINT` | `http://localhost:9090` | Prometheus endpoint |
| `PROMETHEUS_METRICS_PATH` | `/metrics` | Metrics endpoint path |
| `PROMETHEUS_NAMESPACE` | `gestor_presupuesto` | Metrics namespace |
| `PROMETHEUS_SUBSYSTEM` | `api` | Metrics subsystem |
| `PROMETHEUS_PUSH_GATEWAY` | | Push gateway URL |
| `PROMETHEUS_INTERVAL` | `15s` | Scrape interval |

### Middleware Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MIDDLEWARE_ENABLE_LOGGING` | `true` | Enable logging middleware |
| `MIDDLEWARE_ENABLE_TRACING` | `true` | Enable tracing middleware |
| `MIDDLEWARE_ENABLE_METRICS` | `true` | Enable metrics middleware |
| `MIDDLEWARE_ENABLE_RECOVERY` | `true` | Enable recovery middleware |
| `MIDDLEWARE_ENABLE_RATE_LIMIT` | `true` | Enable rate limit middleware |
| `MIDDLEWARE_ENABLE_CORS` | `true` | Enable CORS middleware |
| `MIDDLEWARE_ENABLE_COMPRESSION` | `false` | Enable compression middleware |
| `MIDDLEWARE_ENABLE_AUTHENTICATION` | `true` | Enable authentication middleware |
| `MIDDLEWARE_ENABLE_VALIDATION` | `true` | Enable validation middleware |

## Configuration Sections

### Server Configuration

The server configuration controls HTTP server behavior:

```go
type ServerConfig struct {
    Host            string        // Server bind address
    Port            uint          // Server port
    ShutdownTimeout time.Duration // Graceful shutdown timeout
    Environment     Environment   // Application environment
    ReadTimeout     time.Duration // HTTP read timeout
    WriteTimeout    time.Duration // HTTP write timeout
    IdleTimeout     time.Duration // HTTP idle timeout
    MaxHeaderBytes  int           // Maximum header size
}
```

### Database Configuration

Supports both PostgreSQL and SQLite:

```go
type DatabaseConfig struct {
    User            string        // Database username
    Password        string        // Database password
    Host            string        // Database host
    Name            string        // Database name
    Port            uint          // Database port
    Type            DatabaseType  // Database type
    MaxOpenConns    int           // Connection pool settings
    MaxIdleConns    int
    ConnMaxLifetime time.Duration
    ConnMaxIdleTime time.Duration
    SSLMode         string        // SSL configuration
}
```

### JWT Configuration

Handles JWT token generation and validation:

```go
type JWTConfig struct {
    Secret            string        // JWT secret key
    Expiration        time.Duration // Access token expiration
    RefreshExpiration time.Duration // Refresh token expiration
    Issuer            string        // JWT issuer
    Algorithm         string        // JWT algorithm
}
```

### Security Configuration

Comprehensive security settings:

```go
type SecurityConfig struct {
    PasswordMinLength     int           // Password requirements
    PasswordRequireUpper  bool
    PasswordRequireLower  bool
    PasswordRequireDigit  bool
    PasswordRequireSymbol bool
    MaxLoginAttempts      int           // Login protection
    AccountLockTime       time.Duration
    SessionTimeout        time.Duration
    EnableTLS             bool          // TLS settings
    TLSCertFile           string
    TLSKeyFile            string
}
```

## Environment-Specific Settings

### Development Environment

```bash
ENV=development
LOG_LEVEL=debug
ENABLE_DEBUG_MODE=true
ENABLE_SWAGGER_DOCS=true
OTEL_ENABLE_STDOUT=true
RATE_LIMIT_ENABLED=false  # Optional: disable for development
```

### Test Environment

```bash
ENV=test
DB_TYPE=sqlite
DB_NAME=:memory:
LOG_LEVEL=warn
ENABLE_TRACING=false
ENABLE_METRICS=false
```

### Production Environment

```bash
ENV=production
ENABLE_TLS=true
TLS_CERT_FILE=/path/to/cert.pem
TLS_KEY_FILE=/path/to/key.pem
JWT_SECRET=your-super-secure-secret-key-here
LOG_LEVEL=info
ENABLE_DEBUG_MODE=false
ENABLE_SWAGGER_DOCS=false
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com
```

## Security Best Practices

### JWT Security

1. **Always use a strong JWT secret** (minimum 32 characters)
2. **Use environment variables** for the JWT secret
3. **Set appropriate expiration times**
4. **Use HTTPS in production**

```bash
# Generate a secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)
```

### Database Security

1. **Use strong database passwords**
2. **Enable SSL/TLS for database connections**
3. **Limit database user permissions**
4. **Use connection pooling**

```bash
DB_SSL_MODE=require
DB_PASSWORD=your-secure-database-password
```

### TLS Configuration

1. **Enable TLS in production**
2. **Use valid SSL certificates**
3. **Configure proper cipher suites**

```bash
ENABLE_TLS=true
TLS_CERT_FILE=/etc/ssl/certs/app.crt
TLS_KEY_FILE=/etc/ssl/private/app.key
```

### Rate Limiting

1. **Enable rate limiting**
2. **Set appropriate limits**
3. **Use IP whitelisting for trusted sources**

```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=1m
RATE_LIMIT_IP_WHITELIST=192.168.1.0/24
```

## Docker & Kubernetes

### Docker Compose

```yaml
version: '3.8'
services:
  app:
    image: gestor-de-presupuesto:latest
    environment:
      - ENV=production
      - SERVER_HOST=0.0.0.0
      - SERVER_PORT=8080
      - DB_TYPE=postgres
      - DB_HOST=postgres
      - DB_USER=app_user
      - DB_PASSWORD=secure_password
      - DB_NAME=gestor_db
      - JWT_SECRET=your-secure-jwt-secret
      - ENABLE_TLS=true
    ports:
      - "8080:8080"
    depends_on:
      - postgres
    volumes:
      - ./certs:/etc/ssl/certs
```

### Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  ENV: "production"
  SERVER_HOST: "0.0.0.0"
  SERVER_PORT: "8080"
  DB_TYPE: "postgres"
  DB_HOST: "postgres-service"
  DB_PORT: "5432"
  DB_NAME: "gestor_db"
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
  ENABLE_METRICS: "true"
  ENABLE_TRACING: "true"
  ENABLE_HEALTH_CHECK: "true"
```

### Kubernetes Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
data:
  DB_USER: YXBwX3VzZXI=  # base64 encoded
  DB_PASSWORD: c2VjdXJlX3Bhc3N3b3Jk  # base64 encoded
  JWT_SECRET: eW91ci1zZWN1cmUtand0LXNlY3JldA==  # base64 encoded
```

## Validation

The configuration system includes comprehensive validation:

### Automatic Validation

- **Required fields**: Ensures all required fields are present
- **Type validation**: Validates data types and formats
- **Range validation**: Ensures numeric values are within valid ranges
- **Format validation**: Validates URLs, IP addresses, and other formats
- **Environment-specific validation**: Additional checks for production environments

### Custom Validation

You can add custom validation rules:

```go
func (c *Config) ValidateCustom() error {
    if c.Server.Environment == EnvironmentProduction {
        if c.JWT.Secret == "development-secret" {
            return errors.New("production requires secure JWT secret")
        }
    }
    return nil
}
```

## Troubleshooting

### Common Issues

1. **Configuration validation failed**
   - Check that all required environment variables are set
   - Verify that values are within valid ranges
   - Ensure production-specific requirements are met

2. **Database connection failed**
   - Verify database credentials
   - Check network connectivity
   - Ensure database server is running

3. **JWT token validation failed**
   - Check JWT secret consistency
   - Verify token expiration settings
   - Ensure proper token format

4. **Rate limiting too restrictive**
   - Adjust rate limit settings
   - Add IP addresses to whitelist
   - Consider user-based rate limiting

### Debug Mode

Enable debug mode for detailed logging:

```bash
ENV=development
LOG_LEVEL=debug
ENABLE_DEBUG_MODE=true
```

### Health Checks

The application provides health check endpoints:

- `/health` - Basic health check
- `/health/ready` - Readiness check
- `/health/live` - Liveness check

### Configuration Validation

Test configuration validation:

```bash
# Test configuration loading
go run main.go --validate-config

# Test specific environment
ENV=production go run main.go --validate-config
```

## Best Practices

1. **Use environment variables** for all configuration
2. **Validate configuration** on startup
3. **Use secure defaults** for production
4. **Document configuration changes**
5. **Test configuration** in different environments
6. **Monitor configuration** for security issues
7. **Use configuration management** tools for production
8. **Keep secrets separate** from configuration
9. **Version control** configuration templates
10. **Audit configuration** regularly

## Additional Resources

- [OpenTelemetry Configuration](./OPENTELEMETRY.md)
- [Error Handling Documentation](./ERROR_HANDLING.md)
- [Security Best Practices](../CONTRIBUTING.md#security)
- [Deployment Guide](../README.md#deployment) 