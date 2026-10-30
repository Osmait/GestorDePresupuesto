package mcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	recurringDomain "github.com/osmait/gestorDePresupuesto/internal/domain/recurring_transaction"
	budgetDTO "github.com/osmait/gestorDePresupuesto/internal/platform/dto/budget"
	"github.com/osmait/gestorDePresupuesto/internal/services/analytics"
)

// registerPlanningTools registers budgets, recurring transactions, the
// monthly plan, net worth and search. Called from registerExtraTools.
func (s *MCPServer) registerPlanningTools() {
	// --- Budgets ---
	s.addTool(
		mcp.NewTool("list_budgets",
			mcp.WithDescription("List the monthly budgets with their category, limit, what was spent this month, what remains and the share used"),
		),
		s.handleListBudgets,
	)
	s.addTool(
		mcp.NewTool("create_budget",
			mcp.WithDescription("Create a monthly spending limit for a category (one budget per category)"),
			mcp.WithString("category_id", mcp.Required(), mcp.Description("Category ID (see list_categories)")),
			mcp.WithNumber("amount", mcp.Required(), mcp.Description("Monthly limit (positive)")),
		),
		s.handleCreateBudget,
	)
	s.addTool(
		mcp.NewTool("update_budget",
			mcp.WithDescription("Change the limit (or the category) of a budget"),
			mcp.WithString("id", mcp.Required(), mcp.Description("Budget ID (see list_budgets)")),
			mcp.WithString("category_id", mcp.Required(), mcp.Description("Category ID")),
			mcp.WithNumber("amount", mcp.Required(), mcp.Description("Monthly limit (positive)")),
		),
		s.handleUpdateBudget,
	)
	s.addTool(
		mcp.NewTool("delete_budget",
			mcp.WithDescription("Delete a budget (its transactions are kept)"),
			mcp.WithString("id", mcp.Required(), mcp.Description("Budget ID")),
		),
		s.handleDeleteBudget,
	)

	// --- Recurring transactions ---
	s.addTool(
		mcp.NewTool("list_recurring_transactions",
			mcp.WithDescription("List recurring transactions (subscriptions, rent, salary...) with the day of the month and the next date they will be created"),
		),
		s.handleListRecurring,
	)
	s.addTool(
		mcp.NewTool("create_recurring_transaction",
			mcp.WithDescription("Create a transaction that the app records automatically every month on day_of_month"),
			mcp.WithString("name", mcp.Required(), mcp.Description("Name, e.g. Netflix")),
			mcp.WithNumber("amount", mcp.Required(), mcp.Description("Amount (positive)")),
			mcp.WithString("type", mcp.Required(), mcp.Description("income or bill"), mcp.Enum("income", "bill")),
			mcp.WithString("account_id", mcp.Required(), mcp.Description("Account ID")),
			mcp.WithString("category_id", mcp.Required(), mcp.Description("Category ID")),
			mcp.WithNumber("day_of_month", mcp.Required(), mcp.Description("Day of the month 1-31 (clamped to the month's last day)")),
			mcp.WithString("description", mcp.Description("Optional description")),
		),
		s.handleCreateRecurring,
	)
	s.addTool(
		mcp.NewTool("delete_recurring_transaction",
			mcp.WithDescription("Stop a recurring transaction (the transactions it already created are kept)"),
			mcp.WithString("id", mcp.Required(), mcp.Description("Recurring transaction ID")),
		),
		s.handleDeleteRecurring,
	)

	// --- Monthly plan, net worth, search ---
	s.addTool(
		mcp.NewTool("get_monthly_plan",
			mcp.WithDescription("The monthly plan: fixed monthly commitments and expected incomes, with totals in DOP, what is left available and the share committed"),
		),
		s.handleGetMonthlyPlan,
	)
	s.addTool(
		mcp.NewTool("get_net_worth",
			mcp.WithDescription("Net worth in DOP: bank accounts + investments + certificates - credit card debt (USD converted at the current rate)"),
		),
		s.handleGetNetWorth,
	)
	s.addTool(
		mcp.NewTool("search",
			mcp.WithDescription("Search transactions, accounts, categories, budgets, loans and certificates by text"),
			mcp.WithString("query", mcp.Required(), mcp.Description("Text to search for (at least 2 characters)")),
		),
		s.handleSearch,
	)
}

