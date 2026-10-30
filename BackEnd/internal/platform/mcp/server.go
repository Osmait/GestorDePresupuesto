package mcp

import (
	"database/sql"
	"time"

	"github.com/mark3labs/mcp-go/server"
	"github.com/osmait/gestorDePresupuesto/internal/platform/apptime"
	"github.com/osmait/gestorDePresupuesto/internal/services/account"
	"github.com/osmait/gestorDePresupuesto/internal/services/analytics"
	"github.com/osmait/gestorDePresupuesto/internal/services/budget"
	"github.com/osmait/gestorDePresupuesto/internal/services/category"
	"github.com/osmait/gestorDePresupuesto/internal/services/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/services/loan"
	"github.com/osmait/gestorDePresupuesto/internal/services/monthly_plan"
	"github.com/osmait/gestorDePresupuesto/internal/services/recurring_transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/search"
	"github.com/osmait/gestorDePresupuesto/internal/services/transaction"
)

// Services bundles the application services needed by MCP tool handlers.
type Services struct {
	Account     *account.AccountService
	Transaction *transaction.TransactionService
	Category    *category.CategoryServices
	Budget      *budget.BudgetServices
	Analytics   *analytics.AnalyticsService
	CreditCard  *creditcard.CreditCardService
	Loan        *loan.LoanService
	Recurring   *recurring_transaction.RecurringTransactionService
	MonthlyPlan *monthly_plan.MonthlyPlanService
	Search      *search.SearchService
}

// MCPServer wraps the mcp-go server and registers all tool handlers.
type MCPServer struct {
	server   *server.MCPServer
	services *Services
	db       *sql.DB
	// loc is the app time zone that date-only arguments and periods are
	// cut in.
	loc *time.Location
}

// Option configures an MCPServer.
type Option func(*MCPServer)

// WithLocation sets the app time zone (default apptime.Default()).
func WithLocation(loc *time.Location) Option {
	return func(s *MCPServer) {
		if loc != nil {
			s.loc = loc
		}
	}
}

// NewMCPServer creates and configures an MCPServer with all tools registered.
func NewMCPServer(name, version string, services *Services, db *sql.DB, opts ...Option) *MCPServer {
	s := server.NewMCPServer(name, version)

	mcpSrv := &MCPServer{
		server:   s,
		services: services,
		db:       db,
		loc:      apptime.Default(),
	}
	for _, opt := range opts {
		opt(mcpSrv)
	}

	mcpSrv.registerTools()
	mcpSrv.registerPrompts()
	return mcpSrv
}

// GetServer returns the underlying mcp-go MCPServer for transport setup.
func (s *MCPServer) GetServer() *server.MCPServer {
	return s.server
}
