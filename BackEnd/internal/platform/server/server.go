package server

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	mcpServer "github.com/mark3labs/mcp-go/server"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	"github.com/osmait/gestorDePresupuesto/internal/platform/i18n"
	mcpPkg "github.com/osmait/gestorDePresupuesto/internal/platform/mcp"
	"github.com/osmait/gestorDePresupuesto/internal/platform/observability"
	notificationHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/notification"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/routes"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/telemetry"
	"github.com/osmait/gestorDePresupuesto/internal/services/account"
	aiService "github.com/osmait/gestorDePresupuesto/internal/services/ai"
	"github.com/osmait/gestorDePresupuesto/internal/services/analytics"
	"github.com/osmait/gestorDePresupuesto/internal/services/apikey"
	"github.com/osmait/gestorDePresupuesto/internal/services/auth"
	"github.com/osmait/gestorDePresupuesto/internal/services/budget"
	"github.com/osmait/gestorDePresupuesto/internal/services/category"
	"github.com/osmait/gestorDePresupuesto/internal/services/certificate"
	"github.com/osmait/gestorDePresupuesto/internal/services/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/services/exchange"
	investmentService "github.com/osmait/gestorDePresupuesto/internal/services/investment"
	"github.com/osmait/gestorDePresupuesto/internal/services/loan"
	"github.com/osmait/gestorDePresupuesto/internal/services/monthly_plan"
	"github.com/osmait/gestorDePresupuesto/internal/services/notification"
	"github.com/osmait/gestorDePresupuesto/internal/services/passkey"
	"github.com/osmait/gestorDePresupuesto/internal/services/quote"
	"github.com/osmait/gestorDePresupuesto/internal/services/recurring_transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/search"
	"github.com/osmait/gestorDePresupuesto/internal/services/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/user"
	"github.com/osmait/gestorDePresupuesto/internal/version"

	_ "github.com/osmait/gestorDePresupuesto/docs"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

type Server struct {
	httpAddr            string
	Engine              *gin.Engine
	servicesAccunt      *account.AccountService
	servicesTransaction *transaction.TransactionService
	servicesUser        *user.UserService
	servicesAuth        *auth.AuthService
	servicesBudget      *budget.BudgetServices
	servicesCategory    *category.CategoryServices
	analyticsService    *analytics.AnalyticsService
	recurringService    *recurring_transaction.RecurringTransactionService
	monthlyPlanService  *monthly_plan.MonthlyPlanService
	searchService       *search.SearchService
	investmentService   *investmentService.InvestmentService
	quoteService        *quote.QuoteService
	notificationService *notification.NotificationService
	aiService           *aiService.Service
	aiCache             *aiService.AICacheService
	categoryRepo        categoryRepo.CategoryRepoInterface
	transactionRepo     transactionRepo.TransactionRepositoryInterface
	certificateService  *certificate.CertificateService
	creditCardService   *creditcard.CreditCardService
	loanService         *loan.LoanService
	exchangeService     *exchange.ExchangeRateService
	apiKeyService       *apikey.APIKeyService
	passkeyService      *passkey.PasskeyService
	mcpServer           *mcpPkg.MCPServer
	oauthServer         *mcpPkg.OAuthProvider
	shutdownTimeout     *time.Duration
	db                  *sql.DB
	config              *config.Config
	rateLimiter         *middleware.RateLimitService
	featureFlags        *middleware.FeatureFlags
	telemetry           *telemetry.Telemetry
}

// Option customizes a Server built by New.
type Option func(*Server)

// WithTelemetry enables the OpenTelemetry HTTP middleware and the /metrics
// endpoint according to t (nil or disabled telemetry installs nothing).
func WithTelemetry(t *telemetry.Telemetry) Option {
	return func(s *Server) {
		if t != nil {
			s.telemetry = t
		}
	}
}

