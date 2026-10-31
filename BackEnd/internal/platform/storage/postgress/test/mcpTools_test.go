package postgress

import (
	"context"
	"database/sql"
	"encoding/json"
	"testing"
	"time"

	mcpgo "github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
	"github.com/osmait/gestorDePresupuesto/internal/platform/cache"
	creditcardDto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/platform/mcp"
	"github.com/osmait/gestorDePresupuesto/internal/platform/mcp/mcpcontext"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	analyticsRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/analytics"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	certificateRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/certificate"
	creditcardRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/creditcard"
	loanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/loan"
	monthlyPlanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/monthly_plan"
	notificationRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/notification"
	recurringRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/recurring_transaction"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	accountService "github.com/osmait/gestorDePresupuesto/internal/services/account"
	analyticsService "github.com/osmait/gestorDePresupuesto/internal/services/analytics"
	budgetService "github.com/osmait/gestorDePresupuesto/internal/services/budget"
	categoryService "github.com/osmait/gestorDePresupuesto/internal/services/category"
	creditcardService "github.com/osmait/gestorDePresupuesto/internal/services/creditcard"
	monthlyPlanService "github.com/osmait/gestorDePresupuesto/internal/services/monthly_plan"
	notificationService "github.com/osmait/gestorDePresupuesto/internal/services/notification"
	recurringService "github.com/osmait/gestorDePresupuesto/internal/services/recurring_transaction"
	searchService "github.com/osmait/gestorDePresupuesto/internal/services/search"
	transactionService "github.com/osmait/gestorDePresupuesto/internal/services/transaction"
)

// The MCP tools against a real database, called through the registered
// handlers like a client would.

type mcpFixture struct {
	db      *sql.DB
	srv     *mcp.MCPServer
	ctx     context.Context
	userId  string
	bankId  string
	foodCat string
	cards   *creditcardService.CreditCardService
}

func newMCPFixture(t *testing.T) *mcpFixture {
	t.Helper()
	ctx := context.Background()
	db := SetUpTest()

	user := utils.GetNewRandomUser()
	require.NoError(t, userRepo.NewUserRepository(db).Save(ctx, user))
	accRepo := accountRepo.NewAccountRepository(db)
	bank := account.NewAccount(money.FromInt(10_000), newID(), "Principal", "Ban Reservas")
	bank.UserId = user.Id
	require.NoError(t, accRepo.Save(ctx, bank))
	categories := categoryRepo.NewCategoryRepository(db)
	food := category.NewCategory(newID(), "Comida", "🍔", "#f00")
	food.UserId = user.Id
	require.NoError(t, categories.Save(ctx, food))

	txRepo := transactionRepo.NewTransactionRepository(db)
	notifications := notificationService.NewNotificationService(notificationRepo.NewNotificationRepository(db))
	txService := transactionService.NewTransactionService(txRepo, budgetRepo.NewBudgetRepository(db),
		notifications, cache.NewInMemoryCache(time.Minute, time.Minute), nil, nil)
	rate := func(context.Context) (money.Amount, error) { return money.FromInt(60), nil }
	cards := creditcardService.NewCreditCardService(creditcardRepo.NewCreditCardRepository(db), accRepo, txService)

	srv := mcp.NewMCPServer("test", "0", &mcp.Services{
		Account: accountService.NewAccountService(accRepo,
			accountService.WithReconciliation(accountRepo.NewReconciliationRepository(db), txService, categories)),
		Transaction: txService,
		Category:    categoryService.NewCategoryServices(categories),
		Budget:      budgetService.NewBudgetServices(budgetRepo.NewBudgetRepository(db), txRepo, rate),
		Analytics:   analyticsService.NewAnalyticsService(analyticsRepo.NewAnalyticsRepository(db), accRepo, nil, nil, rate),
		CreditCard:  cards,
		Recurring:   recurringService.NewRecurringTransactionService(recurringRepo.NewRecurringTransactionRepository(db), txService, notifications),
		MonthlyPlan: monthlyPlanService.NewMonthlyPlanService(monthlyPlanRepo.NewMonthlyPlanRepository(db), rate),
		Search: searchService.NewSearchService(txRepo, categories, accRepo, budgetRepo.NewBudgetRepository(db),
			loanRepo.NewLoanRepository(db), certificateRepo.NewCertificateRepository(db)),
	}, db)
	return &mcpFixture{db: db, srv: srv, ctx: mcpcontext.WithUserID(ctx, user.Id), userId: user.Id, bankId: bank.Id, foodCat: food.Id, cards: cards}
}

