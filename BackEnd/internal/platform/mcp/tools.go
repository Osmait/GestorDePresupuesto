package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/mcp/mcpcontext"
)

// registerTools registers all MCP tools on the server.
func (s *MCPServer) registerTools() {
	s.server.AddTool(
		mcp.NewTool("list_accounts",
			mcp.WithDescription("List all financial accounts for the authenticated user"),
		),
		s.handleListAccounts,
	)

	s.server.AddTool(
		mcp.NewTool("list_categories",
			mcp.WithDescription("List all transaction categories for the authenticated user"),
		),
		s.handleListCategories,
	)

	s.server.AddTool(
		mcp.NewTool("list_transactions",
			mcp.WithDescription("List recent transactions across all accounts for the authenticated user"),
			mcp.WithNumber("limit",
				mcp.Description("Maximum number of transactions to return (default 20)"),
			),
		),
		s.handleListTransactions,
	)

	s.server.AddTool(
		mcp.NewTool("create_transaction",
			mcp.WithDescription("Create a new income or expense transaction"),
			mcp.WithString("name",
				mcp.Required(),
				mcp.Description("Name or title of the transaction"),
			),
			mcp.WithNumber("amount",
				mcp.Required(),
				mcp.Description("Transaction amount (positive number)"),
			),
			mcp.WithString("type",
				mcp.Required(),
				mcp.Description("Transaction type: income or bill"),
				mcp.Enum("income", "bill"),
			),
			mcp.WithString("account_id",
				mcp.Required(),
				mcp.Description("ID of the account this transaction belongs to"),
			),
			mcp.WithString("category_id",
				mcp.Required(),
				mcp.Description("ID of the category for this transaction"),
			),
			mcp.WithString("description",
				mcp.Description("Optional description for the transaction"),
			),
			mcp.WithString("currency",
				mcp.Description("Currency code (e.g. USD, DOP). Defaults to USD"),
			),
			mcp.WithString("date",
				mcp.Description("Transaction date in RFC3339 format (defaults to now)"),
			),
		),
		s.handleCreateTransaction,
	)

	s.server.AddTool(
		mcp.NewTool("get_balance",
			mcp.WithDescription("Get current balance for all accounts of the authenticated user"),
		),
		s.handleGetBalance,
	)

	s.server.AddTool(
		mcp.NewTool("analyze_spending",
			mcp.WithDescription("Get a breakdown of expenses by category for the authenticated user"),
		),
		s.handleAnalyzeSpending,
	)
}

// withRLSTx opens a PostgreSQL transaction, sets the RLS user-id session variable,
// injects the transaction into ctx, and returns the enriched context plus a commit
// function. The caller is responsible for calling commit (or rollback on error).
func (s *MCPServer) withRLSTx(ctx context.Context, userID string) (context.Context, func(), func(), error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return ctx, nil, nil, fmt.Errorf("begin tx: %w", err)
	}

	if _, err := tx.ExecContext(ctx, "SELECT set_config('app.current_user_id', $1, true)", userID); err != nil {
		_ = tx.Rollback()
		return ctx, nil, nil, fmt.Errorf("set rls config: %w", err)
	}

	enriched := mcpcontext.WithTx(ctx, tx)
	commit := func() { _ = tx.Commit() }
	rollback := func() { _ = tx.Rollback() }
	return enriched, commit, rollback, nil
}

// handleListAccounts returns all accounts for the authenticated user.
func (s *MCPServer) handleListAccounts(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := mcpcontext.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("missing user authentication"), nil
	}

	txCtx, commit, rollback, err := s.withRLSTx(ctx, userID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("database error: %s", err)), nil
	}
	defer commit()
	defer rollback()

	accounts, err := s.services.Account.FindAll(txCtx, userID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to list accounts: %s", err)), nil
	}

	data, err := json.Marshal(accounts)
	if err != nil {
		return mcp.NewToolResultError("failed to serialize accounts"), nil
	}
	return mcp.NewToolResultText(string(data)), nil
}

// handleListCategories returns all categories for the authenticated user.
func (s *MCPServer) handleListCategories(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := mcpcontext.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("missing user authentication"), nil
	}

	txCtx, commit, rollback, err := s.withRLSTx(ctx, userID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("database error: %s", err)), nil
	}
	defer commit()
	defer rollback()

	categories, err := s.services.Category.FindAll(txCtx, userID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to list categories: %s", err)), nil
	}

	data, err := json.Marshal(categories)
	if err != nil {
		return mcp.NewToolResultError("failed to serialize categories"), nil
	}
	return mcp.NewToolResultText(string(data)), nil
}