func New(ctx context.Context,
	host string,
	port uint,
	shutdownTimeout *time.Duration,
	servicesAccount *account.AccountService,
	transactionService *transaction.TransactionService,
	userService *user.UserService,
	authService *auth.AuthService,
	budgetService *budget.BudgetServices,
	categoryServices *category.CategoryServices,
	analyticsService *analytics.AnalyticsService,
	recurringService *recurring_transaction.RecurringTransactionService,
	monthlyPlanService *monthly_plan.MonthlyPlanService,
	searchService *search.SearchService,
	investmentService *investmentService.InvestmentService,
	db *sql.DB,
	cfg *config.Config,
	quoteService *quote.QuoteService,
	notificationService *notification.NotificationService,
	aiSvc *aiService.Service,
	aiCache *aiService.AICacheService,
	catRepo categoryRepo.CategoryRepoInterface,
	txnRepo transactionRepo.TransactionRepositoryInterface,
	certificateSvc *certificate.CertificateService,
	creditCardSvc *creditcard.CreditCardService,
	loanSvc *loan.LoanService,
	exchangeSvc *exchange.ExchangeRateService,
	apiKeySvc *apikey.APIKeyService,
	passkeySvc *passkey.PasskeyService,
	mcpSrv *mcpPkg.MCPServer,
	oauthSrv *mcpPkg.OAuthProvider,
	opts ...Option,
) (context.Context, *Server) {
	srv := Server{
		Engine:              gin.New(),
		httpAddr:            fmt.Sprintf("%s:%d", host, port),
		servicesAccunt:      servicesAccount,
		servicesTransaction: transactionService,
		servicesUser:        userService,
		servicesAuth:        authService,
		servicesBudget:      budgetService,
		servicesCategory:    categoryServices,
		analyticsService:    analyticsService,
		recurringService:    recurringService,
		monthlyPlanService:  monthlyPlanService,
		searchService:       searchService,
		investmentService:   investmentService,
		quoteService:        quoteService,
		notificationService: notificationService,
		aiService:           aiSvc,
		aiCache:             aiCache,
		categoryRepo:        catRepo,
		transactionRepo:     txnRepo,
		certificateService:  certificateSvc,
		creditCardService:   creditCardSvc,
		loanService:         loanSvc,
		exchangeService:     exchangeSvc,
		apiKeyService:       apiKeySvc,
		passkeyService:      passkeySvc,
		mcpServer:           mcpSrv,
		oauthServer:         oauthSrv,
		shutdownTimeout:     shutdownTimeout,
		db:                  db,
		config:              cfg,
		telemetry:           telemetry.Disabled(),
	}
	for _, opt := range opts {
		opt(&srv)
	}
	srv.featureFlags = middleware.NewFeatureFlags(db, cfg.Cache.FeatureFlagTTL)
	srv.registerRoutes()
	return serverContext(ctx), &srv
}

