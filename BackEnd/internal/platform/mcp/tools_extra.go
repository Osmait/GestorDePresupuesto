package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	accountDTO "github.com/osmait/gestorDePresupuesto/internal/platform/dto/account"
	categoryDTO "github.com/osmait/gestorDePresupuesto/internal/platform/dto/category"
	creditcardDTO "github.com/osmait/gestorDePresupuesto/internal/platform/dto/creditcard"
	loanDTO "github.com/osmait/gestorDePresupuesto/internal/platform/dto/loan"
	"github.com/osmait/gestorDePresupuesto/internal/platform/mcp/mcpcontext"
	"github.com/osmait/gestorDePresupuesto/internal/services/analytics"
)

// registerExtraTools registers the extended MCP tools (accounts, categories,
// credit cards, loans, analytics by period). Called from registerTools.
func (s *MCPServer) registerExtraTools() {
	// --- Accounts ---
	s.server.AddTool(
		mcp.NewTool("create_account",
			mcp.WithDescription("Create a new bank account for the authenticated user"),
			mcp.WithString("name", mcp.Required(), mcp.Description("Account name")),
			mcp.WithString("bank", mcp.Required(), mcp.Description("Bank name")),
			mcp.WithNumber("initial_balance", mcp.Description("Initial balance (default 0)")),
		),
		s.handleCreateAccount,
	)
	s.server.AddTool(
		mcp.NewTool("update_account",
			mcp.WithDescription("Update an account's name and bank"),
			mcp.WithString("id", mcp.Required(), mcp.Description("Account ID")),
			mcp.WithString("name", mcp.Required(), mcp.Description("New name")),
			mcp.WithString("bank", mcp.Required(), mcp.Description("New bank")),
		),
		s.handleUpdateAccount,
	)
	s.server.AddTool(
		mcp.NewTool("delete_account",
			mcp.WithDescription("Delete an account owned by the authenticated user"),
			mcp.WithString("id", mcp.Required(), mcp.Description("Account ID")),
		),
		s.handleDeleteAccount,
	)

	// --- Categories ---
	s.server.AddTool(
		mcp.NewTool("create_category",
			mcp.WithDescription("Create a new transaction category"),
			mcp.WithString("name", mcp.Required(), mcp.Description("Category name")),
			mcp.WithString("icon", mcp.Required(), mcp.Description("Emoji or icon identifier")),
			mcp.WithString("color", mcp.Required(), mcp.Description("Hex color (e.g. #FF6B6B)")),
		),
		s.handleCreateCategory,
	)
	s.server.AddTool(
		mcp.NewTool("update_category",
			mcp.WithDescription("Update an existing category"),
			mcp.WithString("id", mcp.Required(), mcp.Description("Category ID")),
			mcp.WithString("name", mcp.Required(), mcp.Description("New name")),
			mcp.WithString("icon", mcp.Required(), mcp.Description("New icon")),
			mcp.WithString("color", mcp.Required(), mcp.Description("New color")),
		),
		s.handleUpdateCategory,
	)
	s.server.AddTool(
		mcp.NewTool("delete_category",
			mcp.WithDescription("Delete a category owned by the authenticated user"),
			mcp.WithString("id", mcp.Required(), mcp.Description("Category ID")),
		),
		s.handleDeleteCategory,
	)

	// --- Balance / analytics by period ---
	s.server.AddTool(
		mcp.NewTool("balance_by_period",
			mcp.WithDescription("Return income, expenses and net for a period (current month by default)"),
			mcp.WithString("period", mcp.Description("Preset period"), mcp.Enum("this_week", "this_month", "last_month", "this_year", "custom")),
			mcp.WithString("date_from", mcp.Description("Custom start date YYYY-MM-DD (required when period=custom)")),
			mcp.WithString("date_to", mcp.Description("Custom end date YYYY-MM-DD (required when period=custom)")),
		),
		s.handleBalanceByPeriod,
	)
	s.server.AddTool(
		mcp.NewTool("financial_summary",
			mcp.WithDescription("Return a financial summary with current month, previous month and percentage change"),
		),
		s.handleFinancialSummary,
	)

	// --- Credit cards ---
	s.server.AddTool(
		mcp.NewTool("list_credit_cards",
			mcp.WithDescription("List all credit cards with their current balances"),
		),
		s.handleListCreditCards,
	)
	s.server.AddTool(
		mcp.NewTool("credit_card_summary",
			mcp.WithDescription("Return aggregate credit card metrics: total debt, total limit and utilization per currency"),
		),
		s.handleCreditCardSummary,
	)
	s.server.AddTool(
		mcp.NewTool("pay_credit_card",
			mcp.WithDescription("Pay a credit card from a bank account"),
			mcp.WithString("card_id", mcp.Required(), mcp.Description("Credit card (account) ID")),
			mcp.WithString("from_account_id", mcp.Required(), mcp.Description("Source account ID")),
			mcp.WithString("currency", mcp.Required(), mcp.Description("Payment currency (e.g. DOP, USD)")),
			mcp.WithNumber("amount", mcp.Required(), mcp.Description("Amount in the card's currency")),
			mcp.WithNumber("exchange_rate", mcp.Description("Exchange rate when source and card currencies differ")),
			mcp.WithBoolean("includes_interest", mcp.Description("Whether the payment includes interest")),
			mcp.WithNumber("interest_amount", mcp.Description("Interest portion (if any)")),
			mcp.WithString("notes", mcp.Description("Optional notes")),
		),
		s.handlePayCreditCard,
	)
	s.server.AddTool(
		mcp.NewTool("reset_credit_card_balance",
			mcp.WithDescription("Reset a credit card balance to zero for a given currency, storing the previous balance in history"),
			mcp.WithString("card_id", mcp.Required(), mcp.Description("Credit card (account) ID")),
			mcp.WithString("balance_id", mcp.Description("Specific balance ID to reset")),
			mcp.WithString("currency", mcp.Description("Currency to reset (use if balance_id is unknown)")),
			mcp.WithString("notes", mcp.Description("Optional notes")),
		),
		s.handleResetCreditCardBalance,
	)

	// --- Loans ---
	s.server.AddTool(
		mcp.NewTool("list_loans",
			mcp.WithDescription("List all loans for the authenticated user"),
		),
		s.handleListLoans,
	)
	s.server.AddTool(
		mcp.NewTool("get_loan",
			mcp.WithDescription("Get loan details including installments and payments"),
			mcp.WithString("id", mcp.Required(), mcp.Description("Loan ID")),
		),
		s.handleGetLoan,
	)
	s.server.AddTool(
		mcp.NewTool("create_loan",
			mcp.WithDescription("Create a new loan issued from a source account"),
			mcp.WithString("borrower_name", mcp.Required(), mcp.Description("Borrower name")),
			mcp.WithNumber("principal_amount", mcp.Required(), mcp.Description("Principal amount")),
			mcp.WithString("interest_mode", mcp.Required(), mcp.Description("Interest mode"), mcp.Enum("fixed_total", "none")),
			mcp.WithNumber("annual_rate", mcp.Description("Annual rate (percent, 0-100)")),
			mcp.WithNumber("term_months", mcp.Required(), mcp.Description("Term in months (1-120)")),
			mcp.WithString("source_account_id", mcp.Required(), mcp.Description("Account funding the loan")),
			mcp.WithString("currency", mcp.Description("Currency code (defaults to DOP)")),
			mcp.WithString("start_date", mcp.Description("Start date YYYY-MM-DD (defaults to today)")),
			mcp.WithString("borrower_contact", mcp.Description("Optional contact info")),
			mcp.WithString("notes", mcp.Description("Optional notes")),
		),
		s.handleCreateLoan,
	)
	s.server.AddTool(
		mcp.NewTool("register_loan_payment",
			mcp.WithDescription("Register a payment received for a loan"),
			mcp.WithString("loan_id", mcp.Required(), mcp.Description("Loan ID")),
			mcp.WithString("destination_account_id", mcp.Required(), mcp.Description("Account that receives the payment")),
			mcp.WithNumber("amount", mcp.Required(), mcp.Description("Payment amount")),
			mcp.WithString("payment_date", mcp.Description("Payment date YYYY-MM-DD (defaults to today)")),
			mcp.WithString("notes", mcp.Description("Optional notes")),
		),
		s.handleRegisterLoanPayment,
	)
	s.server.AddTool(
		mcp.NewTool("loan_summary",
			mcp.WithDescription("Return aggregated loan metrics for the authenticated user"),
		),
		s.handleLoanSummary,
	)
}