// =============== BUDGETS ===============

// budgetView is a budget as the assistant needs it: named, with what is left.
type budgetView struct {
	Id           string       `json:"id"`
	CategoryId   string       `json:"category_id"`
	CategoryName string       `json:"category_name"`
	Limit        money.Amount `json:"limit"`
	Spent        money.Amount `json:"spent"`
	Remaining    money.Amount `json:"remaining"`
	PercentUsed  float64      `json:"percent_used"`
}

func (s *MCPServer) handleListBudgets(ctx context.Context, _ mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	if s.services.Budget == nil {
		return mcp.NewToolResultError("budget service not configured"), nil
	}
	return s.runRO(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		budgets, err := s.services.Budget.FindAll(txCtx, userID)
		if err != nil {
			return nil, err
		}
		names := map[string]string{}
		if categories, catErr := s.services.Category.FindAll(txCtx, userID); catErr == nil {
			for _, c := range categories {
				names[c.Id] = c.Name
			}
		}
		views := make([]budgetView, 0, len(budgets))
		for _, b := range budgets {
			views = append(views, budgetView{
				Id:           b.Id,
				CategoryId:   b.CategoryId,
				CategoryName: names[b.CategoryId],
				Limit:        b.Amount,
				Spent:        b.CurrentAmount,
				Remaining:    b.Amount.Sub(b.CurrentAmount),
				PercentUsed:  money.Percent(b.CurrentAmount, b.Amount),
			})
		}
		return views, nil
	})
}

// budgetArgs reads category_id and a positive amount.
func budgetArgs(req mcp.CallToolRequest) (*budgetDTO.BudgetRequest, *mcp.CallToolResult) {
	categoryID, err := req.RequireString("category_id")
	if err != nil {
		return nil, mcp.NewToolResultError("category_id is required")
	}
	amount, argErr := amountArg(req, "amount", money.CentsScale)
	if argErr != nil || !amount.IsPositive() {
		return nil, mcp.NewToolResultError("amount must be a positive number")
	}
	return budgetDTO.NewBudgetRequest(categoryID, amount), nil
}

func (s *MCPServer) handleCreateBudget(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	in, bad := budgetArgs(req)
	if bad != nil {
		return bad, nil
	}
	return s.runRW(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		if err := s.services.Budget.CreateBudget(txCtx, in, userID); err != nil {
			return nil, err
		}
		return map[string]string{"status": "created"}, nil
	})
}

func (s *MCPServer) handleUpdateBudget(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError("id is required"), nil
	}
	in, bad := budgetArgs(req)
	if bad != nil {
		return bad, nil
	}
	return s.runRW(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		if err := s.services.Budget.UpdateBudget(txCtx, in, id, userID); err != nil {
			return nil, err
		}
		return map[string]string{"status": "updated", "id": id}, nil
	})
}

func (s *MCPServer) handleDeleteBudget(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError("id is required"), nil
	}
	return s.runRW(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		if err := s.services.Budget.Delete(txCtx, id, userID); err != nil {
			return nil, err
		}
		return map[string]string{"status": "deleted", "id": id}, nil
	})
}

// =============== RECURRING TRANSACTIONS ===============

func (s *MCPServer) handleListRecurring(ctx context.Context, _ mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	if s.services.Recurring == nil {
		return mcp.NewToolResultError("recurring transaction service not configured"), nil
	}
	return s.runRO(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		return s.services.Recurring.FindAllByUser(txCtx, userID)
	})
}