func (s *Server) registerRoutes() {
	// Client IP resolution: only trust the frontend server's X-Client-IP
	// (PROXY_SHARED_SECRET) and forwarding headers from configured proxies
	// (TRUSTED_PLATFORM_HEADER / TRUSTED_PROXIES). Must run first: it installs
	// the middleware that strips X-Proxy-Secret before anything can log it,
	// and runs before anything calls c.ClientIP() (rate limiting, login
	// lockout, demo users).
	if err := middleware.ConfigureClientIP(s.Engine, s.config.Server); err != nil {
		log.Printf("[security] %v — falling back to trusting no proxies", err)
		_ = s.Engine.SetTrustedProxies(nil)
		s.Engine.TrustedPlatform = ""
	}
	if s.config.IsProduction() {
		if len(s.config.Server.TrustedProxies) == 0 && s.config.Server.TrustedPlatformHeader == "" {
			log.Printf("[security] WARNING: no TRUSTED_PROXIES / TRUSTED_PLATFORM_HEADER configured; " +
				"behind a reverse proxy every client will share the proxy's IP for rate limiting")
		}
		if s.config.Server.ProxySharedSecret == "" {
			log.Printf("[security] WARNING: PROXY_SHARED_SECRET not configured; requests relayed by the " +
				"frontend server (Next.js proxy, Server Components, next-auth) all share its IP for " +
				"rate limiting and login lockout. Set the same value on the backend and the frontend")
		}
	}

	// Observability (outermost so CORS preflights, 429s and recovered
	// panics are all measured): request id → span + RED metrics → access log.
	// Request-scoped work runs on c.Request.Context(), never on the
	// *gin.Context (gin recycles it once the handler returns). Fallback is
	// enabled unconditionally so that any *gin.Context still used as a
	// context.Context behaves exactly like the request context, with or
	// without telemetry: Value() resolves the request span / tx / locale and
	// Done()/Err() follow the request.
	//
	// Cancellation policy (identical with telemetry on and off): a client
	// disconnect cancels the in-flight work. This is the safe choice because
	// the RLS transaction is opened with BeginTx(c.Request.Context()), so
	// database/sql already rolls it back on disconnect — continuing would only
	// burn a pooled connection on a doomed transaction, and nothing is
	// committed. Work that must outlive the request (notifications) uses
	// context.WithoutCancel plus explicit values, never the gin context.
	s.Engine.ContextWithFallback = true
	s.Engine.Use(middleware.RequestID())
	s.Engine.Use(middleware.HTTPTelemetry(middleware.HTTPTelemetryConfig{
		TracerProvider:  s.telemetry.TracerProvider(),
		MeterProvider:   s.telemetry.MeterProvider(),
		Tracing:         s.telemetry.TracingEnabled(),
		Metrics:         s.telemetry.MetricsEnabled(),
		SkipTracing:     middleware.DefaultSkipTracing(),
		SkipMetrics:     map[string]bool{"/metrics": true},
		StreamingRoutes: middleware.DefaultStreamingRoutes(),
	}))
	s.Engine.Use(middleware.AccessLog(s.config.Logging, observability.GetLogger().Logger()))

	// CORS: explicit allow-list from CORS_ALLOWED_ORIGINS.
	if s.config.IsProduction() && onlyLocalOrigins(s.config.CORS.AllowedOrigins) {
		log.Printf("[security] WARNING: CORS_ALLOWED_ORIGINS only lists localhost origins; " +
			"browser calls from the production frontend will be blocked")
	}
	s.Engine.Use(middleware.CORS(s.config.CORS))

	// gzip for JSON/text responses >= 1 KB when the client accepts it. It
	// wraps everything below, including RLSMiddleware, so the body is
	// compressed when the RLS buffer is written out after the commit. SSE,
	// MCP and /metrics are excluded.
	s.Engine.Use(middleware.Compression(middleware.DefaultCompressionConfig()))

	// Error handling middleware (must be first)
	s.Engine.Use(middleware.ErrorHandler(middleware.DefaultErrorHandlerConfig()))

	// Locale for backend-generated names (Accept-Language: es|en, default es).
	s.Engine.Use(i18n.Middleware())

	// Rate limiting middleware (expired keys are evicted by the cleanup
	// goroutine started in Run).
	s.rateLimiter = middleware.NewRateLimitService(s.config)
	s.Engine.Use(s.rateLimiter.Middleware())

	// Swagger documentation route (before authentication)
	s.Engine.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Health routes (before authentication). /health/detailed only returns
	// internals to callers presenting METRICS_TOKEN.
	routes.HealthRoutes(s.Engine, s.db, version.Number, string(s.config.Server.Environment), s.config.Metrics.Token)

	// Prometheus scrape endpoint on the public port: only with a bearer token.
	s.registerMetricsRoute()
	routes.QuoteRoutes(s.Engine, s.quoteService)
	routes.ExchangeRoutes(s.Engine, s.exchangeService)

	// OAuth 2.1 endpoints — public, must be registered BEFORE any auth
	// middleware so that clients can obtain tokens without authentication.
	if s.oauthServer != nil {
		s.Engine.Any("/.well-known/oauth-authorization-server", gin.WrapH(s.oauthServer.MetadataHandler()))
		s.Engine.Any("/.well-known/oauth-protected-resource", gin.WrapH(s.oauthServer.ProtectedResourceMetadataHandler("/mcp")))
		// Login/consent page: our handler (localized, CSP, deny button) that
		// passes the trusted c.ClientIP() to the login lockout.
		s.Engine.GET("/oauth/authorize", s.oauthServer.AuthorizeHandler())
		s.Engine.POST("/oauth/authorize", s.oauthServer.AuthorizeHandler())
		s.Engine.POST("/oauth/token", func(c *gin.Context) {
			log.Printf("[OAuth] POST /oauth/token from %s, Content-Type: %s", c.ClientIP(), c.GetHeader("Content-Type"))
			s.oauthServer.TokenHandler().ServeHTTP(c.Writer, c.Request)
			log.Printf("[OAuth] POST /oauth/token responded with status %d", c.Writer.Status())
		})
		s.Engine.POST("/oauth/revoke", gin.WrapH(s.oauthServer.RevocationHandler()))
		s.Engine.POST("/oauth/register", func(c *gin.Context) {
			log.Printf("[OAuth] POST /oauth/register from %s", c.ClientIP())
			s.oauthServer.RegistrationHandler().ServeHTTP(c.Writer, c.Request)
			log.Printf("[OAuth] POST /oauth/register responded with status %d", c.Writer.Status())
		})
	}

	// MCP endpoints — authenticated via OAuth token or API key, not JWT;
	// must be registered BEFORE the JWT AuthMiddleware so they are not
	// blocked by it.
	if s.mcpServer != nil {
		baseURL := s.config.MCP.BaseURL
		if baseURL == "" {
			baseURL = fmt.Sprintf("http://127.0.0.1:%d", s.config.Server.Port)
		}
		mcpGroup := s.Engine.Group("/mcp")
		if s.oauthServer != nil {
			// Resolve OAuth subject (email) to internal user ID
			userResolver := func(ctx context.Context, email string) (string, error) {
				u, err := s.servicesUser.FindByEmail(ctx, email)
				if err != nil {
					return "", err
				}
				return u.Id, nil
			}
			mcpGroup.Use(mcpPkg.MCPAuthMiddleware(s.apiKeyService, s.oauthServer.TokenVerifier(), baseURL, userResolver))
		} else {
			mcpGroup.Use(mcpPkg.APIKeyAuthMiddleware(s.apiKeyService))
		}
		// SSE transport (for Claude Desktop via mcp-remote)
		sseHandler := mcpServer.NewSSEServer(s.mcpServer.GetServer(),
			mcpServer.WithStaticBasePath("/mcp"),
			mcpServer.WithBaseURL(baseURL),
		)
		mcpGroup.GET("/sse", middleware.StreamingNoDeadline(), gin.WrapH(sseHandler.SSEHandler()))
		mcpGroup.POST("/message", gin.WrapH(sseHandler.MessageHandler()))

		// Streamable HTTP transport (for Claude Web custom connectors)
		streamHandler := mcpServer.NewStreamableHTTPServer(s.mcpServer.GetServer())
		mcpGroup.POST("", gin.WrapH(streamHandler))
		// GET opens the server->client SSE stream of the streamable transport.
		mcpGroup.GET("", middleware.StreamingNoDeadline(), gin.WrapH(streamHandler))
		mcpGroup.DELETE("", gin.WrapH(streamHandler))
	}

	// Authentication middleware for protected routes
	s.Engine.Use(middleware.AuthMiddleware(s.servicesUser, s.config))

	// SSE subscribe endpoint is registered HERE — after AuthMiddleware but BEFORE
	// RLSMiddleware. Rationale: the SSE handler is a long-lived connection that
	// never completes (it streams events until the client disconnects). If it were
	// wrapped by RLSMiddleware, the middleware would open a *sql.Tx that is never
	// committed/rolled back for the duration of the connection, exhausting the
	// connection pool under concurrent users. The subscribe handler does not query
	// the database itself, so it does not need an RLS transaction.
	notificationH := notificationHandler.NewNotificationHandler(s.notificationService)
	s.Engine.GET("/notifications", notificationH.Subscribe)

	// The on-demand recurring processor runs every occurrence in its own
	// scheduler transaction, so it must not also hold a request transaction
	// (that would need two pooled connections per request). See
	// routes.RecurringTransactionProcessRoute.
	routes.RecurringTransactionProcessRoute(s.Engine, s.recurringService)

	// RLS middleware: pins each DB-touching authenticated request to a transaction
	// with set_config('app.current_user_id', userID, true). Every query that runs
	// below this point must use that transaction (txhelper.FromContext/InTx):
	// the request already holds a pooled connection, and waiting for a second
	// one deadlocks once concurrent requests exhaust the pool. The connection
	// is acquired with a bounded wait (DB_TX_ACQUIRE_TIMEOUT) and the request
	// fails fast with 503 when the pool stays exhausted.
	s.Engine.Use(middleware.RLSMiddlewareWithTimeout(s.db, s.config.Database.TxAcquireTimeout))

	// Notification management endpoints — these DO query the DB and need RLS.
	s.Engine.POST("/notifications/test", notificationH.SendTestNotification)
	s.Engine.GET("/notifications/history", notificationH.GetHistory)
	s.Engine.PATCH("/notifications/:id/read", notificationH.MarkAsRead)
	s.Engine.PATCH("/notifications/read-all", notificationH.MarkAllAsRead)
	s.Engine.DELETE("/notifications", notificationH.DeleteAll)

	// Application routes
	routes.AuhtRoutes(s.Engine, s.servicesAuth)
	routes.UserRoute(s.Engine, s.servicesUser)
	routes.FeatureFlagRoutes(s.Engine, s.db, s.featureFlags)
	routes.AccountRotes(s.Engine, s.servicesAccunt)
	routes.TransactionRoutes(s.Engine, s.servicesTransaction)
	routes.CategoryRoutes(s.Engine, s.servicesCategory)
	routes.BudgetRoutes(s.Engine, s.servicesBudget)
	routes.AnalyticsRoutes(s.Engine, s.analyticsService)
	routes.RecurringTransactionRoutes(s.Engine, s.recurringService)
	routes.MonthlyPlanRoutes(s.Engine, s.monthlyPlanService)
	routes.SearchRoutes(s.Engine, s.searchService)
	routes.InvestmentRoutes(s.Engine, s.investmentService, s.featureFlags)
	routes.CertificateRoutes(s.Engine, s.certificateService, s.featureFlags)
	routes.CreditCardRoutes(s.Engine, s.creditCardService, s.featureFlags)
	routes.LoanRoutes(s.Engine, s.loanService, s.featureFlags)
	routes.PasskeyRoutes(s.Engine, s.passkeyService, s.featureFlags)
	routes.AIRoutes(s.Engine, s.aiService, s.categoryRepo, s.transactionRepo, s.servicesTransaction, s.db, s.aiCache, s.featureFlags)
	routes.APIKeyRoutes(s.Engine, s.apiKeyService)
}