// withRLSTxResult is a small helper to make the commit-on-success pattern concise.
func (s *MCPServer) runRW(ctx context.Context, userID string, fn func(ctx context.Context) (interface{}, error)) (*mcp.CallToolResult, error) {
	txCtx, _, rollback, err := s.withRLSTx(ctx, userID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("database error: %s", err)), nil
	}
	defer rollback()

	result, fnErr := fn(txCtx)
	if fnErr != nil {
		return mcp.NewToolResultError(fnErr.Error()), nil
	}
	if commitErr := mcpcontext.TxFromContext(txCtx).Commit(); commitErr != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to commit transaction: %s", commitErr)), nil
	}

	data, _ := json.Marshal(result)
	return mcp.NewToolResultText(string(data)), nil
}

func (s *MCPServer) runRO(ctx context.Context, userID string, fn func(ctx context.Context) (interface{}, error)) (*mcp.CallToolResult, error) {
	txCtx, commit, rollback, err := s.withRLSTx(ctx, userID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("database error: %s", err)), nil
	}
	defer commit()
	defer rollback()

	result, fnErr := fn(txCtx)
	if fnErr != nil {
		return mcp.NewToolResultError(fnErr.Error()), nil
	}
	data, _ := json.Marshal(result)
	return mcp.NewToolResultText(string(data)), nil
}

