package boostrap

import (
	"context"
	"database/sql"
	"fmt"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata" // embed the IANA database so APP_TIMEZONE works on minimal images

	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"

	migrationsdb "github.com/osmait/gestorDePresupuesto/cmd/api/db"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	domainAI "github.com/osmait/gestorDePresupuesto/internal/domain/ai"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	userDomain "github.com/osmait/gestorDePresupuesto/internal/domain/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/cache"
	"github.com/osmait/gestorDePresupuesto/internal/platform/mcp"
	"github.com/osmait/gestorDePresupuesto/internal/platform/observability"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	analyticsRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/analytics"
	apikeyRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/apikey"
	authRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/auth"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	certificateRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/certificate"
	creditcardRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/creditcard"
	investmentRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/investment"
	loanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/loan"
	mcpOAuthRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/mcpoauth"
	monthlyPlanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/monthly_plan"
	notificationRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/notification"
	passkeyRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/passkey"
	recurringRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/recurring_transaction"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/telemetry"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/osmait/gestorDePresupuesto/internal/platform/worker"
	"github.com/osmait/gestorDePresupuesto/internal/services/account"
	aiService "github.com/osmait/gestorDePresupuesto/internal/services/ai"
	"github.com/osmait/gestorDePresupuesto/internal/services/ai/providers/gemini"
	"github.com/osmait/gestorDePresupuesto/internal/services/ai/tasks"
	"github.com/osmait/gestorDePresupuesto/internal/services/analytics"
	"github.com/osmait/gestorDePresupuesto/internal/services/apikey"
	passkeySvc "github.com/osmait/gestorDePresupuesto/internal/services/passkey"

	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/osmait/gestorDePresupuesto/internal/services/auth"
	"github.com/osmait/gestorDePresupuesto/internal/services/budget"
	"github.com/osmait/gestorDePresupuesto/internal/services/category"
	"github.com/osmait/gestorDePresupuesto/internal/services/certificate"
	"github.com/osmait/gestorDePresupuesto/internal/services/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/services/exchange"
	"github.com/osmait/gestorDePresupuesto/internal/services/investment"
	"github.com/osmait/gestorDePresupuesto/internal/services/loan"
	"github.com/osmait/gestorDePresupuesto/internal/services/monthly_plan"
	"github.com/osmait/gestorDePresupuesto/internal/services/notification"
	"github.com/osmait/gestorDePresupuesto/internal/services/quote"
	"github.com/osmait/gestorDePresupuesto/internal/services/recurring_transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/search"
	"github.com/osmait/gestorDePresupuesto/internal/services/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/user"
	"github.com/plexusone/omniskill/mcp/oauth2"
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
		"metrics":     cfg.Metrics.Enabled,
	}).Info("Starting application")

	// OpenTelemetry tracing/metrics: a no-op unless ENABLE_TRACING or
	// METRICS_ENABLED is set.
	tel, err := telemetry.Setup(ctx, cfg)
	if err != nil {
		return fmt.Errorf("failed to initialize telemetry: %w", err)
	}
	defer func() {
		shCtx, shCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shCancel()
		if err := tel.Shutdown(shCtx); err != nil {
			logger.WithError(err).Warn("Telemetry shutdown failed")
		}
	}()
	if tel.Enabled() {
		logger.WithFields(map[string]interface{}{
			"tracing":       tel.TracingEnabled(),
			"metrics":       tel.MetricsEnabled(),
			"otlp_endpoint": cfg.OpenTelemetry.OTLPEndpoint,
			"otlp_protocol": cfg.OpenTelemetry.OTLPProtocol,
			"sampling_rate": cfg.OpenTelemetry.SamplingRate,
			"exporters":     cfg.Metrics.Exporters,
		}).Info("Telemetry enabled")
	}

	// Connect to database
	db, err := initializeDatabase(ctx, cfg, tel, logger)
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

	// Wire repositories, services and the HTTP router.
	app, err := NewAppWithTelemetry(ctx, cfg, db, tel)
	if err != nil {
		return err
	}

	// Seed admin user if configured
	if err := seedAdminUser(ctx, cfg, app.repos, logger); err != nil {
		return fmt.Errorf("failed to seed admin user: %w", err)
	}

	// Start background workers
	scheduler := worker.NewTransactionScheduler(app.services.recurringService)
	scheduler.Start(ctx)

	demoCleanupWorker := worker.NewDemoCleanupWorker(app.services.userService, 24*time.Hour)
	demoCleanupWorker.Start(ctx)

	logger.Infof("Server starting on %s:%d", cfg.Server.Host, cfg.Server.Port)

	// Start server
	if err := app.Server.Run(app.Ctx); err != nil {
		return fmt.Errorf("server failed: %w", err)
	}

	logger.Info("Application shutdown completed")
	return nil
}

