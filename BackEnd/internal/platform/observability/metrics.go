package observability

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

// BusinessMetrics holds business-specific metrics
type BusinessMetrics struct {
	// User metrics
	UserRegistrations metric.Int64Counter
	UserLogins        metric.Int64Counter
	UserLoginFailures metric.Int64Counter
	ActiveUsers       metric.Int64UpDownCounter

	// Transaction metrics
	TransactionCount  metric.Int64Counter
	TransactionAmount metric.Float64Histogram
	TransactionErrors metric.Int64Counter

	// Budget metrics
	BudgetCreations   metric.Int64Counter
	BudgetUpdates     metric.Int64Counter
	BudgetExceeded    metric.Int64Counter
	BudgetUtilization metric.Float64Histogram

	// Account metrics
	AccountCreations metric.Int64Counter
	AccountBalance   metric.Float64Histogram

	// Investment metrics
	InvestmentCreations metric.Int64Counter
	InvestmentValue     metric.Float64Histogram
	InvestmentReturns   metric.Float64Histogram

	// Category metrics
	CategoryCreations metric.Int64Counter
	CategoryUsage     metric.Int64Counter

	// Service performance metrics
	ServiceOperationDuration metric.Float64Histogram
	ServiceOperationCount    metric.Int64Counter
	ServiceOperationErrors   metric.Int64Counter

	// Database metrics
	DatabaseConnections   metric.Int64UpDownCounter
	DatabaseQueryDuration metric.Float64Histogram
	DatabaseQueryCount    metric.Int64Counter
	DatabaseQueryErrors   metric.Int64Counter

	// Cache metrics (for future use)
	CacheHits   metric.Int64Counter
	CacheMisses metric.Int64Counter
	CacheSize   metric.Int64UpDownCounter
}