func authUserID(ctx context.Context) (string, *mcp.CallToolResult) {
	userID := mcpcontext.UserIDFromContext(ctx)
	if userID == "" {
		return "", mcp.NewToolResultError("missing user authentication")
	}
	return userID, nil
}

// =============== ACCOUNTS ===============

func (s *MCPServer) handleCreateAccount(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	name, err := req.RequireString("name")
	if err != nil {
		return mcp.NewToolResultError("name is required"), nil
	}
	bank, err := req.RequireString("bank")
	if err != nil {
		return mcp.NewToolResultError("bank is required"), nil
	}
	initialBalance := req.GetFloat("initial_balance", 0)

	return s.runRW(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		if createErr := s.services.Account.CreateAccount(txCtx, name, bank, initialBalance, userID); createErr != nil {
			return nil, fmt.Errorf("failed to create account: %w", createErr)
		}
		return map[string]string{"status": "created"}, nil
	})
}

func (s *MCPServer) handleUpdateAccount(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError("id is required"), nil
	}
	name, err := req.RequireString("name")
	if err != nil {
		return mcp.NewToolResultError("name is required"), nil
	}
	bank, err := req.RequireString("bank")
	if err != nil {
		return mcp.NewToolResultError("bank is required"), nil
	}

	return s.runRW(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		upd := accountDTO.NewAccountUpdateRequest(name, bank)
		if updErr := s.services.Account.UpdateAccount(txCtx, id, upd, userID); updErr != nil {
			return nil, fmt.Errorf("failed to update account: %w", updErr)
		}
		return map[string]string{"status": "updated", "id": id}, nil
	})
}

func (s *MCPServer) handleDeleteAccount(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError("id is required"), nil
	}
	return s.runRW(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		if delErr := s.services.Account.DeleteAccount(txCtx, id, userID); delErr != nil {
			return nil, fmt.Errorf("failed to delete account: %w", delErr)
		}
		return map[string]string{"status": "deleted", "id": id}, nil
	})
}

// =============== CATEGORIES ===============

func (s *MCPServer) handleCreateCategory(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	name, err := req.RequireString("name")
	if err != nil {
		return mcp.NewToolResultError("name is required"), nil
	}
	icon, err := req.RequireString("icon")
	if err != nil {
		return mcp.NewToolResultError("icon is required"), nil
	}
	color, err := req.RequireString("color")
	if err != nil {
		return mcp.NewToolResultError("color is required"), nil
	}

	return s.runRW(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		catReq := categoryDTO.NewCategoryRequest(name, icon, color)
		if createErr := s.services.Category.CreateCategory(txCtx, catReq, userID); createErr != nil {
			return nil, fmt.Errorf("failed to create category: %w", createErr)
		}
		return map[string]string{"status": "created"}, nil
	})
}

