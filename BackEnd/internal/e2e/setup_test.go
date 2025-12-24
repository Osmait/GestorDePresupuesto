//go:build e2e
// +build e2e

package e2e

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/suite"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/osmait/gestorDePresupuesto/internal/config"
	"github.com/osmait/gestorDePresupuesto/internal/e2e/helpers"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/routes"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	accountSvc "github.com/osmait/gestorDePresupuesto/internal/services/account"
	authSvc "github.com/osmait/gestorDePresupuesto/internal/services/auth"
	budgetSvc "github.com/osmait/gestorDePresupuesto/internal/services/budget"
	categorySvc "github.com/osmait/gestorDePresupuesto/internal/services/category"
	transactionSvc "github.com/osmait/gestorDePresupuesto/internal/services/transaction"
	userSvc "github.com/osmait/gestorDePresupuesto/internal/services/user"

	_ "github.com/lib/pq"
	cors "github.com/rs/cors/wrapper/gin"
)

// E2ETestSuite defines the test suite for end-to-end tests
type E2ETestSuite struct {
	suite.Suite
	server      *httptest.Server
	engine      *gin.Engine
	dbContainer *postgres.PostgresContainer
	db          *sql.DB
	config      *config.Config
	authToken   string
	testUserID  string
	helpers     *helpers.TestHelpers
}

