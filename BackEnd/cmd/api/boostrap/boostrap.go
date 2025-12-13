package boostrap

import (
	"context"
	"database/sql"
	"fmt"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"

	"github.com/osmait/gestorDePresupuesto/internal/config"
	"github.com/osmait/gestorDePresupuesto/internal/platform/observability"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	analyticsRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/analytics"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	investmentRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/investment"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/osmait/gestorDePresupuesto/internal/services/account"
	"github.com/osmait/gestorDePresupuesto/internal/services/analytics"
	"github.com/osmait/gestorDePresupuesto/internal/services/auth"
	"github.com/osmait/gestorDePresupuesto/internal/services/budget"
	"github.com/osmait/gestorDePresupuesto/internal/services/category"
	"github.com/osmait/gestorDePresupuesto/internal/services/investment"
	"github.com/osmait/gestorDePresupuesto/internal/services/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/user"
)

func Run() error {
	// Create application context that can be cancelled
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Load configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	// Initialize observability (logging only)
	logger, err := initializeLogger(cfg)
	if err != nil {
		return fmt.Errorf("failed to initialize logger: %w", err)
	}

	logger.WithField("config", map[string]interface{}{
		"environment": cfg.Server.Environment,
		"host":        cfg.Server.Host,
		"port":        cfg.Server.Port,
		"db_type":     cfg.Database.Type,
		"tracing":     cfg.FeatureFlags.EnableTracing,
		"metrics":     cfg.FeatureFlags.EnableMetrics,
	}).Info("Starting application")

	// Connect to database
	db, err := initializeDatabase(ctx, cfg, logger)
	if err != nil {
		return fmt.Errorf("failed to initialize database: %w", err)
	}
	defer func() {
		if err := db.Close(); err != nil {
			logger.WithError(err).Error("Failed to close database connection")
		}
	}()

	// Run database migrations
	if err := runMigrations(cfg, logger); err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	// Initialize repositories
	repositories := initializeRepositories(db)

	// Initialize services
	services := initializeServices(repositories, cfg)

	// Initialize and start server
	serverCtx, srv := server.New(
		ctx,
		cfg.Server.Host,
		cfg.Server.Port,
		&cfg.Server.ShutdownTimeout,
		services.accountService,
		services.transactionService,
		services.userService,
		services.authService,
		services.budgetService,
		services.categoryService,
		services.analyticsService,
		db,
		cfg,
	)

	logger.Infof("Server starting on %s:%d", cfg.Server.Host, cfg.Server.Port)

	// Start server
	if err := srv.Run(serverCtx); err != nil {
		return fmt.Errorf("server failed: %w", err)
	}

	logger.Info("Application shutdown completed")
	return nil
}

// initializeLogger sets up the logger
func initializeLogger(cfg *config.Config) (*observability.Logger, error) {
	// Initialize structured logger
	loggerCfg := &observability.LoggerConfig{
		Level:      cfg.Logging.Level,
		Format:     cfg.Logging.Format,
		Output:     cfg.Logging.Output,
		TimeFormat: time.RFC3339,
		Caller:     cfg.IsDevelopment(),
	}
	logger := observability.NewLogger(loggerCfg)
	observability.InitializeGlobalLogger(loggerCfg)

	return logger, nil
}

// initializeDatabase connects to the database
func initializeDatabase(ctx context.Context, cfg *config.Config, logger *observability.Logger) (*sql.DB, error) {
	var databaseURL string
	var driverName string

	switch cfg.Database.Type {
	case config.DatabaseTypeSQLite:
		databaseURL = cfg.GetSQLiteUrl()
		driverName = "sqlite3"
	case config.DatabaseTypePostgres:
		databaseURL = cfg.GetPostgresUrl()
		driverName = "postgres"
	default:
		return nil, fmt.Errorf("unsupported database type: %s", cfg.Database.Type)
	}

	logger.WithFields(map[string]interface{}{
		"driver": driverName,
		"type":   cfg.Database.Type,
	}).Info("Connecting to database")

	db, err := sql.Open(driverName, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	db.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.Database.ConnMaxLifetime)
	db.SetConnMaxIdleTime(cfg.Database.ConnMaxIdleTime)

	// Test connection
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	logger.Info("Database connection established successfully")
	return db, nil
}

// runMigrations runs database migrations
func runMigrations(cfg *config.Config, logger *observability.Logger) error {
	logger.Info("Running database migrations")

	switch cfg.Database.Type {
	case config.DatabaseTypePostgres:
		utils.RunDBMigration("file://cmd/api/db/migrations", cfg.GetPostgresUrl())
		return nil
	case config.DatabaseTypeSQLite:
		utils.RunSQLiteMigration("cmd/api/db/migrations", cfg.GetSQLiteUrl())
		return nil
	default:
		return fmt.Errorf("unsupported database type for migrations: %s", cfg.Database.Type)
	}
}

// repositories holds all repository interfaces
type repositories struct {
	accountRepository     accountRepo.AccountRepositoryInterface
	transactionRepository transactionRepo.TransactionRepositoryInterface
	userRepository        userRepo.UserRepositoryInterface
	budgetRepository      budgetRepo.BudgetRepoInterface
	categoryRepository    categoryRepo.CategoryRepoInterface
	investmentRepository  investmentRepo.InvestmentRepoInterface
	analyticsRepository   *analyticsRepo.AnalyticsRepository
}

// initializeRepositories creates all repository instances
func initializeRepositories(db *sql.DB) *repositories {
	return &repositories{
		accountRepository:     accountRepo.NewAccountRepository(db),
		transactionRepository: transactionRepo.NewTransactionRepository(db),
		userRepository:        userRepo.NewUserRepository(db),
		budgetRepository:      budgetRepo.NewBudgetRepository(db),
		categoryRepository:    categoryRepo.NewCategoryRepository(db),
		investmentRepository:  investmentRepo.NewInvestmentRepository(db),
		analyticsRepository:   analyticsRepo.NewAnalyticsRepository(db),
	}
}

// services holds all service instances
type services struct {
	accountService     *account.AccountService
	transactionService *transaction.TransactionService
	userService        *user.UserService
	authService        *auth.AuthService
	budgetService      *budget.BudgetServices
	categoryService    *category.CategoryServices
	investmentService  *investment.InvestmentServices
	analyticsService   *analytics.AnalyticsService
}

// initializeServices creates all service instances
func initializeServices(repos *repositories, cfg *config.Config) *services {
	return &services{
		accountService:     account.NewAccountService(repos.accountRepository),
		transactionService: transaction.NewTransactionService(repos.transactionRepository, repos.budgetRepository),
		userService:        user.NewUserService(repos.userRepository),
		authService:        auth.NewAuthService(repos.userRepository, cfg),
		budgetService:      budget.NewBudgetServices(repos.budgetRepository, repos.transactionRepository),
		categoryService:    category.NewCategoryServices(repos.categoryRepository),
		investmentService:  investment.NewInvestmentServices(repos.investmentRepository),
		analyticsService:   analytics.NewAnalyticsService(repos.analyticsRepository),
	}
}