// handleListTransactions returns recent transactions across all accounts.
func (s *MCPServer) handleListTransactions(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := mcpcontext.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("missing user authentication"), nil
	}

	limit := int(req.GetFloat("limit", 20))
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	txCtx, commit, rollback, err := s.withRLSTx(ctx, userID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("database error: %s", err)), nil
	}
	defer commit()
	defer rollback()

	filter := dto.NewTransactionFilter()
	filter.Limit = limit
	filter.Page = 1
	filter.Offset = 0
	// Ensure date range is calculated for the default filter
	if calcErr := filter.Validate(); calcErr != nil {
		// Non-fatal: proceed with defaults
		filter = dto.NewTransactionFilter()
		filter.Limit = limit
	}

	result, err := s.services.Transaction.FindAllOfAllAccountsWithFilters(txCtx, userID, filter, false)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to list transactions: %s", err)), nil
	}

	data, err := json.Marshal(result)
	if err != nil {
		return mcp.NewToolResultError("failed to serialize transactions"), nil
	}
	return mcp.NewToolResultText(string(data)), nil
}

// handleCreateTransaction creates a new transaction for the authenticated user.
func (s *MCPServer) handleCreateTransaction(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := mcpcontext.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("missing user authentication"), nil
	}

	name, err := req.RequireString("name")
	if err != nil {
		return mcp.NewToolResultError("name is required"), nil
	}

	amount := req.GetFloat("amount", 0)
	if amount <= 0 {
		return mcp.NewToolResultError("amount must be a positive number"), nil
	}

	txType, err := req.RequireString("type")
	if err != nil {
		return mcp.NewToolResultError("type is required"), nil
	}

	accountID, err := req.RequireString("account_id")
	if err != nil {
		return mcp.NewToolResultError("account_id is required"), nil
	}

	categoryID, err := req.RequireString("category_id")
	if err != nil {
		return mcp.NewToolResultError("category_id is required"), nil
	}

	description := req.GetString("description", "")
	currency := req.GetString("currency", "USD")

	createdAt := time.Now()
	if dateStr := req.GetString("date", ""); dateStr != "" {
		if parsed, parseErr := time.Parse(time.RFC3339, dateStr); parseErr == nil {
			createdAt = parsed
		}
	}

	txCtx, _, rollback, dbErr := s.withRLSTx(ctx, userID)
	if dbErr != nil {
		return mcp.NewToolResultError(fmt.Sprintf("database error: %s", dbErr)), nil
	}
	defer rollback() // rollback is a no-op after a successful commit

	if createErr := s.services.Transaction.CreateTransaction(
		txCtx,
		name,
		description,
		amount,
		txType,
		accountID,
		userID,
		categoryID,
		"", // budgetId: not exposed via MCP tool
		currency,
		createdAt,
	); createErr != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to create transaction: %s", createErr)), nil
	}

	// Commit explicitly after successful create — defer rollback above
	// becomes a no-op since the tx is already committed.
	if commitErr := mcpcontext.TxFromContext(txCtx).Commit(); commitErr != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to commit transaction: %s", commitErr)), nil
	}

	resp := map[string]string{"status": "created"}
	data, _ := json.Marshal(resp)
	return mcp.NewToolResultText(string(data)), nil
}

// handleGetBalance returns all accounts with their current balances.
func (s *MCPServer) handleGetBalance(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := mcpcontext.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("missing user authentication"), nil
	}

	txCtx, commit, rollback, err := s.withRLSTx(ctx, userID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("database error: %s", err)), nil
	}
	defer commit()
	defer rollback()

	accounts, err := s.services.Account.FindAll(txCtx, userID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get balances: %s", err)), nil
	}

	data, err := json.Marshal(accounts)
	if err != nil {
		return mcp.NewToolResultError("failed to serialize balances"), nil
	}
	return mcp.NewToolResultText(string(data)), nil
}

// handleAnalyzeSpending returns a category-level expense breakdown.
func (s *MCPServer) handleAnalyzeSpending(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := mcpcontext.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("missing user authentication"), nil
	}

	txCtx, commit, rollback, err := s.withRLSTx(ctx, userID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("database error: %s", err)), nil
	}
	defer commit()
	defer rollback()

	expenses, err := s.services.Analytics.GetCategoryExpenses(txCtx, userID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to analyze spending: %s", err)), nil
	}

	data, err := json.Marshal(expenses)
	if err != nil {
		return mcp.NewToolResultError("failed to serialize spending analysis"), nil
	}
	return mcp.NewToolResultText(string(data)), nil
}