func (s *MCPServer) handleUpdateCategory(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError("id is required"), nil
	}
	name, err := req.RequireString("name")
	if err != nil {
		return mcp.NewToolResultError("name is required"), nil
	}
	icon, err := req.RequireString("icon")
	if err != nil {
		return mcp.NewToolResultError("icon is required"), nil
	}
	color, err := req.RequireString("color")
	if err != nil {
		return mcp.NewToolResultError("color is required"), nil
	}

	return s.runRW(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		catReq := categoryDTO.NewCategoryRequest(name, icon, color)
		if updErr := s.services.Category.UpdateCategory(txCtx, catReq, id, userID); updErr != nil {
			return nil, fmt.Errorf("failed to update category: %w", updErr)
		}
		return map[string]string{"status": "updated", "id": id}, nil
	})
}

func (s *MCPServer) handleDeleteCategory(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError("id is required"), nil
	}
	return s.runRW(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		if delErr := s.services.Category.Delete(txCtx, id, userID); delErr != nil {
			return nil, fmt.Errorf("failed to delete category: %w", delErr)
		}
		return map[string]string{"status": "deleted", "id": id}, nil
	})
}

// =============== ANALYTICS BY PERIOD ===============

func resolvePeriodRange(period, dateFrom, dateTo string) (time.Time, time.Time, error) {
	now := time.Now()
	switch period {
	case "", "this_month":
		from := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		to := from.AddDate(0, 1, 0).Add(-time.Nanosecond)
		return from, to, nil
	case "last_month":
		prev := now.AddDate(0, -1, 0)
		from := time.Date(prev.Year(), prev.Month(), 1, 0, 0, 0, 0, now.Location())
		to := from.AddDate(0, 1, 0).Add(-time.Nanosecond)
		return from, to, nil
	case "this_week":
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		from := now.AddDate(0, 0, -(weekday - 1)).Truncate(24 * time.Hour)
		to := from.AddDate(0, 0, 6).Add(23*time.Hour + 59*time.Minute + 59*time.Second)
		return from, to, nil
	case "this_year":
		from := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
		to := time.Date(now.Year()+1, 1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Nanosecond)
		return from, to, nil
	case "custom":
		if dateFrom == "" || dateTo == "" {
			return time.Time{}, time.Time{}, fmt.Errorf("date_from and date_to are required when period=custom")
		}
		from, err := parseMCPDate(dateFrom)
		if err != nil {
			return time.Time{}, time.Time{}, fmt.Errorf("invalid date_from: %w", err)
		}
		to, err := parseMCPDate(dateTo)
		if err != nil {
			return time.Time{}, time.Time{}, fmt.Errorf("invalid date_to: %w", err)
		}
		return from, to.Add(23*time.Hour + 59*time.Minute + 59*time.Second), nil
	default:
		return time.Time{}, time.Time{}, fmt.Errorf("invalid period: %s", period)
	}
}

func (s *MCPServer) handleBalanceByPeriod(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	period := req.GetString("period", "this_month")
	from, to, perr := resolvePeriodRange(period, req.GetString("date_from", ""), req.GetString("date_to", ""))
	if perr != nil {
		return mcp.NewToolResultError(perr.Error()), nil
	}

	return s.runRO(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		summary, err := s.services.Analytics.GetDashboardSummary(txCtx, userID, analytics.DashboardFilters{
			DateFrom: from,
			DateTo:   to,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to compute balance: %w", err)
		}
		return map[string]interface{}{
			"period":         period,
			"date_from":      from.Format("2006-01-02"),
			"date_to":        to.Format("2006-01-02"),
			"total_income":   summary.TotalIncome,
			"total_expenses": summary.TotalExpenses,
			"net_amount":     summary.NetAmount,
			"usd_to_dop":     summary.UsdToDopRate,
		}, nil
	})
}

