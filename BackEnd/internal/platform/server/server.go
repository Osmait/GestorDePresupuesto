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
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/routes"
	"github.com/osmait/gestorDePresupuesto/internal/services/account"
	"github.com/osmait/gestorDePresupuesto/internal/services/analytics"
	"github.com/osmait/gestorDePresupuesto/internal/services/auth"
	"github.com/osmait/gestorDePresupuesto/internal/services/budget"
	"github.com/osmait/gestorDePresupuesto/internal/services/category"
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
	db *sql.DB,
	cfg *config.Config,
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

	// Observability middleware
	if s.config.FeatureFlags.EnableTracing {
		s.Engine.Use(middleware.TracingMiddleware(s.config.OpenTelemetry.ServiceName))
	}

	// Swagger documentation route (before authentication)
	s.Engine.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Health routes (before authentication)
	routes.HealthRoutes(s.Engine, s.db, "1.0.0", string(s.config.Server.Environment))

	// Authentication middleware for protected routes
	s.Engine.Use(middleware.AuthMiddleware(s.servicesUser, s.config))

	// Application routes
	routes.AuhtRoutes(s.Engine, s.servicesAuth)
	routes.UserRoute(s.Engine, s.servicesUser)
	routes.AccountRotes(s.Engine, s.servicesAccunt)
	routes.TransactionRoutes(s.Engine, s.servicesTransaction)
	routes.CategoryRoutes(s.Engine, s.servicesCategory)
	routes.BudgetRoutes(s.Engine, s.servicesBudget)
	routes.AnalyticsRoutes(s.Engine, s.analyticsService)
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
