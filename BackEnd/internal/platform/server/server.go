package server

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	notificationHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/notification"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/routes"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/account"
	aiService "github.com/osmait/gestorDePresupuesto/internal/services/ai"
	"github.com/osmait/gestorDePresupuesto/internal/services/analytics"
	"github.com/osmait/gestorDePresupuesto/internal/services/auth"
	"github.com/osmait/gestorDePresupuesto/internal/services/budget"
	"github.com/osmait/gestorDePresupuesto/internal/services/category"
	"github.com/osmait/gestorDePresupuesto/internal/services/certificate"
	"github.com/osmait/gestorDePresupuesto/internal/services/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/services/exchange"
	investmentService "github.com/osmait/gestorDePresupuesto/internal/services/investment"
	"github.com/osmait/gestorDePresupuesto/internal/services/loan"
	"github.com/osmait/gestorDePresupuesto/internal/services/notification"
	"github.com/osmait/gestorDePresupuesto/internal/services/quote"
	"github.com/osmait/gestorDePresupuesto/internal/services/recurring_transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/search"
	"github.com/osmait/gestorDePresupuesto/internal/services/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/user"

	_ "github.com/osmait/gestorDePresupuesto/docs"

	cors "github.com/rs/cors/wrapper/gin"
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
	shutdownTimeout     *time.Duration
	db                  *sql.DB
	config              *config.Config
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
		shutdownTimeout:     shutdownTimeout,
		db:                  db,
		config:              cfg,
	}
	srv.registerRoutes()
	return serverContext(ctx), &srv
}

func (s *Server) registerRoutes() {
	// Basic middleware
	s.Engine.Use(cors.AllowAll())

	// Error handling middleware (must be first)
	s.Engine.Use(middleware.ErrorHandler(middleware.DefaultErrorHandlerConfig()))

	// Rate limiting middleware
	s.Engine.Use(middleware.RateLimitMiddleware(s.config))

	// Swagger documentation route (before authentication)
	s.Engine.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Health routes (before authentication)
	routes.HealthRoutes(s.Engine, s.db, "1.0.0", string(s.config.Server.Environment))
	routes.QuoteRoutes(s.Engine, s.quoteService)
	routes.ExchangeRoutes(s.Engine, s.exchangeService)

	// Authentication middleware for protected routes
	s.Engine.Use(middleware.AuthMiddleware(s.servicesUser, s.config))

	// Notification Route (SSE)
	notificationH := notificationHandler.NewNotificationHandler(s.notificationService)
	s.Engine.GET("/notifications", notificationH.Subscribe)
	s.Engine.POST("/notifications/test", notificationH.SendTestNotification)
	s.Engine.GET("/notifications/history", notificationH.GetHistory)
	s.Engine.PATCH("/notifications/:id/read", notificationH.MarkAsRead)
	s.Engine.PATCH("/notifications/read-all", notificationH.MarkAllAsRead)
	s.Engine.DELETE("/notifications", notificationH.DeleteAll)

	// Application routes
	routes.AuhtRoutes(s.Engine, s.servicesAuth)
	routes.UserRoute(s.Engine, s.servicesUser)
	routes.AccountRotes(s.Engine, s.servicesAccunt)
	routes.TransactionRoutes(s.Engine, s.servicesTransaction)
	routes.CategoryRoutes(s.Engine, s.servicesCategory)
	routes.BudgetRoutes(s.Engine, s.servicesBudget)
	routes.AnalyticsRoutes(s.Engine, s.analyticsService)
	routes.RecurringTransactionRoutes(s.Engine, s.recurringService)
	routes.SearchRoutes(s.Engine, s.searchService)
	routes.InvestmentRoutes(s.Engine, s.investmentService)
	routes.CertificateRoutes(s.Engine, s.certificateService)
	routes.CreditCardRoutes(s.Engine, s.creditCardService)
	routes.LoanRoutes(s.Engine, s.loanService)
	routes.AIRoutes(s.Engine, s.aiService, s.categoryRepo, s.transactionRepo, s.aiCache)
}

func (s *Server) Run(ctx context.Context) error {
	log.Println("Server running on", s.httpAddr)

	srv := &http.Server{
		Addr:    s.httpAddr,
		Handler: s.Engine,
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
