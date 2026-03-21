package mcp

import (
	"database/sql"

	"github.com/mark3labs/mcp-go/server"
	"github.com/osmait/gestorDePresupuesto/internal/services/account"
	"github.com/osmait/gestorDePresupuesto/internal/services/analytics"
	"github.com/osmait/gestorDePresupuesto/internal/services/budget"
	"github.com/osmait/gestorDePresupuesto/internal/services/category"
	"github.com/osmait/gestorDePresupuesto/internal/services/transaction"
)

// Services bundles the application services needed by MCP tool handlers.
type Services struct {
	Account     *account.AccountService
	Transaction *transaction.TransactionService
	Category    *category.CategoryServices
	Budget      *budget.BudgetServices
	Analytics   *analytics.AnalyticsService
}

// MCPServer wraps the mcp-go server and registers all tool handlers.
type MCPServer struct {
	server   *server.MCPServer
	services *Services
	db       *sql.DB
}

// NewMCPServer creates and configures an MCPServer with all tools registered.
func NewMCPServer(name, version string, services *Services, db *sql.DB) *MCPServer {
	s := server.NewMCPServer(name, version)

	mcpSrv := &MCPServer{
		server:   s,
		services: services,
		db:       db,
	}

	mcpSrv.registerTools()
	return mcpSrv
}

// GetServer returns the underlying mcp-go MCPServer for transport setup.
func (s *MCPServer) GetServer() *server.MCPServer {
	return s.server
}