func (s *MCPServer) handleFinancialSummary(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}

	currFrom, currTo, _ := resolvePeriodRange("this_month", "", "")
	prevFrom, prevTo, _ := resolvePeriodRange("last_month", "", "")

	return s.runRO(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		curr, err := s.services.Analytics.GetDashboardSummary(txCtx, userID, analytics.DashboardFilters{DateFrom: currFrom, DateTo: currTo})
		if err != nil {
			return nil, fmt.Errorf("failed to load current month: %w", err)
		}
		prev, err := s.services.Analytics.GetDashboardSummary(txCtx, userID, analytics.DashboardFilters{DateFrom: prevFrom, DateTo: prevTo})
		if err != nil {
			return nil, fmt.Errorf("failed to load previous month: %w", err)
		}
		pctChange := func(curr, prev float64) float64 {
			if prev == 0 {
				if curr == 0 {
					return 0
				}
				return 100
			}
			return ((curr - prev) / prev) * 100
		}
		return map[string]interface{}{
			"current_month": map[string]interface{}{
				"date_from": currFrom.Format("2006-01-02"),
				"date_to":   currTo.Format("2006-01-02"),
				"income":    curr.TotalIncome,
				"expenses":  curr.TotalExpenses,
				"net":       curr.NetAmount,
			},
			"previous_month": map[string]interface{}{
				"date_from": prevFrom.Format("2006-01-02"),
				"date_to":   prevTo.Format("2006-01-02"),
				"income":    prev.TotalIncome,
				"expenses":  prev.TotalExpenses,
				"net":       prev.NetAmount,
			},
			"change_percent": map[string]float64{
				"income":   pctChange(curr.TotalIncome, prev.TotalIncome),
				"expenses": pctChange(curr.TotalExpenses, prev.TotalExpenses),
				"net":      pctChange(curr.NetAmount, prev.NetAmount),
			},
			"accounts_total": curr.AccountsTotal,
			"usd_to_dop":     curr.UsdToDopRate,
		}, nil
	})
}

// =============== CREDIT CARDS ===============

func (s *MCPServer) handleListCreditCards(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	if s.services.CreditCard == nil {
		return mcp.NewToolResultError("credit card service not configured"), nil
	}
	return s.runRO(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		return s.services.CreditCard.FindAllCards(txCtx, userID)
	})
}

func (s *MCPServer) handleCreditCardSummary(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	if s.services.CreditCard == nil {
		return mcp.NewToolResultError("credit card service not configured"), nil
	}
	return s.runRO(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		return s.services.CreditCard.GetSummary(txCtx, userID)
	})
}

func (s *MCPServer) handlePayCreditCard(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	if s.services.CreditCard == nil {
		return mcp.NewToolResultError("credit card service not configured"), nil
	}
	cardID, err := req.RequireString("card_id")
	if err != nil {
		return mcp.NewToolResultError("card_id is required"), nil
	}
	fromAccount, err := req.RequireString("from_account_id")
	if err != nil {
		return mcp.NewToolResultError("from_account_id is required"), nil
	}
	currency, err := req.RequireString("currency")
	if err != nil {
		return mcp.NewToolResultError("currency is required"), nil
	}
	amount := req.GetFloat("amount", 0)
	if amount <= 0 {
		return mcp.NewToolResultError("amount must be positive"), nil
	}

	payReq := &creditcardDTO.CreatePaymentRequest{
		FromAccountId:    fromAccount,
		Currency:         currency,
		Amount:           amount,
		ExchangeRate:     req.GetFloat("exchange_rate", 0),
		IncludesInterest: req.GetBool("includes_interest", false),
		InterestAmount:   req.GetFloat("interest_amount", 0),
		Notes:            req.GetString("notes", ""),
	}

	return s.runRW(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		resp, payErr := s.services.CreditCard.CreatePayment(txCtx, cardID, userID, payReq)
		if payErr != nil {
			return nil, fmt.Errorf("failed to pay credit card: %w", payErr)
		}
		return resp, nil
	})
}

