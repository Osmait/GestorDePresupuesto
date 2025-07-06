# OpenTelemetry Implementation Guide

## Overview

This application now includes comprehensive OpenTelemetry implementation for distributed tracing, metrics collection, and structured logging with trace correlation.

## Features

### 🔍 **Distributed Tracing**
- **HTTP Request Tracing**: Automatic tracing of all HTTP requests with span creation
- **Service Operation Tracing**: Manual tracing for business logic operations
- **Database Query Tracing**: Trace database operations (ready for implementation)
- **Cross-Service Correlation**: Trace propagation through service boundaries
- **Error Tracking**: Automatic error recording in spans

### 📊 **Business Metrics**
- **User Metrics**: Registrations, logins, login failures, active users
- **Transaction Metrics**: Transaction count, amounts, errors
- **Budget Metrics**: Creations, updates, exceeded events, utilization
- **Account Metrics**: Creations, balance distributions
- **Investment Metrics**: Creations, values, returns
- **Category Metrics**: Creations, usage patterns
- **Performance Metrics**: Service operation duration and success rates
- **Database Metrics**: Query performance and error rates

### 📝 **Structured Logging**
- **Trace Correlation**: Automatic trace ID and span ID injection
- **Contextual Logging**: Rich context with user, request, and service information
- **Security Events**: Dedicated security event logging
- **Performance Logging**: Request duration and resource usage
- **Error Logging**: Structured error information with stack traces

## Configuration

### Environment Variables

```bash
# Service Information
OTEL_SERVICE_NAME=gestor-de-presupuesto
OTEL_SERVICE_VERSION=1.0.0
OTEL_ENVIRONMENT=development

# Tracing Configuration
ENABLE_TRACING=true
OTEL_SAMPLING_RATE=1.0
OTEL_BATCH_TIMEOUT=5s
OTEL_MAX_BATCH_SIZE=512
OTEL_MAX_QUEUE_SIZE=2048

# Metrics Configuration  
ENABLE_METRICS=true
PROMETHEUS_ENDPOINT=:2112
PROMETHEUS_METRICS_PATH=/metrics

# Exporters
OTEL_OTLP_ENDPOINT=http://localhost:4318
OTEL_JAEGER_ENDPOINT=http://localhost:14268/api/traces
OTEL_ENABLE_STDOUT=false

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json
LOG_OUTPUT=stdout
LOG_CALLER=true
```

### Sampling Rates

- `1.0` - Trace 100% of requests (development)
- `0.1` - Trace 10% of requests (production)
- `0.01` - Trace 1% of requests (high-traffic production)
- `0.0` - Disable tracing

## Usage Examples

### 1. HTTP Middleware (Automatic)

The tracing middleware automatically:
- Creates spans for all HTTP requests
- Records request/response metrics
- Adds trace IDs to response headers
- Propagates trace context

```go
// Automatically applied to all routes
GET /api/users/123
Response Headers:
X-Trace-ID: 4f96c4c4c4c4c4c4c4c4c4c4c4c4c4c4
X-Span-ID: 8f96c4c4c4c4c4c4
```

### 2. Service Operation Tracing (Manual)

```go
// In service methods
func (s *UserService) CreateUser(ctx context.Context, user *User) error {
    ctx, span := middleware.StartSpan(ctx, "UserService.CreateUser")
    defer span.End()
    
    // Add custom attributes
    middleware.AddSpanAttributes(ctx, 
        attribute.String("user.email", user.Email),
        attribute.Int("user.age", user.Age),
    )
    
    // Your business logic here
    err := s.repository.Save(ctx, user)
    if err != nil {
        middleware.AddSpanError(ctx, err)
        return err
    }
    
    // Record business metrics
    businessMetrics.RecordUserRegistration(ctx, "standard")
    
    return nil
}
```

### 3. Structured Logging

```go
// Context-aware logging with trace correlation
observability.InfoCtx(ctx, "User created successfully")

// Log with structured fields
observability.LogBusinessEvent(ctx, "user_registration", "New user registered", map[string]interface{}{
    "user_id": user.ID,
    "email": user.Email,
    "source": "web",
})

// Log errors with context
observability.LogError(ctx, err, "Failed to create user", map[string]interface{}{
    "user_email": user.Email,
    "error_code": "validation_failed",
})
```

### 4. Business Metrics