// registerMetricsRoute mounts GET /metrics on the API port when metrics are
// enabled with the prometheus exporter, no separate METRICS_PORT is set and a
// METRICS_TOKEN protects it. It is never mounted unauthenticated here.
func (s *Server) registerMetricsRoute() {
	h := s.telemetry.MetricsHandler()
	if h == nil || s.config.Metrics.Port != 0 {
		return
	}
	if s.config.Metrics.Token == "" {
		log.Printf("[metrics] METRICS_ENABLED but neither METRICS_TOKEN nor METRICS_PORT is set; /metrics is not exposed")
		return
	}
	s.Engine.GET("/metrics", gin.WrapH(telemetry.BearerAuth(s.config.Metrics.Token, h)))
}

// metricsServer serves /metrics on the internal METRICS_PORT (e.g. Railway's
// private network). The token is still enforced when configured.
func (s *Server) metricsServer() *http.Server {
	h := s.telemetry.MetricsHandler()
	if h == nil || s.config.Metrics.Port == 0 {
		return nil
	}
	if s.config.Metrics.Token != "" {
		h = telemetry.BearerAuth(s.config.Metrics.Token, h)
	}
	mux := http.NewServeMux()
	mux.Handle("GET /metrics", h)
	host := s.config.Metrics.Host
	if host == "" {
		host = s.config.Server.Host
	}
	return &http.Server{
		Addr:              net.JoinHostPort(host, strconv.FormatUint(uint64(s.config.Metrics.Port), 10)),
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
	}
}