// App is the fully wired application: repositories, services and the HTTP
// router, built exactly as production builds them.
type App struct {
	// Ctx is the server context returned by server.New (cancelled on SIGINT).
	Ctx context.Context
	// Server holds the gin engine with every middleware and route registered.
	Server *server.Server

	repos    *repositories
	services *services
}

// NewApp wires repositories, services, the optional MCP/OAuth servers and the
// HTTP router on top of an already-migrated database. It does not listen on a
// port, seed data or start background workers, so tests (e.g. the e2e suite)
// can serve app.Server.Engine through httptest and exercise the same
// middleware chain (auth, RLS transactions, rate limiting, CORS) as production.
func NewApp(ctx context.Context, cfg *config.Config, db *sql.DB) (*App, error) {
	return NewAppWithTelemetry(ctx, cfg, db, telemetry.Disabled())
}

// NewAppWithTelemetry is NewApp with the HTTP server instrumented by tel.
func NewAppWithTelemetry(ctx context.Context, cfg *config.Config, db *sql.DB, tel *telemetry.Telemetry) (*App, error) {
	repos := initializeRepositories(db)

	svcs, err := initializeServices(repos, cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize services: %w", err)
	}

	// Conditionally create the MCP server if enabled in config
	var mcpServer *mcp.MCPServer
	var oauthSrv *mcp.OAuthProvider
	if cfg.MCP.Enabled {
		mcpServer = mcp.NewMCPServer(cfg.MCP.ServerName, cfg.MCP.ServerVersion, &mcp.Services{
			Account:     svcs.accountService,
			Transaction: svcs.transactionService,
			Category:    svcs.categoryService,
			Budget:      svcs.budgetService,
			Analytics:   svcs.analyticsService,
			CreditCard:  svcs.creditCardService,
			Loan:        svcs.loanService,
			Recurring:   svcs.recurringService,
			MonthlyPlan: svcs.monthlyPlanService,
			Search:      svcs.searchService,
		}, db)

		issuer := cfg.MCP.BaseURL
		if issuer == "" {
			issuer = fmt.Sprintf("http://%s:%d", cfg.Server.Host, cfg.Server.Port)
		}
		// OAuth clients, codes and tokens live in PostgreSQL so a redeploy
		// does not disconnect Claude. Other database types (SQLite, local
		// development only) keep them in memory.
		var oauthStorage oauth2.Storage
		if cfg.Database.Type == config.DatabaseTypePostgres {
			oauthStorage = mcpOAuthRepo.New(db)
		} else {
			log.Warn().Str("db_type", string(cfg.Database.Type)).
				Msg("MCP OAuth state is kept in memory: Claude connections are lost on restart")
		}
		oauthSrv, err = mcp.NewOAuthProvider(mcp.OAuthConfig{
			Issuer:        issuer,
			Authenticator: mcp.AuthServiceAuthenticator{Service: svcs.authService},
			Storage:       oauthStorage,
			AppURL:        cfg.MCP.AppURL,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create OAuth server: %w", err)
		}
	}

	serverCtx, srv := server.New(
		ctx,
		cfg.Server.Host,
		cfg.Server.Port,
		&cfg.Server.ShutdownTimeout,
		svcs.accountService,
		svcs.transactionService,
		svcs.userService,
		svcs.authService,
		svcs.budgetService,
		svcs.categoryService,
		svcs.analyticsService,
		svcs.recurringService,
		svcs.monthlyPlanService,
		svcs.searchService,
		svcs.investmentService,
		db,
		cfg,
		svcs.quoteService,
		svcs.notificationService,
		svcs.aiService,
		svcs.aiCache,
		repos.categoryRepository,
		repos.transactionRepository,
		svcs.certificateService,
		svcs.creditCardService,
		svcs.loanService,
		svcs.exchangeService,
		svcs.apiKeyService,
		svcs.passkeyService,
		mcpServer,
		oauthSrv,
		server.WithTelemetry(tel),
	)

	return &App{Ctx: serverCtx, Server: srv, repos: repos, services: svcs}, nil
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
	// Code using the zerolog global logger with .Ctx(ctx) gets
	// request_id/trace_id/span_id too.
	log.Logger = log.Logger.Hook(observability.TraceHook{})

	return logger, nil
}

// initializeDatabase connects to the database
func initializeDatabase(ctx context.Context, cfg *config.Config, tel *telemetry.Telemetry, logger *observability.Logger) (*sql.DB, error) {
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

	// Plain sql.Open unless telemetry is enabled (then otelsql: query spans
	// and pool metrics).
	db, err := telemetry.OpenDB(tel, driverName, databaseURL)
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
		_ = db.Close()
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
		// Migrations are embedded in the binary, so this does not depend on the
		// process working directory. A dirty migration state is returned as an
		// error and the application refuses to start.
		return utils.RunMigrationsFromFS(migrationsdb.Migrations, migrationsdb.MigrationsDir, cfg.GetPostgresUrl())
	default:
		return fmt.Errorf("unsupported database type for migrations: %s", cfg.Database.Type)
	}
}

