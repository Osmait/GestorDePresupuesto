package routes

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"

	"github.com/osmait/gestorDePresupuesto/internal/platform/telemetry"
)

// HealthResponse represents the health check response structure
type HealthResponse struct {
	Status      string                 `json:"status"`
	Timestamp   time.Time              `json:"timestamp"`
	Version     string                 `json:"version"`
	Environment string                 `json:"environment"`
	Uptime      string                 `json:"uptime"`
	Checks      map[string]HealthCheck `json:"checks"`
}

// HealthCheck represents an individual health check result
type HealthCheck struct {
	Status  string      `json:"status"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

var startTime = time.Now()

// HealthRoutes configures health check endpoints.
//
// /health, /health/live and /health/ready stay public (Railway / load
// balancer probes). /health/detailed returns only the overall and per-check
// status to anonymous callers; the full payload (pool stats, uptime, error
// messages, environment) requires "Authorization: Bearer <internalToken>"
// (METRICS_TOKEN). With an empty token the details are never served.
func HealthRoutes(engine *gin.Engine, db *sql.DB, version, environment, internalToken string) {
	// Basic health check - always returns OK
	engine.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message":   "pong",
			"timestamp": time.Now().Unix(),
		})
	})

	// Simple health check
	engine.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().Unix(),
		})
	})

	// Comprehensive health check
	engine.GET("/health/detailed", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
		defer cancel()

		checks := make(map[string]HealthCheck)
		overallStatus := "healthy"

		// Database health check
		dbCheck := checkDatabase(ctx, db)
		checks["database"] = dbCheck
		if dbCheck.Status != "healthy" {
			overallStatus = "unhealthy"
		}

		// Memory health check
		memoryCheck := checkMemory()
		checks["memory"] = memoryCheck
		if memoryCheck.Status != "healthy" {
			overallStatus = "degraded"
		}

		// Application health check
		appCheck := checkApplication()
		checks["application"] = appCheck
		if appCheck.Status != "healthy" {
			overallStatus = "unhealthy"
		}

		response := HealthResponse{
			Status:      overallStatus,
			Timestamp:   time.Now(),
			Version:     version,
			Environment: environment,
			Uptime:      time.Since(startTime).String(),
			Checks:      checks,
		}

		statusCode := http.StatusOK
		switch overallStatus {
		case "unhealthy":
			statusCode = http.StatusServiceUnavailable
		case "degraded":
			statusCode = http.StatusOK // Still return 200 for degraded
		}

		if !telemetry.ValidBearer(c.GetHeader("Authorization"), internalToken) {
			c.JSON(statusCode, trimHealth(response))
			return
		}
		c.JSON(statusCode, response)
	})

	// Readiness probe (for Kubernetes)
	engine.GET("/health/ready", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		// Check if we can connect to the database. The driver error (host
		// names, users) is logged, never returned to the anonymous caller.
		if err := db.PingContext(ctx); err != nil {
			log.Warn().Err(err).Msg("readiness check: database ping failed")
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status": "not ready",
				"reason": "database connection failed",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":    "ready",
			"timestamp": time.Now().Unix(),
		})
	})

	// Liveness probe (for Kubernetes)
	engine.GET("/health/live", func(c *gin.Context) {
		// Simple check that the application is running
		c.JSON(http.StatusOK, gin.H{
			"status":    "alive",
			"timestamp": time.Now().Unix(),
			"uptime":    time.Since(startTime).String(),
		})
	})

}

// trimHealth strips everything but statuses from a detailed health response.
func trimHealth(r HealthResponse) gin.H {
	checks := make(map[string]gin.H, len(r.Checks))
	for name, chk := range r.Checks {
		checks[name] = gin.H{"status": chk.Status}
	}
	return gin.H{
		"status":    r.Status,
		"timestamp": r.Timestamp,
		"checks":    checks,
	}
}

// checkDatabase verifies database connectivity and basic functionality
func checkDatabase(ctx context.Context, db *sql.DB) HealthCheck {
	if db == nil {
		return HealthCheck{
			Status:  "unhealthy",
			Message: "database connection is nil",
		}
	}

	// Test basic connectivity
	if err := db.PingContext(ctx); err != nil {
		return HealthCheck{
			Status:  "unhealthy",
			Message: "database ping failed: " + err.Error(),
		}
	}

	// Test basic query execution
	var result int
	query := "SELECT 1"
	if err := db.QueryRowContext(ctx, query).Scan(&result); err != nil {
		return HealthCheck{
			Status:  "unhealthy",
			Message: "database query failed: " + err.Error(),
		}
	}

	// Get database stats
	stats := db.Stats()
	return HealthCheck{
		Status:  "healthy",
		Message: "database connection is working",
		Data: map[string]interface{}{
			"open_connections":    stats.OpenConnections,
			"in_use":              stats.InUse,
			"idle":                stats.Idle,
			"wait_count":          stats.WaitCount,
			"wait_duration":       stats.WaitDuration.String(),
			"max_idle_closed":     stats.MaxIdleClosed,
			"max_lifetime_closed": stats.MaxLifetimeClosed,
		},
	}
}

// checkMemory performs basic memory health checks
func checkMemory() HealthCheck {
	// This is a placeholder for memory checks
	// In a real application, you would use runtime.ReadMemStats()
	// and check for memory pressure, GC frequency, etc.

	return HealthCheck{
		Status:  "healthy",
		Message: "memory usage is normal",
		Data: map[string]interface{}{
			"note": "memory monitoring not implemented",
		},
	}
}

// checkApplication performs application-specific health checks
func checkApplication() HealthCheck {
	// This is where you would check application-specific health
	// For example:
	// - Critical service dependencies
	// - Configuration validity
	// - Cache connectivity
	// - External API availability

	uptime := time.Since(startTime)

	return HealthCheck{
		Status:  "healthy",
		Message: "application is running normally",
		Data: map[string]interface{}{
			"uptime_seconds": uptime.Seconds(),
			"start_time":     startTime.Format(time.RFC3339),
		},
	}
}
