package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	transactionDomain "github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
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
			mcp.WithDescription("List transactions for the authenticated user. Supports filtering by date range, account, category and type."),
			mcp.WithNumber("limit",
				mcp.Description("Maximum number of transactions to return (default 20, max 100)"),
			),
			mcp.WithString("date_from",
				mcp.Description("Filter: start date in YYYY-MM-DD or YYYY/MM/DD format"),
			),
			mcp.WithString("date_to",
				mcp.Description("Filter: end date in YYYY-MM-DD or YYYY/MM/DD format"),
			),
			mcp.WithString("account_id",
				mcp.Description("Filter by account ID"),
			),
			mcp.WithString("category_id",
				mcp.Description("Filter by category ID"),
			),
			mcp.WithString("type",
				mcp.Description("Filter by transaction type"),
				mcp.Enum("income", "bill", "all"),
			),
		),
		s.handleListTransactions,
	)

	s.server.AddTool(
		mcp.NewTool("update_transaction",
			mcp.WithDescription("Replace an existing transaction's core fields. Before calling, use list_transactions to fetch the current values and pass the full set of fields — any omitted required field will be rejected."),
			mcp.WithString("id", mcp.Required(), mcp.Description("ID of the transaction to update")),
			mcp.WithString("name", mcp.Required(), mcp.Description("Transaction name")),
			mcp.WithNumber("amount", mcp.Required(), mcp.Description("Amount (positive number)")),
			mcp.WithString("type", mcp.Required(), mcp.Description("Transaction type"), mcp.Enum("income", "bill")),
			mcp.WithString("account_id", mcp.Required(), mcp.Description("Account ID")),
			mcp.WithString("category_id", mcp.Required(), mcp.Description("Category ID")),
			mcp.WithString("description", mcp.Description("Optional description")),
			mcp.WithString("currency", mcp.Description("Currency code (e.g. USD, DOP). Defaults to USD")),
			mcp.WithString("date", mcp.Description("Transaction date in RFC3339 (optional, preserves original if omitted — but if you need to preserve it, pass it explicitly)")),
		),
		s.handleUpdateTransaction,
	)

	s.server.AddTool(
		mcp.NewTool("delete_transaction",
			mcp.WithDescription("Delete a transaction owned by the authenticated user"),
			mcp.WithString("id", mcp.Required(), mcp.Description("ID of the transaction to delete")),
		),
		s.handleDeleteTransaction,
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

	s.registerExtraTools()
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
	filter.DateFrom = req.GetString("date_from", "")
	filter.DateTo = req.GetString("date_to", "")
	filter.AccountId = req.GetString("account_id", "")
	filter.CategoryId = req.GetString("category_id", "")
	if typeFilter := req.GetString("type", ""); typeFilter != "" {
		filter.Type = typeFilter
	}

	// Parse date strings into CalculatedDateFrom/To (the repository relies on these).
	// When empty, leave as zero so no date filter is applied.
	if filter.DateFrom != "" {
		parsed, perr := parseMCPDate(filter.DateFrom)
		if perr != nil {
			return mcp.NewToolResultError(fmt.Sprintf("invalid date_from: %s", perr)), nil
		}
		filter.CalculatedDateFrom = parsed
	}
	if filter.DateTo != "" {
		parsed, perr := parseMCPDate(filter.DateTo)
		if perr != nil {
			return mcp.NewToolResultError(fmt.Sprintf("invalid date_to: %s", perr)), nil
		}
		filter.CalculatedDateTo = parsed.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
	}
	if calcErr := filter.Validate(); calcErr != nil {
		return mcp.NewToolResultError(fmt.Sprintf("invalid filter: %s", calcErr)), nil
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

// parseMCPDate parses a date string accepting several common formats.
func parseMCPDate(s string) (time.Time, error) {
	layouts := []string{"2006-01-02", "2006/01/02", time.RFC3339}
	for _, l := range layouts {
		if t, err := time.Parse(l, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unable to parse date: %s", s)
}

// handleUpdateTransaction updates an existing transaction owned by the authenticated user.
func (s *MCPServer) handleUpdateTransaction(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := mcpcontext.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("missing user authentication"), nil
	}

	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError("id is required"), nil
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

	txCtx, _, rollback, dbErr := s.withRLSTx(ctx, userID)
	if dbErr != nil {
		return mcp.NewToolResultError(fmt.Sprintf("database error: %s", dbErr)), nil
	}
	defer rollback()

	updated := transactionDomain.NewTransaction(
		id,
		name,
		req.GetString("description", ""),
		txType,
		accountID,
		categoryID,
		amount,
	)
	updated.UserId = userID
	updated.Currency = req.GetString("currency", "")
	if dateStr := req.GetString("date", ""); dateStr != "" {
		parsed, perr := time.Parse(time.RFC3339, dateStr)
		if perr != nil {
			return mcp.NewToolResultError("invalid date: expected RFC3339 format"), nil
		}
		updated.CreatedAt = parsed
	}

	if updateErr := s.services.Transaction.UpdateTransaction(txCtx, id, updated); updateErr != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to update transaction: %s", updateErr)), nil
	}

	if commitErr := mcpcontext.TxFromContext(txCtx).Commit(); commitErr != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to commit transaction: %s", commitErr)), nil
	}

	resp := map[string]string{"status": "updated", "id": id}
	data, _ := json.Marshal(resp)
	return mcp.NewToolResultText(string(data)), nil
}

// handleDeleteTransaction deletes a transaction owned by the authenticated user.
func (s *MCPServer) handleDeleteTransaction(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := mcpcontext.UserIDFromContext(ctx)
	if userID == "" {
		return mcp.NewToolResultError("missing user authentication"), nil
	}

	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError("id is required"), nil
	}

	txCtx, _, rollback, dbErr := s.withRLSTx(ctx, userID)
	if dbErr != nil {
		return mcp.NewToolResultError(fmt.Sprintf("database error: %s", dbErr)), nil
	}
	defer rollback()

	if delErr := s.services.Transaction.DeleteTransaction(txCtx, id, userID); delErr != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to delete transaction: %s", delErr)), nil
	}

	if commitErr := mcpcontext.TxFromContext(txCtx).Commit(); commitErr != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to commit transaction: %s", commitErr)), nil
	}

	resp := map[string]string{"status": "deleted", "id": id}
	data, _ := json.Marshal(resp)
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