// repositories holds all repository interfaces
type repositories struct {
	accountRepository      accountRepo.AccountRepositoryInterface
	reconciliationRepo     accountRepo.ReconciliationRepositoryInterface
	transactionRepository  transactionRepo.TransactionRepositoryInterface
	userRepository         userRepo.UserRepositoryInterface
	budgetRepository       budgetRepo.BudgetRepoInterface
	categoryRepository     categoryRepo.CategoryRepoInterface
	investmentRepository   investmentRepo.InvestmentRepoInterface
	analyticsRepository    *analyticsRepo.AnalyticsRepository
	recurringRepository    *recurringRepo.RecurringTransactionRepository
	monthlyPlanRepository  monthlyPlanRepo.MonthlyPlanRepoInterface
	notificationRepository *notificationRepo.NotificationRepository
	refreshTokenRepository authRepo.RefreshTokenRepositoryInterface
	certificateRepository  certificateRepo.CertificateRepositoryInterface
	creditCardRepository   creditcardRepo.CreditCardRepositoryInterface
	loanRepository         loanRepo.LoanRepositoryInterface
	apiKeyRepository       apikeyRepo.APIKeyRepositoryInterface
	passkeyRepository      passkeyRepo.PasskeyRepositoryInterface
}

// initializeRepositories creates all repository instances
func initializeRepositories(db *sql.DB) *repositories {
	return &repositories{
		accountRepository:      accountRepo.NewAccountRepository(db),
		reconciliationRepo:     accountRepo.NewReconciliationRepository(db),
		transactionRepository:  transactionRepo.NewTransactionRepository(db),
		userRepository:         userRepo.NewUserRepository(db),
		budgetRepository:       budgetRepo.NewBudgetRepository(db),
		categoryRepository:     categoryRepo.NewCategoryRepository(db),
		investmentRepository:   investmentRepo.NewInvestmentRepository(db),
		analyticsRepository:    analyticsRepo.NewAnalyticsRepository(db),
		recurringRepository:    recurringRepo.NewRecurringTransactionRepository(db),
		monthlyPlanRepository:  monthlyPlanRepo.NewMonthlyPlanRepository(db),
		notificationRepository: notificationRepo.NewNotificationRepository(db),
		refreshTokenRepository: authRepo.NewRefreshTokenRepository(db),
		certificateRepository:  certificateRepo.NewCertificateRepository(db),
		creditCardRepository:   creditcardRepo.NewCreditCardRepository(db),
		loanRepository:         loanRepo.NewLoanRepository(db),
		apiKeyRepository:       apikeyRepo.NewAPIKeyRepository(db),
		passkeyRepository:      passkeyRepo.NewPasskeyRepository(db),
	}
}