func (s *MCPServer) handleResetCreditCardBalance(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	if s.services.CreditCard == nil {
		return mcp.NewToolResultError("credit card service not configured"), nil
	}
	cardID, err := req.RequireString("card_id")
	if err != nil {
		return mcp.NewToolResultError("card_id is required"), nil
	}

	resetReq := &creditcardDTO.ResetBalanceRequest{
		BalanceId: req.GetString("balance_id", ""),
		Currency:  req.GetString("currency", ""),
		Notes:     req.GetString("notes", ""),
	}
	if resetReq.BalanceId == "" && resetReq.Currency == "" {
		return mcp.NewToolResultError("balance_id or currency is required"), nil
	}

	return s.runRW(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		return s.services.CreditCard.ResetCardBalance(txCtx, cardID, userID, resetReq)
	})
}

// =============== LOANS ===============

func (s *MCPServer) handleListLoans(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	if s.services.Loan == nil {
		return mcp.NewToolResultError("loan service not configured"), nil
	}
	return s.runRO(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		return s.services.Loan.FindAll(txCtx, userID)
	})
}

func (s *MCPServer) handleGetLoan(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	if s.services.Loan == nil {
		return mcp.NewToolResultError("loan service not configured"), nil
	}
	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError("id is required"), nil
	}
	return s.runRO(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		return s.services.Loan.FindById(txCtx, id, userID)
	})
}

func (s *MCPServer) handleCreateLoan(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	if s.services.Loan == nil {
		return mcp.NewToolResultError("loan service not configured"), nil
	}
	borrower, err := req.RequireString("borrower_name")
	if err != nil {
		return mcp.NewToolResultError("borrower_name is required"), nil
	}
	principal := req.GetFloat("principal_amount", 0)
	if principal <= 0 {
		return mcp.NewToolResultError("principal_amount must be positive"), nil
	}
	interestMode, err := req.RequireString("interest_mode")
	if err != nil {
		return mcp.NewToolResultError("interest_mode is required"), nil
	}
	termMonths := int(req.GetFloat("term_months", 0))
	if termMonths <= 0 {
		return mcp.NewToolResultError("term_months must be positive"), nil
	}
	sourceAccount, err := req.RequireString("source_account_id")
	if err != nil {
		return mcp.NewToolResultError("source_account_id is required"), nil
	}

	loanReq := &loanDTO.CreateLoanRequest{
		BorrowerName:    borrower,
		BorrowerContact: req.GetString("borrower_contact", ""),
		PrincipalAmount: principal,
		Currency:        req.GetString("currency", ""),
		InterestMode:    interestMode,
		AnnualRate:      req.GetFloat("annual_rate", 0),
		TermMonths:      termMonths,
		StartDate:       req.GetString("start_date", ""),
		SourceAccountId: sourceAccount,
		Notes:           req.GetString("notes", ""),
	}
	if validErr := loanReq.Validate(); validErr != nil {
		return mcp.NewToolResultError(validErr.Error()), nil
	}

	return s.runRW(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		return s.services.Loan.CreateLoan(txCtx, loanReq, userID)
	})
}

func (s *MCPServer) handleRegisterLoanPayment(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	if s.services.Loan == nil {
		return mcp.NewToolResultError("loan service not configured"), nil
	}
	loanID, err := req.RequireString("loan_id")
	if err != nil {
		return mcp.NewToolResultError("loan_id is required"), nil
	}
	destAccount, err := req.RequireString("destination_account_id")
	if err != nil {
		return mcp.NewToolResultError("destination_account_id is required"), nil
	}
	amount := req.GetFloat("amount", 0)
	if amount <= 0 {
		return mcp.NewToolResultError("amount must be positive"), nil
	}

	payReq := &loanDTO.RegisterLoanPaymentRequest{
		DestinationAccountId: destAccount,
		Amount:               amount,
		PaymentDate:          req.GetString("payment_date", ""),
		Notes:                req.GetString("notes", ""),
	}
	if validErr := payReq.Validate(); validErr != nil {
		return mcp.NewToolResultError(validErr.Error()), nil
	}

	return s.runRW(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		return s.services.Loan.RegisterPayment(txCtx, loanID, userID, payReq)
	})
}

func (s *MCPServer) handleLoanSummary(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	if s.services.Loan == nil {
		return mcp.NewToolResultError("loan service not configured"), nil
	}
	return s.runRO(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		return s.services.Loan.GetSummary(txCtx, userID)
	})
}
