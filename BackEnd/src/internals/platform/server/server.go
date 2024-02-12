package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/server/middleware"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/server/routes"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/account"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/auth"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/budget"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/category"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/transaction"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/user"

	cors "github.com/rs/cors/wrapper/gin"
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
	shutdownTimeout     *time.Duration
}

func New(ctx context.Context, host string, port uint, shutdownTimeout *time.Duration, servicesAccount *account.AccountService, transactionService *transaction.TransactionService, userService *user.UserService, authService *auth.AuthService, budgetService *budget.BudgetServices, categoryServices *category.CategoryServices) (context.Context, *Server) {
	srv := Server{
		Engine:              gin.New(),
		httpAddr:            fmt.Sprintf("%s:%d", host, port),
		servicesAccunt:      servicesAccount,
		servicesTransaction: transactionService,
		servicesUser:        userService,
		servicesAuth:        authService,
		servicesBudget:      budgetService,
		servicesCategory:    categoryServices,
		shutdownTimeout:     shutdownTimeout,
	}
	srv.registerRoutes()
	return serverContext(ctx), &srv
}

func (s *Server) registerRoutes() {
	s.Engine.Use(cors.AllowAll())
	s.Engine.Use(middleware.AuthMiddleware(s.servicesUser))
	routes.HealthRoutes(s.Engine)

	routes.AuhtRoutes(s.Engine, s.servicesAuth)
	routes.UserRoute(s.Engine, s.servicesUser)
	routes.AccountRotes(s.Engine, s.servicesAccunt)
	routes.TransactionRoutes(s.Engine, s.servicesTransaction)
	routes.CategoryRoutes(s.Engine, s.servicesCategory)
	routes.BudgetRoutes(s.Engine, s.servicesBudget)
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