// services holds all service instances
type services struct {
	accountService      *account.AccountService
	transactionService  *transaction.TransactionService
	userService         *user.UserService
	authService         *auth.AuthService
	budgetService       *budget.BudgetServices
	categoryService     *category.CategoryServices
	investmentService   *investment.InvestmentService
	analyticsService    *analytics.AnalyticsService
	recurringService    *recurring_transaction.RecurringTransactionService
	monthlyPlanService  *monthly_plan.MonthlyPlanService
	searchService       *search.SearchService
	quoteService        *quote.QuoteService
	notificationService *notification.NotificationService
	aiService           *aiService.Service
	aiCache             *aiService.AICacheService
	certificateService  *certificate.CertificateService
	creditCardService   *creditcard.CreditCardService
	loanService         *loan.LoanService
	exchangeService     *exchange.ExchangeRateService
	apiKeyService       *apikey.APIKeyService
	passkeyService      *passkeySvc.PasskeyService
}

// initializeServices creates all service instances
func initializeServices(repos *repositories, cfg *config.Config) (*services, error) {
	appLocation, err := time.LoadLocation(cfg.Server.Timezone)
	if err != nil {
		return nil, fmt.Errorf("invalid APP_TIMEZONE %q: %w", cfg.Server.Timezone, err)
	}

	// Services
	quoteService := quote.NewQuoteService()

	notificationService := notification.NewNotificationService(repos.notificationRepository)

	// Initialize AI Service first (needed for cache)
	aiSvc := initializeAIService(cfg)

	// Create AI cache service
	transactionCache := cache.NewInMemoryCache(5*time.Minute, 10*time.Minute)
	var aiCacheInvalidator transaction.AICacheInvalidator
	var aiCacheSvc *aiService.AICacheService
	if aiSvc != nil {
		aiCacheSvc = aiService.NewAICacheService(transactionCache)
		aiCacheInvalidator = aiCacheSvc
	}

	exchangeService := exchange.NewExchangeRateService()

	usdToDopRateFn := func(ctx context.Context) (money.Amount, error) {
		rateResp, err := exchangeService.GetUSDtoDOP(ctx)
		if err != nil {
			return money.Zero, err
		}
		return rateResp.USDToDOP, nil
	}

	transactionService := transaction.NewTransactionService(repos.transactionRepository, repos.budgetRepository, notificationService, transactionCache, aiCacheInvalidator, usdToDopRateFn)

	certificateService := certificate.NewCertificateService(repos.certificateRepository, transactionService, repos.accountRepository)

	creditCardService := creditcard.NewCreditCardService(repos.creditCardRepository, repos.accountRepository, transactionService)
	loanService := loan.NewLoanService(repos.loanRepository, transactionService, repos.accountRepository, repos.categoryRepository)

	userService := user.NewUserService(repos.userRepository)
	// Short-TTL cache for the auth middleware's per-request user lookup
	// (AUTH_USER_CACHE_TTL); user mutations invalidate it.
	userService.EnableAuthCache(cfg.Cache.AuthUserTTL)
	authService := auth.NewAuthServiceWithRefreshTokens(repos.userRepository, repos.accountRepository, repos.categoryRepository, repos.budgetRepository, repos.transactionRepository, repos.refreshTokenRepository, cfg)

	// WebAuthn / passkey service. Ceremony sessions (challenges) are stored in
	// Postgres (webauthn_sessions) so they work across instances.
	var passkeyService *passkeySvc.PasskeyService
	if wa, waErr := webauthn.New(&webauthn.Config{
		RPDisplayName: cfg.WebAuthn.RPDisplayName,
		RPID:          cfg.WebAuthn.RPID,
		RPOrigins:     cfg.WebAuthn.RPOrigins,
	}); waErr == nil {
		passkeyService = passkeySvc.NewPasskeyService(wa, repos.passkeyRepository, userService, authService, cfg.WebAuthn.ChallengeTTL)
	} else {
		log.Warn().Err(waErr).Msg("WebAuthn init failed, passkey endpoints will be disabled")
	}

	return &services{
		accountService:      account.NewAccountService(repos.accountRepository, account.WithReconciliation(repos.reconciliationRepo, transactionService, repos.categoryRepository)),
		transactionService:  transactionService,
		userService:         userService,
		authService:         authService,
		budgetService:       budget.NewBudgetServices(repos.budgetRepository, repos.transactionRepository, usdToDopRateFn),
		categoryService:     category.NewCategoryServices(repos.categoryRepository),
		investmentService:   investment.NewInvestmentService(repos.investmentRepository, quoteService, transactionService, repos.accountRepository, repos.categoryRepository),
		analyticsService:    analytics.NewAnalyticsService(repos.analyticsRepository, repos.accountRepository, repos.investmentRepository, repos.certificateRepository, usdToDopRateFn),
		recurringService:    recurring_transaction.NewRecurringTransactionService(repos.recurringRepository, transactionService, notificationService, recurring_transaction.WithLocation(appLocation)),
		monthlyPlanService:  monthly_plan.NewMonthlyPlanService(repos.monthlyPlanRepository, usdToDopRateFn),
		searchService:       search.NewSearchService(repos.transactionRepository, repos.categoryRepository, repos.accountRepository, repos.budgetRepository, repos.loanRepository, repos.certificateRepository),
		quoteService:        quoteService,
		notificationService: notificationService,
		aiService:           aiSvc,
		aiCache:             aiCacheSvc,
		certificateService:  certificateService,
		creditCardService:   creditCardService,
		loanService:         loanService,
		exchangeService:     exchangeService,
		apiKeyService:       apikey.NewAPIKeyService(repos.apiKeyRepository),
		passkeyService:      passkeyService,
	}, nil
}

