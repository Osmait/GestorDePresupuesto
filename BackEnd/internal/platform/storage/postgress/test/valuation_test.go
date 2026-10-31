package postgress

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	domainInvestment "github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
	"github.com/osmait/gestorDePresupuesto/internal/platform/apptime"
	"github.com/osmait/gestorDePresupuesto/internal/platform/cache"
	budgetDto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/budget"
	loanDto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/loan"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	analyticsRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/analytics"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	certificateRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/certificate"
	investmentRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/investment"
	loanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/loan"
	notificationRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/notification"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	analyticsService "github.com/osmait/gestorDePresupuesto/internal/services/analytics"
	budgetService "github.com/osmait/gestorDePresupuesto/internal/services/budget"
	investmentService "github.com/osmait/gestorDePresupuesto/internal/services/investment"
	loanService "github.com/osmait/gestorDePresupuesto/internal/services/loan"
	notificationService "github.com/osmait/gestorDePresupuesto/internal/services/notification"
	transactionService "github.com/osmait/gestorDePresupuesto/internal/services/transaction"
)

type valuationFixture struct {
	t          *testing.T
	userID     string
	bankID     string
	categories *categoryRepo.CategoryRespository
	txService  *transactionService.TransactionService
	budgets    *budgetService.BudgetServices
	analytics  *analyticsService.AnalyticsService
	invest     *investmentService.InvestmentService
	loans      *loanService.LoanService
}

func newValuationFixture(t *testing.T, initial int64) *valuationFixture {
	t.Helper()
	ctx := context.Background()
	db := SetUpTest()

	user := utils.GetNewRandomUser()
	require.NoError(t, userRepo.NewUserRepository(db).Save(ctx, user))
	accounts := accountRepo.NewAccountRepository(db)
	bank := account.NewAccount(money.FromInt(initial), newID(), "Principal", "Ban Reservas")
	bank.UserId = user.Id
	require.NoError(t, accounts.Save(ctx, bank))

	rate := func(context.Context) (money.Amount, error) { return money.FromInt(60), nil }
	txRepo := transactionRepo.NewTransactionRepository(db)
	budgets := budgetRepo.NewBudgetRepository(db)
	categories := categoryRepo.NewCategoryRepository(db)
	txService := transactionService.NewTransactionService(txRepo, budgets,
		notificationService.NewNotificationService(notificationRepo.NewNotificationRepository(db)),
		cache.NewInMemoryCache(time.Minute, time.Minute), nil, rate)
	loans := loanRepo.NewLoanRepository(db)
	investments := investmentRepo.NewInvestmentRepository(db)

	return &valuationFixture{
		t: t, userID: user.Id, bankID: bank.Id, categories: categories, txService: txService,
		budgets: budgetService.NewBudgetServices(budgets, txRepo, rate),
		analytics: analyticsService.NewAnalyticsService(analyticsRepo.NewAnalyticsRepository(db), accounts, investments,
			certificateRepo.NewCertificateRepository(db), rate, analyticsService.WithLoans(loans)),
		invest: investmentService.NewInvestmentService(investments, nil, txService, accounts, categories),
		loans:  loanService.NewLoanService(loans, txService, accounts, categories, loanService.WithUsdToDopRate(rate)),
	}
}

func (f *valuationFixture) category(name string) string {
	f.t.Helper()
	c := category.NewCategory(newID(), name, "🛒", "#0f0")
	c.UserId = f.userID
	require.NoError(f.t, f.categories.Save(context.Background(), c))
	return c.Id
}

func (f *valuationFixture) bill(categoryID string, amount int64, at time.Time) {
	f.t.Helper()
	require.NoError(f.t, f.txService.CreateTransaction(context.Background(), "Compra", "", money.FromInt(amount), "bill",
		f.bankID, f.userID, categoryID, "", "DOP", at))
}

// spent returns each budget's spending this month, by budget id.
func (f *valuationFixture) spent() map[string]int64 {
	f.t.Helper()
	list, err := f.budgets.FindAll(context.Background(), f.userID)
	require.NoError(f.t, err)
	out := map[string]int64{}
	for _, b := range list {
		out[b.Id] = b.CurrentAmount.IntPart()
	}
	return out
}

func (f *valuationFixture) onlyBudget() string {
	f.t.Helper()
	list, err := f.budgets.FindAll(context.Background(), f.userID)
	require.NoError(f.t, err)
	require.Len(f.t, list, 1)
	return list[0].Id
}