// NewBusinessMetrics creates and initializes business metrics
func NewBusinessMetrics(serviceName string) (*BusinessMetrics, error) {
	meter := otel.Meter(serviceName)

	// User metrics
	userRegistrations, err := meter.Int64Counter(
		"user_registrations_total",
		metric.WithDescription("Total number of user registrations"),
	)
	if err != nil {
		return nil, err
	}

	userLogins, err := meter.Int64Counter(
		"user_logins_total",
		metric.WithDescription("Total number of user logins"),
	)
	if err != nil {
		return nil, err
	}

	userLoginFailures, err := meter.Int64Counter(
		"user_login_failures_total",
		metric.WithDescription("Total number of failed login attempts"),
	)
	if err != nil {
		return nil, err
	}

	activeUsers, err := meter.Int64UpDownCounter(
		"active_users",
		metric.WithDescription("Number of currently active users"),
	)
	if err != nil {
		return nil, err
	}

	// Transaction metrics
	transactionCount, err := meter.Int64Counter(
		"transactions_total",
		metric.WithDescription("Total number of transactions"),
	)
	if err != nil {
		return nil, err
	}

	transactionAmount, err := meter.Float64Histogram(
		"transaction_amount",
		metric.WithDescription("Amount of transactions"),
		metric.WithUnit("currency"),
	)
	if err != nil {
		return nil, err
	}

	transactionErrors, err := meter.Int64Counter(
		"transaction_errors_total",
		metric.WithDescription("Total number of transaction errors"),
	)
	if err != nil {
		return nil, err
	}

	// Budget metrics
	budgetCreations, err := meter.Int64Counter(
		"budget_creations_total",
		metric.WithDescription("Total number of budget creations"),
	)
	if err != nil {
		return nil, err
	}

	budgetUpdates, err := meter.Int64Counter(
		"budget_updates_total",
		metric.WithDescription("Total number of budget updates"),
	)
	if err != nil {
		return nil, err
	}

	budgetExceeded, err := meter.Int64Counter(
		"budget_exceeded_total",
		metric.WithDescription("Total number of budget exceeded events"),
	)
	if err != nil {
		return nil, err
	}

	budgetUtilization, err := meter.Float64Histogram(
		"budget_utilization_percentage",
		metric.WithDescription("Budget utilization percentage"),
		metric.WithUnit("%"),
	)
	if err != nil {
		return nil, err
	}

	// Account metrics
	accountCreations, err := meter.Int64Counter(
		"account_creations_total",
		metric.WithDescription("Total number of account creations"),
	)
	if err != nil {
		return nil, err
	}

	accountBalance, err := meter.Float64Histogram(
		"account_balance",
		metric.WithDescription("Account balance amounts"),
		metric.WithUnit("currency"),
	)
	if err != nil {
		return nil, err
	}

	// Investment metrics
	investmentCreations, err := meter.Int64Counter(
		"investment_creations_total",
		metric.WithDescription("Total number of investment creations"),
	)
	if err != nil {
		return nil, err
	}

	investmentValue, err := meter.Float64Histogram(
		"investment_value",
		metric.WithDescription("Investment values"),
		metric.WithUnit("currency"),
	)
	if err != nil {
		return nil, err
	}

	investmentReturns, err := meter.Float64Histogram(
		"investment_returns_percentage",
		metric.WithDescription("Investment returns percentage"),
		metric.WithUnit("%"),
	)
	if err != nil {
		return nil, err
	}

	// Category metrics
	categoryCreations, err := meter.Int64Counter(
		"category_creations_total",
		metric.WithDescription("Total number of category creations"),
	)
	if err != nil {
		return nil, err
	}

	categoryUsage, err := meter.Int64Counter(
		"category_usage_total",
		metric.WithDescription("Total number of category usages"),
	)
	if err != nil {
		return nil, err
	}

	// Service performance metrics
	serviceOperationDuration, err := meter.Float64Histogram(
		"service_operation_duration_seconds",
		metric.WithDescription("Duration of service operations"),
		metric.WithUnit("s"),
	)
	if err != nil {
		return nil, err
	}

	serviceOperationCount, err := meter.Int64Counter(
		"service_operations_total",
		metric.WithDescription("Total number of service operations"),
	)
	if err != nil {
		return nil, err
	}

	serviceOperationErrors, err := meter.Int64Counter(
		"service_operation_errors_total",
		metric.WithDescription("Total number of service operation errors"),
	)
	if err != nil {
		return nil, err
	}

	// Database metrics
	databaseConnections, err := meter.Int64UpDownCounter(
		"database_connections",
		metric.WithDescription("Number of active database connections"),
	)
	if err != nil {
		return nil, err
	}

	databaseQueryDuration, err := meter.Float64Histogram(
		"database_query_duration_seconds",
		metric.WithDescription("Duration of database queries"),
		metric.WithUnit("s"),
	)
	if err != nil {
		return nil, err
	}

	databaseQueryCount, err := meter.Int64Counter(
		"database_queries_total",
		metric.WithDescription("Total number of database queries"),
	)
	if err != nil {
		return nil, err
	}

	databaseQueryErrors, err := meter.Int64Counter(
		"database_query_errors_total",
		metric.WithDescription("Total number of database query errors"),
	)
	if err != nil {
		return nil, err
	}

	// Cache metrics
	cacheHits, err := meter.Int64Counter(
		"cache_hits_total",
		metric.WithDescription("Total number of cache hits"),
	)
	if err != nil {
		return nil, err
	}

	cacheMisses, err := meter.Int64Counter(
		"cache_misses_total",
		metric.WithDescription("Total number of cache misses"),
	)
	if err != nil {
		return nil, err
	}

	cacheSize, err := meter.Int64UpDownCounter(
		"cache_size",
		metric.WithDescription("Current cache size"),
	)
	if err != nil {
		return nil, err
	}

	return &BusinessMetrics{
		UserRegistrations:        userRegistrations,
		UserLogins:               userLogins,
		UserLoginFailures:        userLoginFailures,
		ActiveUsers:              activeUsers,
		TransactionCount:         transactionCount,
		TransactionAmount:        transactionAmount,
		TransactionErrors:        transactionErrors,
		BudgetCreations:          budgetCreations,
		BudgetUpdates:            budgetUpdates,
		BudgetExceeded:           budgetExceeded,
		BudgetUtilization:        budgetUtilization,
		AccountCreations:         accountCreations,
		AccountBalance:           accountBalance,
		InvestmentCreations:      investmentCreations,
		InvestmentValue:          investmentValue,
		InvestmentReturns:        investmentReturns,
		CategoryCreations:        categoryCreations,
		CategoryUsage:            categoryUsage,
		ServiceOperationDuration: serviceOperationDuration,
		ServiceOperationCount:    serviceOperationCount,
		ServiceOperationErrors:   serviceOperationErrors,
		DatabaseConnections:      databaseConnections,
		DatabaseQueryDuration:    databaseQueryDuration,
		DatabaseQueryCount:       databaseQueryCount,
		DatabaseQueryErrors:      databaseQueryErrors,
		CacheHits:                cacheHits,
		CacheMisses:              cacheMisses,
		CacheSize:                cacheSize,
	}, nil
}

// Helper methods for common metric operations

// RecordUserRegistration records a user registration
func (m *BusinessMetrics) RecordUserRegistration(ctx context.Context, userType string) {
	m.UserRegistrations.Add(ctx, 1, metric.WithAttributes(
		attribute.String("user_type", userType),
	))
}