func (s *Server) Run(ctx context.Context) error {
	log.Println("Server running on", s.httpAddr)

	srv := NewHTTPServer(s.httpAddr, s.Engine, s.config.Server)

	if ms := s.metricsServer(); ms != nil {
		log.Println("Metrics server running on", ms.Addr)
		go func() {
			if err := ms.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				log.Printf("[metrics] server stopped: %v", err)
			}
		}()
		defer func() {
			shCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = ms.Shutdown(shCtx)
		}()
	}

	if s.rateLimiter != nil {
		s.rateLimiter.StartCleanup(ctx, 0)
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("server shut down", err)
		}
	}()

	<-ctx.Done()
	ctxShutDown, cancel := context.WithTimeout(context.Background(), *s.shutdownTimeout)
	defer cancel()

	return srv.Shutdown(ctxShutDown)
}

func onlyLocalOrigins(origins []string) bool {
	for _, o := range origins {
		if !strings.Contains(o, "://localhost") && !strings.Contains(o, "://127.0.0.1") {
			return false
		}
	}
	return true
}

// Fallback timeouts used when the config leaves a value unset (zero).
const (
	defaultReadHeaderTimeout = 10 * time.Second
	defaultReadTimeout       = 60 * time.Second
	defaultWriteTimeout      = 120 * time.Second
	defaultIdleTimeout       = 120 * time.Second
)

func durationOr(d, fallback time.Duration) time.Duration {
	if d > 0 {
		return d
	}
	return fallback
}

// NewHTTPServer builds the http.Server with timeouts from configuration.
// Streaming endpoints (SSE) clear their per-connection deadlines themselves
// (middleware.ClearConnDeadlines), so WriteTimeout can stay bounded for
// regular requests.
func NewHTTPServer(addr string, handler http.Handler, cfg config.ServerConfig) *http.Server {
	srv := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: durationOr(cfg.ReadHeaderTimeout, defaultReadHeaderTimeout),
		ReadTimeout:       durationOr(cfg.ReadTimeout, defaultReadTimeout),
		WriteTimeout:      durationOr(cfg.WriteTimeout, defaultWriteTimeout),
		IdleTimeout:       durationOr(cfg.IdleTimeout, defaultIdleTimeout),
	}
	if cfg.MaxHeaderBytes > 0 {
		srv.MaxHeaderBytes = cfg.MaxHeaderBytes
	}
	return srv
}

func serverContext(ctx context.Context) context.Context {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)
	ctx, cancel := context.WithCancel(ctx)
	go func() {
		<-c
		cancel()
	}()

	return ctx
}