// A budget's spending is its category's bills of the current local month,
// not the budget_id stamped on each bill: it sees bills written before it
// existed, survives being deleted and recreated, and follows its category.
func TestBudgetSpending_ByCategoryAndMonth(t *testing.T) {
	f := newValuationFixture(t, 1_000_000)
	ctx := context.Background()
	now := time.Now()
	lastMonth := apptime.StartOfMonth(now, apptime.Default()).Add(-time.Hour)

	supermarket := f.category("Supermercado")
	other := f.category("Otros")
	f.bill(supermarket, 3000, now)      // before any budget exists
	f.bill(supermarket, 999, lastMonth) // another month: never counts
	f.bill(other, 500, now)

	// created after the bill
	require.NoError(t, f.budgets.CreateBudget(ctx, budgetDto.NewBudgetRequest(supermarket, money.FromInt(5000)), f.userID))
	first := f.onlyBudget()
	require.Equal(t, map[string]int64{first: 3000}, f.spent())

	// deleted and recreated
	require.NoError(t, f.budgets.Delete(ctx, first, f.userID))
	require.NoError(t, f.budgets.CreateBudget(ctx, budgetDto.NewBudgetRequest(supermarket, money.FromInt(5000)), f.userID))
	recreated := f.onlyBudget()
	require.NotEqual(t, first, recreated)
	require.Equal(t, map[string]int64{recreated: 3000}, f.spent())

	// a new bill counts on the recreated budget
	f.bill(supermarket, 250, now)
	require.Equal(t, map[string]int64{recreated: 3250}, f.spent())

	// re-pointed to another category: it reports that category's bills
	require.NoError(t, f.budgets.UpdateBudget(ctx, budgetDto.NewBudgetRequest(other, money.FromInt(5000)), recreated, f.userID))
	require.Equal(t, map[string]int64{recreated: 500}, f.spent())
}

func (f *valuationFixture) netWorth() money.Amount {
	f.t.Helper()
	summary, err := f.analytics.GetDashboardSummary(context.Background(), f.userID, aroundNow())
	require.NoError(f.t, err)
	return summary.NetWorth
}

// Moving money between the user's own assets never changes net worth:
// funding the broker (with or without buying), buying a DOP or a USD
// position at its current price, and lending money.
func TestNetWorth_TransfersBetweenAssets(t *testing.T) {
	f := newValuationFixture(t, 200_000)
	ctx := context.Background()
	moneytest.Equal(t, 200_000, f.netWorth(), "initial")

	// fund the broker in DOP without buying
	require.NoError(t, f.invest.FundBroker(ctx, f.userID, investmentService.FundingRequest{
		SourceAccountID: f.bankID, SourceAmount: money.FromInt(60_000), TargetCurrency: "DOP",
	}))
	summary, err := f.analytics.GetDashboardSummary(ctx, f.userID, aroundNow())
	require.NoError(t, err)
	moneytest.Equal(t, 140_000, summary.AccountsTotal)
	moneytest.Equal(t, 60_000, summary.BrokerCashTotal)
	moneytest.Equal(t, 200_000, summary.NetWorth, "after funding the broker")

	// a DOP position bought at its current price is worth what it cost
	require.NoError(t, f.invest.Create(ctx, "", f.userID, domainInvestment.FixedIncome, "Bono", "BONO",
		money.FromInt(2), money.FromInt(5_000), money.FromInt(5_000), "DOP"))
	summary, err = f.analytics.GetDashboardSummary(ctx, f.userID, aroundNow())
	require.NoError(t, err)
	moneytest.Equal(t, 10_000, summary.InvestmentsTotal, "dop position is not multiplied by the rate")
	moneytest.Equal(t, 50_000, summary.BrokerCashTotal)
	moneytest.Equal(t, 200_000, summary.NetWorth, "after buying in DOP")

	// fund in USD at the dashboard's rate (60) and buy a USD position
	require.NoError(t, f.invest.FundBroker(ctx, f.userID, investmentService.FundingRequest{
		SourceAccountID: f.bankID, SourceAmount: money.FromInt(6_000), TargetCurrency: "USD", ExchangeRate: money.FromInt(60),
	}))
	moneytest.Equal(t, 200_000, f.netWorth(), "after funding in USD")
	require.NoError(t, f.invest.Create(ctx, "", f.userID, domainInvestment.Stock, "Apple", "AAPL",
		money.FromInt(1), money.FromInt(100), money.FromInt(100), "USD"))
	moneytest.Equal(t, 200_000, f.netWorth(), "after buying in USD")

	// lend 50,000: the outstanding principal is an asset
	created, err := f.loans.CreateLoan(ctx, &loanDto.CreateLoanRequest{
		BorrowerName: "Ana", PrincipalAmount: money.FromInt(50_000), Currency: "DOP",
		InterestMode: string(loan.InterestModeNone), TermMonths: 5, SourceAccountId: f.bankID,
	}, f.userID)
	require.NoError(t, err)
	summary, err = f.analytics.GetDashboardSummary(ctx, f.userID, aroundNow())
	require.NoError(t, err)
	moneytest.Equal(t, 50_000, summary.LoansReceivableTotal)
	moneytest.Equal(t, 200_000, summary.NetWorth, "after lending")

	// cancelling refunds the principal to the account: still unchanged
	require.NoError(t, f.loans.CancelLoan(ctx, created.Id, f.userID))
	summary, err = f.analytics.GetDashboardSummary(ctx, f.userID, aroundNow())
	require.NoError(t, err)
	moneytest.Equal(t, 0, summary.LoansReceivableTotal)
	moneytest.Equal(t, 200_000, summary.NetWorth, "after cancelling the loan")

	// the loan summary only counts active loans as pending
	loanSummary, err := f.loans.GetSummary(ctx, f.userID)
	require.NoError(t, err)
	moneytest.Equal(t, 0, loanSummary.TotalPending)
	moneytest.Equal(t, 0, loanSummary.TotalPrincipal)
}