// RecordUserLogin records a successful user login
func (m *BusinessMetrics) RecordUserLogin(ctx context.Context, userID, method string) {
	m.UserLogins.Add(ctx, 1, metric.WithAttributes(
		attribute.String("user_id", userID),
		attribute.String("login_method", method),
	))
}

// RecordUserLoginFailure records a failed login attempt
func (m *BusinessMetrics) RecordUserLoginFailure(ctx context.Context, reason string) {
	m.UserLoginFailures.Add(ctx, 1, metric.WithAttributes(
		attribute.String("failure_reason", reason),
	))
}

// RecordTransaction records a transaction
func (m *BusinessMetrics) RecordTransaction(ctx context.Context, transactionType string, amount float64) {
	attrs := metric.WithAttributes(
		attribute.String("transaction_type", transactionType),
	)
	m.TransactionCount.Add(ctx, 1, attrs)
	m.TransactionAmount.Record(ctx, amount, attrs)
}

// RecordTransactionError records a transaction error
func (m *BusinessMetrics) RecordTransactionError(ctx context.Context, errorType string) {
	m.TransactionErrors.Add(ctx, 1, metric.WithAttributes(
		attribute.String("error_type", errorType),
	))
}

// RecordBudgetCreation records a budget creation
func (m *BusinessMetrics) RecordBudgetCreation(ctx context.Context, categoryID string) {
	m.BudgetCreations.Add(ctx, 1, metric.WithAttributes(
		attribute.String("category_id", categoryID),
	))
}

// RecordBudgetUpdate records a budget update
func (m *BusinessMetrics) RecordBudgetUpdate(ctx context.Context, categoryID string) {
	m.BudgetUpdates.Add(ctx, 1, metric.WithAttributes(
		attribute.String("category_id", categoryID),
	))
}

// RecordBudgetExceeded records when a budget is exceeded
func (m *BusinessMetrics) RecordBudgetExceeded(ctx context.Context, categoryID string, overAmount float64) {
	m.BudgetExceeded.Add(ctx, 1, metric.WithAttributes(
		attribute.String("category_id", categoryID),
		attribute.Float64("over_amount", overAmount),
	))
}

// RecordBudgetUtilization records budget utilization percentage
func (m *BusinessMetrics) RecordBudgetUtilization(ctx context.Context, categoryID string, utilizationPercent float64) {
	m.BudgetUtilization.Record(ctx, utilizationPercent, metric.WithAttributes(
		attribute.String("category_id", categoryID),
	))
}

// RecordServiceOperation records a service operation
func (m *BusinessMetrics) RecordServiceOperation(ctx context.Context, service, operation string, duration float64, success bool) {
	attrs := metric.WithAttributes(
		attribute.String("service", service),
		attribute.String("operation", operation),
		attribute.Bool("success", success),
	)

	m.ServiceOperationCount.Add(ctx, 1, attrs)
	m.ServiceOperationDuration.Record(ctx, duration, attrs)

	if !success {
		m.ServiceOperationErrors.Add(ctx, 1, attrs)
	}
}

// RecordDatabaseQuery records a database query
func (m *BusinessMetrics) RecordDatabaseQuery(ctx context.Context, queryType string, duration float64, success bool) {
	attrs := metric.WithAttributes(
		attribute.String("query_type", queryType),
		attribute.Bool("success", success),
	)

	m.DatabaseQueryCount.Add(ctx, 1, attrs)
	m.DatabaseQueryDuration.Record(ctx, duration, attrs)

	if !success {
		m.DatabaseQueryErrors.Add(ctx, 1, attrs)
	}
}

// Global metrics instance
var globalMetrics *BusinessMetrics

// InitializeGlobalMetrics initializes the global metrics instance
func InitializeGlobalMetrics(serviceName string) error {
	metrics, err := NewBusinessMetrics(serviceName)
	if err != nil {
		return err
	}
	globalMetrics = metrics
	return nil
}

// GetGlobalMetrics returns the global metrics instance
func GetGlobalMetrics() *BusinessMetrics {
	return globalMetrics
}

// RecordPanicMetric records a panic metric
func RecordPanicMetric(ctx context.Context, method, path string) {
	if globalMetrics != nil {
		globalMetrics.ServiceOperationErrors.Add(ctx, 1, metric.WithAttributes(
			attribute.String("method", method),
			attribute.String("path", path),
			attribute.String("error_type", "panic"),
		))
	}
}

// RecordErrorMetric records an error metric
func RecordErrorMetric(ctx context.Context, method, path, errorType, severity string) {
	if globalMetrics != nil {
		globalMetrics.ServiceOperationErrors.Add(ctx, 1, metric.WithAttributes(
			attribute.String("method", method),
			attribute.String("path", path),
			attribute.String("error_type", errorType),
			attribute.String("severity", severity),
		))
	}
}