// initializeAIService creates the AI service instance
func initializeAIService(cfg *config.Config) *aiService.Service {
	// Check if AI is configured
	if cfg.AI.GeminiAPIKey == "" {
		log.Info().Msg("AI service not configured (missing GEMINI_API_KEY)")
		return nil
	}

	// Create Gemini provider
	provider, err := gemini.NewProvider(cfg.AI.GeminiAPIKey, cfg.AI.Model)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create Gemini provider")
		return nil
	}

	// Create AI service config
	aiConfig := &aiService.Config{
		Provider:       provider,
		MaxRetries:     cfg.AI.MaxRetries,
		RetryBackoff:   cfg.AI.RetryBackoff,
		RequestTimeout: cfg.AI.RequestTimeout,
		MaxFileSize:    cfg.AI.MaxFileSize,
		MaxFiles:       cfg.AI.MaxFiles,
		EnableMetrics:  cfg.AI.EnableMetrics,
	}

	// Create AI service
	svc, err := aiService.NewService(aiConfig, log.Logger)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create AI service")
		return nil
	}

	// Register transaction extractor task
	extractor, err := tasks.NewTransactionExtractor()
	if err != nil {
		log.Error().Err(err).Msg("Failed to create transaction extractor")
		return nil
	}

	svc.RegisterTask(domainAI.TaskExtractTransactions, extractor)

	// Register spending analyzer task
	analyzer, err := tasks.NewSpendingAnalyzer()
	if err != nil {
		log.Error().Err(err).Msg("Failed to create spending analyzer")
		return nil
	}

	svc.RegisterTask(domainAI.TaskSpendingAnalysis, analyzer)

	log.Info().
		Str("provider", provider.GetProviderName()).
		Str("model", provider.GetModel()).
		Msg("AI service initialized successfully")

	return svc
}

// seedAdminUser creates the admin user if it doesn't exist and admin seeding is enabled
func seedAdminUser(ctx context.Context, cfg *config.Config, repos *repositories, logger *observability.Logger) error {
	// Check if admin seeding is enabled
	if !cfg.Admin.Enabled {
		logger.Info("Admin seeding is disabled")
		return nil
	}

	// Validate admin credentials are provided
	if cfg.Admin.Email == "" || cfg.Admin.Password == "" {
		logger.Warn("Admin seeding enabled but ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping admin creation")
		return nil
	}

	// Check if admin already exists
	existingUser, err := repos.userRepository.FindUserByEmail(ctx, cfg.Admin.Email)
	if err == nil && existingUser != nil {
		logger.WithField("email", cfg.Admin.Email).Info("Admin user already exists, skipping creation")
		return nil
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(cfg.Admin.Password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash admin password: %w", err)
	}

	// Create admin user
	adminID := uuid.New().String()
	adminUser := userDomain.NewUser(adminID, cfg.Admin.Name, cfg.Admin.LastName, cfg.Admin.Email, string(hashedPassword))
	adminUser.Role = "ADMIN"
	adminUser.Confirmed = true
	adminUser.IsDemo = false

	if err := repos.userRepository.Save(ctx, adminUser); err != nil {
		return fmt.Errorf("failed to save admin user: %w", err)
	}

	logger.WithFields(map[string]interface{}{
		"email": cfg.Admin.Email,
		"name":  cfg.Admin.Name,
		"role":  "ADMIN",
	}).Info("Admin user created successfully")

	return nil
}