func (s *MCPServer) handleCreateRecurring(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	if s.services.Recurring == nil {
		return mcp.NewToolResultError("recurring transaction service not configured"), nil
	}
	name, err := req.RequireString("name")
	if err != nil {
		return mcp.NewToolResultError("name is required"), nil
	}
	amount, argErr := amountArg(req, "amount", money.CentsScale)
	if argErr != nil || !amount.IsPositive() {
		return mcp.NewToolResultError("amount must be a positive number"), nil
	}
	txType, err := req.RequireString("type")
	if err != nil || (txType != "income" && txType != "bill") {
		return mcp.NewToolResultError("type must be income or bill"), nil
	}
	accountID, err := req.RequireString("account_id")
	if err != nil {
		return mcp.NewToolResultError("account_id is required"), nil
	}
	categoryID, err := req.RequireString("category_id")
	if err != nil {
		return mcp.NewToolResultError("category_id is required"), nil
	}
	day := int(req.GetFloat("day_of_month", 0))
	if day < recurringDomain.MinDayOfMonth || day > recurringDomain.MaxDayOfMonth {
		return mcp.NewToolResultError(fmt.Sprintf("day_of_month must be between %d and %d", recurringDomain.MinDayOfMonth, recurringDomain.MaxDayOfMonth)), nil
	}

	rt := recurringDomain.NewRecurringTransaction("", userID, name, req.GetString("description", ""), amount, txType, accountID, categoryID, nil, day)
	return s.runRW(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		if err := s.services.Recurring.Create(txCtx, rt); err != nil {
			return nil, err
		}
		return rt, nil
	})
}

func (s *MCPServer) handleDeleteRecurring(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	if s.services.Recurring == nil {
		return mcp.NewToolResultError("recurring transaction service not configured"), nil
	}
	id, err := req.RequireString("id")
	if err != nil {
		return mcp.NewToolResultError("id is required"), nil
	}
	return s.runRW(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		if err := s.services.Recurring.Delete(txCtx, id, userID); err != nil {
			return nil, err
		}
		return map[string]string{"status": "deleted", "id": id}, nil
	})
}

// =============== MONTHLY PLAN, NET WORTH, SEARCH ===============

func (s *MCPServer) handleGetMonthlyPlan(ctx context.Context, _ mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	if s.services.MonthlyPlan == nil {
		return mcp.NewToolResultError("monthly plan service not configured"), nil
	}
	return s.runRO(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		summary, err := s.services.MonthlyPlan.Summary(txCtx, userID)
		if err != nil {
			return nil, err
		}
		items, err := s.services.MonthlyPlan.FindAllByUser(txCtx, userID)
		if err != nil {
			return nil, err
		}
		return map[string]interface{}{"summary": summary, "items": items}, nil
	})
}

// netWorth is the dashboard's net worth, in DOP.
type netWorth struct {
	NetWorth          money.Amount `json:"net_worth"`
	AccountsTotal     money.Amount `json:"accounts_total"`
	InvestmentsTotal  money.Amount `json:"investments_total"`
	CertificatesTotal money.Amount `json:"certificates_total"`
	CreditCardDebt    money.Amount `json:"credit_card_debt"`
	UsdToDopRate      money.Amount `json:"usd_to_dop_rate"`
}

func (s *MCPServer) handleGetNetWorth(ctx context.Context, _ mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	return s.runRO(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		// The balances it reads do not depend on the date range.
		summary, err := s.services.Analytics.GetDashboardSummary(txCtx, userID, analytics.DashboardFilters{})
		if err != nil {
			return nil, err
		}
		return netWorth{
			NetWorth: summary.AccountsTotal.Add(summary.InvestmentsTotal).Add(summary.CertificatesTotal).
				Sub(summary.CreditCardDebt).RoundCents(),
			AccountsTotal:     summary.AccountsTotal,
			InvestmentsTotal:  summary.InvestmentsTotal,
			CertificatesTotal: summary.CertificatesTotal,
			CreditCardDebt:    summary.CreditCardDebt,
			UsdToDopRate:      summary.UsdToDopRate,
		}, nil
	})
}

func (s *MCPServer) handleSearch(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, fail := authUserID(ctx)
	if fail != nil {
		return fail, nil
	}
	if s.services.Search == nil {
		return mcp.NewToolResultError("search service not configured"), nil
	}
	query, err := req.RequireString("query")
	if err != nil || len(strings.TrimSpace(query)) < 2 {
		return mcp.NewToolResultError("query must have at least 2 characters"), nil
	}
	return s.runRO(ctx, userID, func(txCtx context.Context) (interface{}, error) {
		return s.services.Search.Search(txCtx, userID, strings.TrimSpace(query))
	})
}