```go
// Record transactions
businessMetrics.RecordTransaction(ctx, "expense", 150.50)

// Record budget events
businessMetrics.RecordBudgetUtilization(ctx, "groceries", 85.5)

// Record service performance
businessMetrics.RecordServiceOperation(ctx, "user", "create", duration, true)
```

## Observability Stack

### Local Development

```yaml
# docker-compose.yml for local observability stack
version: '3.8'
services:
  # Jaeger for tracing
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"
      - "14268:14268"
    environment:
      - COLLECTOR_OTLP_ENABLED=true

  # Prometheus for metrics
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  # OpenTelemetry Collector
  otel-collector:
    image: otel/opentelemetry-collector:latest
    command: ["--config=/etc/otel-collector-config.yml"]
    volumes:
      - ./otel-collector-config.yml:/etc/otel-collector-config.yml
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
```

### Metrics Endpoints

- **Application Metrics**: `http://localhost:8080/metrics`
- **Prometheus UI**: `http://localhost:9090`
- **Jaeger UI**: `http://localhost:16686`

## Key Metrics to Monitor

### SLIs (Service Level Indicators)

- **Request Latency**: P50, P95, P99 response times
- **Error Rate**: 4xx and 5xx response percentages
- **Throughput**: Requests per second
- **Availability**: Uptime percentage

### Business Metrics

- **User Activity**: Registration rate, login success rate
- **Transaction Health**: Transaction volume, success rate, average amount
- **Budget Compliance**: Budget utilization, exceeded events
- **System Performance**: Database query time, service operation duration

## Alerts Configuration

### Critical Alerts

```yaml
# Example Prometheus alerting rules
groups:
  - name: gestor-de-presupuesto
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_class="5xx"}[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High request latency detected"

      - alert: DatabaseConnectionFailure
        expr: database_connections == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection lost"
```

## Best Practices

### 1. Tracing

- **Use Semantic Naming**: `ServiceName.MethodName` format
- **Add Meaningful Attributes**: User ID, transaction ID, etc.
- **Limit Span Attributes**: Max 20 attributes per span
- **Use Span Events**: For important milestones
- **Record Errors**: Always record errors in spans

### 2. Metrics

- **Use Consistent Labels**: Standardize label names across services
- **Avoid High Cardinality**: Limit unique label combinations
- **Monitor Resource Usage**: CPU, memory, database connections
- **Business Metrics**: Track key business KPIs

### 3. Logging

- **Structured Logging**: Always use JSON format in production
- **Correlation IDs**: Include trace IDs in all logs
- **Log Levels**: Use appropriate levels (DEBUG, INFO, WARN, ERROR)
- **Sensitive Data**: Never log passwords or tokens
- **Performance**: Log slow operations and resource usage

## Integration with Services

The observability implementation is already integrated with:

- ✅ **HTTP Middleware**: Automatic request tracing and metrics
- ✅ **Service Layer**: Ready for manual tracing
- ✅ **Configuration**: Environment-based configuration
- ✅ **Health Checks**: Enhanced with observability data
- ✅ **Error Handling**: Structured error logging
- 🔄 **Database Layer**: Ready for implementation
- 🔄 **Authentication**: Security event logging ready
- 🔄 **Rate Limiting**: Metrics collection ready

## Next Steps

1. **Deploy Observability Stack**: Set up Jaeger, Prometheus, and Grafana
2. **Create Dashboards**: Build monitoring dashboards for key metrics
3. **Set Up Alerts**: Configure alerting for critical issues
4. **Add Database Tracing**: Implement database query tracing
5. **Performance Tuning**: Optimize based on observability data

## Troubleshooting

### Common Issues

1. **No Traces Appearing**
   - Check OTEL_OTLP_ENDPOINT configuration
   - Verify Jaeger/OTLP collector is running
   - Check sampling rate (set to 1.0 for testing)

2. **Missing Metrics**
   - Verify ENABLE_METRICS=true
   - Check Prometheus endpoint configuration
   - Ensure /metrics endpoint is accessible

3. **Missing Trace Correlation in Logs**
   - Verify structured logging is enabled
   - Check LOG_FORMAT=json
   - Ensure context is properly propagated

4. **High Resource Usage**
   - Reduce sampling rate
   - Adjust batch sizes
   - Optimize metric collection intervals 