// call runs tool with args and returns its text and whether it failed.
func (f *mcpFixture) call(t *testing.T, tool string, args map[string]any) (string, bool) {
	t.Helper()
	st := f.srv.GetServer().GetTool(tool)
	require.NotNil(t, st, tool)
	req := mcpgo.CallToolRequest{}
	req.Params.Name = tool
	req.Params.Arguments = args
	res, err := st.Handler(f.ctx, req)
	require.NoError(t, err)
	require.NotEmpty(t, res.Content)
	return res.Content[0].(mcpgo.TextContent).Text, res.IsError
}

func (f *mcpFixture) mustCall(t *testing.T, tool string, args map[string]any, out any) {
	t.Helper()
	text, isErr := f.call(t, tool, args)
	require.False(t, isErr, "%s: %s", tool, text)
	if out != nil {
		require.NoError(t, json.Unmarshal([]byte(text), out), text)
	}
}

func TestMCPTools(t *testing.T) {
	t.Run("create_transaction uses the account currency and a calendar date", func(t *testing.T) {
		f := newMCPFixture(t)
		f.mustCall(t, "create_transaction", map[string]any{
			"name": "Colmado", "amount": 450.5, "type": "bill",
			"account_id": f.bankId, "category_id": f.foodCat, "date": "2026-10-15",
		}, nil)

		var currency string
		var createdAt time.Time
		require.NoError(t, f.db.QueryRow(`SELECT currency, created_at FROM transactions WHERE account_id = $1`, f.bankId).Scan(&currency, &createdAt))
		assert.Equal(t, "DOP", currency)
		assert.True(t, createdAt.Equal(time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)), "created_at %s", createdAt)

		text, isErr := f.call(t, "create_transaction", map[string]any{
			"name": "x", "amount": 1, "type": "bill", "account_id": f.bankId, "category_id": f.foodCat, "date": "15/10/2026",
		})
		assert.True(t, isErr)
		assert.Contains(t, text, "invalid date")
	})

	t.Run("update_transaction keeps the currency when it is omitted", func(t *testing.T) {
		f := newMCPFixture(t)
		card, err := f.cards.CreateCreditCard(context.Background(), &creditcardDto.CreateCreditCardRequest{
			Name: "Visa", Bank: "BHD", CutDay: 5, DueDay: 20,
			Balances: []creditcardDto.CreateBalanceRequest{
				{Currency: "DOP", CreditLimit: money.FromInt(50_000)},
				{Currency: "USD", CreditLimit: money.FromInt(1_000)},
			},
		}, f.userId)
		require.NoError(t, err)
		f.mustCall(t, "create_transaction", map[string]any{
			"name": "Amazon", "amount": 100, "type": "bill", "currency": "USD",
			"account_id": card.Id, "category_id": f.foodCat, "date": "2026-10-15",
		}, nil)
		var id, currency string
		require.NoError(t, f.db.QueryRow(`SELECT id, currency FROM transactions WHERE account_id = $1 AND transaction_name = 'Amazon'`, card.Id).Scan(&id, &currency))
		require.Equal(t, "USD", currency)

		// A US$100 charge on a DOP card must not become RD$100.
		f.mustCall(t, "update_transaction", map[string]any{
			"id": id, "name": "Amazon order", "amount": 100, "type": "bill",
			"account_id": card.Id, "category_id": f.foodCat, "date": "2026-10-15",
		}, nil)
		require.NoError(t, f.db.QueryRow(`SELECT currency FROM transactions WHERE id = $1`, id).Scan(&currency))
		assert.Equal(t, "USD", currency)

		// An explicit currency still wins.
		f.mustCall(t, "update_transaction", map[string]any{
			"id": id, "name": "Amazon order", "amount": 100, "type": "bill", "currency": "DOP",
			"account_id": card.Id, "category_id": f.foodCat, "date": "2026-10-15",
		}, nil)
		require.NoError(t, f.db.QueryRow(`SELECT currency FROM transactions WHERE id = $1`, id).Scan(&currency))
		assert.Equal(t, "DOP", currency)

		// Moved to another account without a currency: that account's currency.
		f.mustCall(t, "update_transaction", map[string]any{
			"id": id, "name": "Amazon order", "amount": 100, "type": "bill", "currency": "USD",
			"account_id": card.Id, "category_id": f.foodCat, "date": "2026-10-15",
		}, nil)
		f.mustCall(t, "update_transaction", map[string]any{
			"id": id, "name": "Amazon order", "amount": 100, "type": "bill",
			"account_id": f.bankId, "category_id": f.foodCat, "date": "2026-10-15",
		}, nil)
		require.NoError(t, f.db.QueryRow(`SELECT currency FROM transactions WHERE id = $1`, id).Scan(&currency))
		assert.Equal(t, "DOP", currency)

		// Another user's (or an unknown) transaction is not found.
		text, isErr := f.call(t, "update_transaction", map[string]any{
			"id": newID(), "name": "x", "amount": 1, "type": "bill", "account_id": f.bankId, "category_id": f.foodCat,
		})
		assert.True(t, isErr)
		assert.Contains(t, text, "failed to update transaction")
	})

	t.Run("list_transactions pages and searches", func(t *testing.T) {
		f := newMCPFixture(t)
		for i, name := range []string{"Netflix", "Colmado", "Super Bravo", "Colmado Hnos", "Farmacia"} {
			f.mustCall(t, "create_transaction", map[string]any{
				"name": name, "amount": 100 + i, "type": "bill", "account_id": f.bankId, "category_id": f.foodCat,
				"date": time.Date(2026, 10, 1+i, 0, 0, 0, 0, time.UTC).Format("2006-01-02"),
			}, nil)
		}
		type page struct {
			Data []struct {
				Name string `json:"name"`
			} `json:"data"`
			Pagination struct {
				TotalRecords int  `json:"total_records"`
				HasNextPage  bool `json:"has_next_page"`
			} `json:"pagination"`
		}
		var p2 page
		f.mustCall(t, "list_transactions", map[string]any{"limit": 2, "page": 2}, &p2)
		require.Len(t, p2.Data, 2)
		assert.Equal(t, "Super Bravo", p2.Data[0].Name, "newest first: Farmacia, Colmado Hnos | Super Bravo, Colmado")
		assert.Equal(t, 5, p2.Pagination.TotalRecords)
		assert.True(t, p2.Pagination.HasNextPage)

		var found page
		f.mustCall(t, "list_transactions", map[string]any{"search": "colmado"}, &found)
		assert.Len(t, found.Data, 2)

		// Wildcards in the search text are literal: "50%" is not "50 then anything".
		for _, name := range []string{"Oferta 50% off", "500 pesos"} {
			f.mustCall(t, "create_transaction", map[string]any{
				"name": name, "amount": 1, "type": "bill", "account_id": f.bankId, "category_id": f.foodCat,
			}, nil)
		}
		var literal page
		f.mustCall(t, "list_transactions", map[string]any{"search": "50%"}, &literal)
		require.Len(t, literal.Data, 1)
		assert.Equal(t, "Oferta 50% off", literal.Data[0].Name)
	})

	t.Run("managed transactions cannot be edited, nor a payment received deleted", func(t *testing.T) {
		f := newMCPFixture(t)
		// An adjustment from reconciling the account.
		var rec struct {
			Reconciliation struct {
				TransactionId string `json:"transaction_id"`
			} `json:"reconciliation"`
		}
		f.mustCall(t, "reconcile_account", map[string]any{"id": f.bankId, "bank_balance": 9_500}, &rec)
		adjustmentId := rec.Reconciliation.TransactionId
		require.NotEmpty(t, adjustmentId)

		text, isErr := f.call(t, "update_transaction", map[string]any{
			"id": adjustmentId, "name": "edited", "amount": 1, "type": "bill", "account_id": f.bankId, "category_id": f.foodCat,
		})
		assert.True(t, isErr)
		assert.Contains(t, text, "managed by the app")

		// A card payment received is one side of a payment.
		card, err := f.cards.CreateCreditCard(context.Background(), &creditcardDto.CreateCreditCardRequest{
			Name: "Visa", Bank: "BHD", CutDay: 5, DueDay: 20,
			Balances: []creditcardDto.CreateBalanceRequest{{Currency: "DOP", CreditLimit: money.FromInt(5_000), InitialDebt: money.FromInt(1_000)}},
		}, f.userId)
		require.NoError(t, err)
		f.mustCall(t, "pay_credit_card", map[string]any{"card_id": card.Id, "from_account_id": f.bankId, "currency": "DOP", "amount": 300}, nil)
		var receivedId string
		require.NoError(t, f.db.QueryRow(`SELECT id FROM transactions WHERE account_id = $1 AND type_transation = 'card_payment_received'`, card.Id).Scan(&receivedId))
		text, isErr = f.call(t, "delete_transaction", map[string]any{"id": receivedId})
		assert.True(t, isErr)
		assert.Contains(t, text, "managed by the app")

		// Nor the paying side: deleting it would give the money back while the
		// card stays paid (and bypass the overdraft check).
		var paidId string
		require.NoError(t, f.db.QueryRow(`SELECT id FROM transactions WHERE account_id = $1 AND type_transation = 'card_payment'`, f.bankId).Scan(&paidId))
		text, isErr = f.call(t, "delete_transaction", map[string]any{"id": paidId})
		assert.True(t, isErr)
		assert.Contains(t, text, "managed by the app")

		// Deleting the adjustment undoes it.
		f.mustCall(t, "delete_transaction", map[string]any{"id": adjustmentId}, nil)
	})

	t.Run("budgets show what is spent and what is left", func(t *testing.T) {
		f := newMCPFixture(t)
		f.mustCall(t, "create_budget", map[string]any{"category_id": f.foodCat, "amount": 2_000}, nil)
		f.mustCall(t, "create_transaction", map[string]any{
			"name": "Super", "amount": 500, "type": "bill", "account_id": f.bankId, "category_id": f.foodCat,
		}, nil)

		var budgets []struct {
			Id           string       `json:"id"`
			CategoryName string       `json:"category_name"`
			Limit        money.Amount `json:"limit"`
			Spent        money.Amount `json:"spent"`
			Remaining    money.Amount `json:"remaining"`
			PercentUsed  float64      `json:"percent_used"`
		}
		f.mustCall(t, "list_budgets", nil, &budgets)
		require.Len(t, budgets, 1)
		assert.Equal(t, "Comida", budgets[0].CategoryName)
		moneytest.Equal(t, 2_000, budgets[0].Limit)
		moneytest.Equal(t, 500, budgets[0].Spent)
		moneytest.Equal(t, 1_500, budgets[0].Remaining)
		assert.InDelta(t, 25, budgets[0].PercentUsed, 0.001)

		f.mustCall(t, "update_budget", map[string]any{"id": budgets[0].Id, "category_id": f.foodCat, "amount": 1_000}, nil)
		f.mustCall(t, "list_budgets", nil, &budgets)
		moneytest.Equal(t, 500, budgets[0].Remaining)

		_, isErr := f.call(t, "create_budget", map[string]any{"category_id": f.foodCat, "amount": -5})
		assert.True(t, isErr)
		f.mustCall(t, "delete_budget", map[string]any{"id": budgets[0].Id}, nil)
	})

	t.Run("get_net_worth subtracts card debt", func(t *testing.T) {
		f := newMCPFixture(t)
		_, err := f.cards.CreateCreditCard(context.Background(), &creditcardDto.CreateCreditCardRequest{
			Name: "Visa", Bank: "BHD", CutDay: 5, DueDay: 20,
			Balances: []creditcardDto.CreateBalanceRequest{{Currency: "DOP", CreditLimit: money.FromInt(5_000), InitialDebt: money.FromInt(1_200)}},
		}, f.userId)
		require.NoError(t, err)

		var nw struct {
			NetWorth       money.Amount `json:"net_worth"`
			AccountsTotal  money.Amount `json:"accounts_total"`
			CreditCardDebt money.Amount `json:"credit_card_debt"`
		}
		f.mustCall(t, "get_net_worth", nil, &nw)
		moneytest.Equal(t, 10_000, nw.AccountsTotal)
		moneytest.Equal(t, 1_200, nw.CreditCardDebt)
		moneytest.Equal(t, 8_800, nw.NetWorth)
	})

	t.Run("recurring transactions, monthly plan and search", func(t *testing.T) {
		f := newMCPFixture(t)
		var rt struct {
			ID                string     `json:"id"`
			DayOfMonth        int        `json:"day_of_month"`
			NextExecutionDate *time.Time `json:"next_execution_date"`
		}
		f.mustCall(t, "create_recurring_transaction", map[string]any{
			"name": "Netflix", "amount": 650, "type": "bill", "account_id": f.bankId, "category_id": f.foodCat, "day_of_month": 15,
		}, &rt)
		require.NotEmpty(t, rt.ID)
		require.NotNil(t, rt.NextExecutionDate)
		assert.Equal(t, 15, rt.NextExecutionDate.Day())

		_, isErr := f.call(t, "create_recurring_transaction", map[string]any{
			"name": "x", "amount": 1, "type": "bill", "account_id": f.bankId, "category_id": f.foodCat, "day_of_month": 40,
		})
		assert.True(t, isErr)

		var list []struct {
			Name string `json:"name"`
		}
		f.mustCall(t, "list_recurring_transactions", nil, &list)
		require.Len(t, list, 1)
		assert.Equal(t, "Netflix", list[0].Name)

		var plan struct {
			Summary map[string]any   `json:"summary"`
			Items   []map[string]any `json:"items"`
		}
		f.mustCall(t, "get_monthly_plan", nil, &plan)
		assert.NotNil(t, plan.Summary)

		text, isErr := f.call(t, "search", map[string]any{"query": "Comida"})
		require.False(t, isErr, text)
		assert.Contains(t, text, "Comida")
		_, isErr = f.call(t, "search", map[string]any{"query": "x"})
		assert.True(t, isErr)

		f.mustCall(t, "delete_recurring_transaction", map[string]any{"id": rt.ID}, nil)
		f.mustCall(t, "list_recurring_transactions", nil, &list)
		assert.Empty(t, list)
	})
}