// SetupSuite runs once before all tests in the suite
func (suite *E2ETestSuite) SetupSuite() {
	ctx := context.Background()

	// Setup test database with testcontainers
	log.Println("Setting up test database container...")
	dbContainer, err := postgres.RunContainer(ctx,
		testcontainers.WithImage("postgres:15-alpine"),
		postgres.WithDatabase("e2e_testdb"),
		postgres.WithUsername("e2e_user"),
		postgres.WithPassword("e2e_password"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	suite.Require().NoError(err)
	suite.dbContainer = dbContainer

	// Get database connection string
	host, err := dbContainer.Host(ctx)
	suite.Require().NoError(err)

	port, err := dbContainer.MappedPort(ctx, "5432")
	suite.Require().NoError(err)

	// Setup test configuration
	suite.config = &config.Config{
		Database: config.DatabaseConfig{
			Host:            host,
			Port:            uint(port.Int()),
			User:            "e2e_user",
			Password:        "e2e_password",
			Name:            "e2e_testdb",
			Type:            "postgres",
			MaxOpenConns:    10,
			MaxIdleConns:    5,
			SSLMode:         "disable",
			ConnMaxLifetime: 10 * time.Minute,
			ConnMaxIdleTime: 5 * time.Minute,
		},
		Server: config.ServerConfig{
			Port:            8080,
			Host:            "localhost",
			Environment:     "test",
			ShutdownTimeout: 30 * time.Second,
			ReadTimeout:     30 * time.Second,
			WriteTimeout:    30 * time.Second,
			IdleTimeout:     60 * time.Second,
		},
		JWT: config.JWTConfig{
			Secret:            "e2e-test-secret-key-very-long-and-secure",
			Expiration:        24 * time.Hour,
			RefreshExpiration: 7 * 24 * time.Hour,
			Issuer:            "e2e-test",
			Algorithm:         "HS256",
		},
		Logging: config.LoggingConfig{
			Level:  "error", // Reduce noise during tests
			Format: "json",
			Output: "stdout",
			Caller: false,
		},
		FeatureFlags: config.FeatureFlagsConfig{
			EnableMetrics:     false,
			EnableTracing:     false,
			EnableHealthCheck: true,
			EnableSwaggerDocs: false,
			EnableProfiling:   false,
			EnableDebugMode:   false,
		},
		Middleware: config.MiddlewareConfig{
			EnableLogging:        false,
			EnableTracing:        false,
			EnableMetrics:        false,
			EnableRecovery:       true,
			EnableRateLimit:      false,
			EnableCORS:           true,
			EnableCompression:    false,
			EnableAuthentication: true,
			EnableValidation:     true,
		},
		Security: config.SecurityConfig{
			PasswordMinLength:     8,
			PasswordRequireUpper:  false,
			PasswordRequireLower:  false,
			PasswordRequireDigit:  false,
			PasswordRequireSymbol: false,
			MaxLoginAttempts:      5,
			AccountLockTime:       15 * time.Minute,
			SessionTimeout:        24 * time.Hour,
			EnableTLS:             false,
		},
		CORS: config.CORSConfig{
			AllowedOrigins:   []string{"*"},
			AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"*"},
			AllowCredentials: false,
		},
	}

	// Setup database connection
	suite.db, err = sql.Open("postgres", suite.config.GetDatabaseUrl())
	suite.Require().NoError(err)

	// Test the connection
	err = suite.db.Ping()
	suite.Require().NoError(err)

	// Setup database schema
	log.Println("Setting up database schema...")
	err = utils.SetupPostgreSQLSchema(suite.db)
	suite.Require().NoError(err)

	// Setup test server
	gin.SetMode(gin.TestMode)
	suite.engine = gin.New()

	// Setup services
	suite.setupServices()

	// Setup test server
	suite.server = httptest.NewServer(suite.engine)

	log.Printf("Test server started at: %s", suite.server.URL)

	// Initialize test helpers
	suite.helpers = helpers.NewTestHelpers(suite.server.URL, suite.config)

	// Wait for server to be ready
	time.Sleep(2 * time.Second)
}

// setupServices initializes all services required for testing
func (suite *E2ETestSuite) setupServices() {
	// Repository layer
	userRepository := userRepo.NewUserRepository(suite.db) // Note: this is the actual function name
	accountRepository := accountRepo.NewAccountRepository(suite.db)
	categoryRepository := categoryRepo.NewCategoryRepository(suite.db)
	budgetRepository := budgetRepo.NewBudgetRepository(suite.db)
	transactionRepository := transactionRepo.NewTransactionRepository(suite.db)

	// Service layer
	userService := userSvc.NewUserService(userRepository)
	authService := authSvc.NewAuthService(userRepository, suite.config)
	accountService := accountSvc.NewAccountService(accountRepository)
	categoryService := categorySvc.NewCategoryServices(categoryRepository)                // Fixed name
	budgetService := budgetSvc.NewBudgetServices(budgetRepository, transactionRepository) // Fixed name and added second parameter
	transactionService := transactionSvc.NewTransactionService(transactionRepository)

	// Setup routes
	suite.setupRoutes(userService, authService, accountService, categoryService, budgetService, transactionService)
}

// setupRoutes configures all routes for the test server
func (suite *E2ETestSuite) setupRoutes(
	userService *userSvc.UserService,
	authService *authSvc.AuthService,
	accountService *accountSvc.AccountService,
	categoryService *categorySvc.CategoryServices, // Fixed type name
	budgetService *budgetSvc.BudgetServices, // Fixed type name
	transactionService *transactionSvc.TransactionService,
) {
	// Basic middleware
	suite.engine.Use(cors.AllowAll())

	// Error handling middleware
	suite.engine.Use(middleware.ErrorHandler(middleware.DefaultErrorHandlerConfig()))

	// Health routes (before authentication)
	routes.HealthRoutes(suite.engine, suite.db, "1.0.0", string(suite.config.Server.Environment))

	// Authentication middleware for protected routes
	suite.engine.Use(middleware.AuthMiddleware(userService, suite.config))

	// Application routes
	routes.AuhtRoutes(suite.engine, authService)
	routes.UserRoute(suite.engine, userService)
	routes.AccountRotes(suite.engine, accountService)
	routes.TransactionRoutes(suite.engine, transactionService)
	routes.CategoryRoutes(suite.engine, categoryService)
	routes.BudgetRoutes(suite.engine, budgetService)
}

// TearDownSuite runs once after all tests in the suite
func (suite *E2ETestSuite) TearDownSuite() {
	log.Println("Tearing down test suite...")

	if suite.helpers != nil {
		suite.helpers.Close()
	}

	if suite.server != nil {
		suite.server.Close()
	}

	if suite.db != nil {
		suite.db.Close()
	}

	if suite.dbContainer != nil {
		ctx := context.Background()
		if err := suite.dbContainer.Terminate(ctx); err != nil {
			log.Printf("Error terminating container: %v", err)
		}
	}
}

// SetupTest runs before each individual test
func (suite *E2ETestSuite) SetupTest() {
	// Clean database before each test
	suite.cleanDatabase()

	// Reset auth token
	suite.authToken = ""
	suite.testUserID = ""
}

// TearDownTest runs after each individual test
func (suite *E2ETestSuite) TearDownTest() {
	// Additional cleanup if needed
}

// cleanDatabase removes all data from test database
func (suite *E2ETestSuite) cleanDatabase() {
	if suite.helpers == nil {
		return
	}

	// Clean tables in correct order (respecting foreign keys)
	tables := []string{
		"transactions",
		"budgets",
		"account",   // Note: singular, not plural
		"categorys", // Note: this is how it's named in the schema
		"users",
	}

	for _, table := range tables {
		query := fmt.Sprintf("DELETE FROM %s", table)
		suite.helpers.ExecuteSQL(query)
	}
}

// TestMain is the entry point for running E2E tests
func TestMain(m *testing.M) {
	// Set required environment for Docker
	if os.Getenv("DOCKER_HOST") == "" {
		os.Setenv("DOCKER_HOST", "unix:///var/run/docker.sock")
	}

	// Run tests
	exitCode := m.Run()

	// Exit with the test result code
	os.Exit(exitCode)
}

// TestE2ETestSuite runs the entire E2E test suite
func TestE2ETestSuite(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E tests in short mode")
	}

	suite.Run(t, new(E2ETestSuite))
}
