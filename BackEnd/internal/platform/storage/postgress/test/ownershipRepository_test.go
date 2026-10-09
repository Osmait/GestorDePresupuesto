package postgress

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/segmentio/ksuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
	"github.com/osmait/gestorDePresupuesto/internal/domain/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
	"github.com/osmait/gestorDePresupuesto/internal/domain/notification"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	transactionDto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	certificateRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/certificate"
	creditcardRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/creditcard"
	investmentRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/investment"
	loanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/loan"
	monthlyPlanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/monthly_plan"
	notificationRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/notification"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/ownership"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
)

// repos bundles every repository exercised by the ownership tests.
type repos struct {
	account      *accountRepo.AccountRepository
	category     *categoryRepo.CategoryRespository
	budget       *budgetRepo.BudgetRepository
	transaction  *transactionRepo.TransactionRepository
	investment   *investmentRepo.InvestmentRepository
	certificate  *certificateRepo.CertificateRepository
	creditCard   *creditcardRepo.CreditCardRepository
	loan         *loanRepo.LoanRepository
	monthlyPlan  *monthlyPlanRepo.MonthlyPlanRepository
	notification *notificationRepo.NotificationRepository
}

func newRepos() repos {
	db := SetUpTest()
	return repos{
		account:      accountRepo.NewAccountRepository(db),
		category:     categoryRepo.NewCategoryRepository(db),
		budget:       budgetRepo.NewBudgetRepository(db),
		transaction:  transactionRepo.NewTransactionRepository(db),
		investment:   investmentRepo.NewInvestmentRepository(db),
		certificate:  certificateRepo.NewCertificateRepository(db),
		creditCard:   creditcardRepo.NewCreditCardRepository(db),
		loan:         loanRepo.NewLoanRepository(db),
		monthlyPlan:  monthlyPlanRepo.NewMonthlyPlanRepository(db),
		notification: notificationRepo.NewNotificationRepository(db),
	}
}

// tenant is one user together with one row of every user-owned resource.
type tenant struct {
	userID         string
	accountID      string
	categoryID     string
	budgetID       string
	transactionID  string
	investmentID   string
	certificateID  string
	certPaymentID  string
	cardID         string
	cardBalanceID  string
	cardPaymentID  string
	loanID         string
	installmentID  string
	monthlyPlanID  string
	notificationID string
}

func newID() string { return ksuid.New().String() }

func seedTenant(t *testing.T, r repos) tenant {
	t.Helper()
	ctx := context.Background()

	user := utils.GetNewRandomUser()
	require.NoError(t, userRepo.NewUserRepository(SetUpTest()).Save(ctx, user))
	tn := tenant{userID: user.Id}

	acc := account.NewAccount(money.Zero, newID(), "Checking", "Bank")
	acc.UserId = tn.userID
	require.NoError(t, r.account.Save(ctx, acc))
	tn.accountID = acc.Id

	cat := category.NewCategory(newID(), "Food", "tag", "#123456")
	cat.UserId = tn.userID
	require.NoError(t, r.category.Save(ctx, cat))
	tn.categoryID = cat.Id

	bud := budget.NewBudget(newID(), tn.categoryID, tn.userID, money.FromInt(500))
	require.NoError(t, r.budget.Save(ctx, bud))
	tn.budgetID = bud.Id

	txn := transaction.NewTransaction(newID(), "Groceries", "weekly", "bill", tn.accountID, tn.categoryID, money.FromInt(42))
	txn.UserId = tn.userID
	txn.CreatedAt = time.Now()
	require.NoError(t, r.transaction.Save(ctx, txn))
	tn.transactionID = txn.Id

	inv := investment.NewInvestment(newID(), tn.userID, investment.Stock, "Apple", "AAPL", money.FromInt(1), money.FromInt(100), money.FromInt(100))
	require.NoError(t, r.investment.Save(ctx, inv))
	tn.investmentID = inv.ID

	cert := certificate.NewCertificate(newID(), tn.userID, "Bank", money.FromInt(1000), certificate.InterestTypeSimple, money.FromInt(10), money.FromInt(10), 15)
	require.NoError(t, r.certificate.Save(ctx, cert))
	tn.certificateID = cert.Id
	now := time.Now()
	certPayment := certificate.NewCertificatePayment(newID(), cert.Id, tn.userID, now, now.AddDate(0, -1, 0), now, money.FromInt(10), money.FromInt(1), money.FromInt(9), money.FromInt(10), money.FromInt(10), money.FromInt(1000))
	require.NoError(t, r.certificate.SavePayment(ctx, certPayment))
	tn.certPaymentID = certPayment.Id

	cardAccount := account.NewCreditCardAccount(newID(), "Visa", "Bank")
	cardAccount.UserId = tn.userID
	require.NoError(t, r.account.Save(ctx, cardAccount))
	require.NoError(t, r.creditCard.SaveCard(ctx, creditcard.NewCreditCard(cardAccount.Id, "Bank", "1234", 10, 20)))
	tn.cardID = cardAccount.Id
	balance := creditcard.NewCardBalance(newID(), tn.cardID, "DOP", money.FromInt(10000))
	require.NoError(t, r.creditCard.SaveBalance(ctx, balance))
	tn.cardBalanceID = balance.Id
	cardPayment := creditcard.NewCardPayment(newID(), tn.cardID, tn.accountID, "DOP", money.FromInt(100))
	require.NoError(t, r.creditCard.SavePayment(ctx, cardPayment, tn.userID))
	tn.cardPaymentID = cardPayment.Id

	ln := &loan.Loan{
		Id: newID(), UserId: tn.userID, BorrowerName: "Bob", PrincipalAmount: money.FromInt(1000), Currency: "DOP",
		InterestMode: loan.InterestModeNone, TermMonths: 1, StartDate: now, SourceAccountId: tn.accountID,
		TotalAmount: money.FromInt(1000), Status: loan.LoanStatusActive, CreatedAt: now, UpdatedAt: now,
	}
	installment := &loan.Installment{
		Id: newID(), LoanId: ln.Id, InstallmentNumber: 1, DueDate: now.AddDate(0, 1, 0),
		ExpectedAmount: money.FromInt(1000), Status: loan.InstallmentStatusPending, CreatedAt: now, UpdatedAt: now,
	}
	require.NoError(t, r.loan.SaveLoanWithInstallments(ctx, ln, []*loan.Installment{installment}))
	tn.loanID = ln.Id
	tn.installmentID = installment.Id

	item := utils.GetNewRandomMonthlyPlanItem()
	item.UserID = tn.userID
	item.CategoryID = &tn.categoryID
	item.AccountID = &tn.accountID
	require.NoError(t, r.monthlyPlan.Save(ctx, item))
	tn.monthlyPlanID = item.ID

	n := notification.Notification{ID: uuid.New(), UserID: tn.userID, Type: "info", Message: "hello", CreatedAt: now}
	require.NoError(t, r.notification.Save(ctx, n))
	tn.notificationID = n.ID.String()

	return tn
}

// TestRepositories_CrossUserAccess proves, for every user-owned resource, that
// user B (attacker) can neither read, update nor delete user A's (owner) rows,
// and that B cannot reference A's rows as foreign keys. Not-owned rows must be
// reported exactly like missing rows (ownership.ErrNotFound).
func TestRepositories_CrossUserAccess(t *testing.T) {
	r := newRepos()
	owner := seedTenant(t, r)
	attacker := seedTenant(t, r)
	ctx := context.Background()
	a := attacker.userID

	tests := []struct {
		name    string
		attack  func() error
		wantErr error
	}{
		// accounts
		{"account: find", func() error { _, err := r.account.FindByIdAndUserId(ctx, owner.accountID, a); return err }, ownership.ErrNotFound},
		{"account: update", func() error { return r.account.Update(ctx, owner.accountID, "x", "y", a) }, ownership.ErrNotFound},
		{"account: delete", func() error { return r.account.Delete(ctx, owner.accountID, a) }, ownership.ErrNotFound},

		// categories
		{"category: find", func() error { _, err := r.category.FindOne(ctx, owner.categoryID, a); return err }, ownership.ErrNotFound},
		{"category: update", func() error {
			c := category.NewCategory(owner.categoryID, "x", "x", "#000000")
			c.UserId = a
			return r.category.Update(ctx, c)
		}, ownership.ErrNotFound},
		{"category: delete", func() error { return r.category.Delete(ctx, owner.categoryID, a) }, ownership.ErrNotFound},

		// budgets
		{"budget: find", func() error { _, err := r.budget.FindOne(ctx, owner.budgetID, a); return err }, ownership.ErrNotFound},
		{"budget: update", func() error {
			return r.budget.Update(ctx, budget.NewBudget(owner.budgetID, attacker.categoryID, a, money.FromInt(1)))
		}, ownership.ErrNotFound},
		{"budget: delete", func() error { return r.budget.Delete(ctx, owner.budgetID, a) }, ownership.ErrNotFound},
		{"budget: create on another user's category", func() error {
			return r.budget.Save(ctx, budget.NewBudget(newID(), owner.categoryID, a, money.FromInt(1)))
		}, ownership.ErrReferenceNotOwned},

		// transactions
		{"transaction: update", func() error {
			txn := transaction.NewTransaction(owner.transactionID, "x", "x", "bill", attacker.accountID, attacker.categoryID, money.FromInt(1))
			txn.UserId = a
			return r.transaction.Update(ctx, owner.transactionID, txn)
		}, ownership.ErrNotFound},
		{"transaction: delete", func() error { return r.transaction.Delete(ctx, owner.transactionID, a) }, ownership.ErrNotFound},
		{"transaction: move own row into another user's account", func() error {
			txn := transaction.NewTransaction(attacker.transactionID, "x", "x", "bill", owner.accountID, attacker.categoryID, money.FromInt(1))
			txn.UserId = a
			return r.transaction.Update(ctx, attacker.transactionID, txn)
		}, ownership.ErrReferenceNotOwned},
		{"transaction: move own row into another user's category", func() error {
			txn := transaction.NewTransaction(attacker.transactionID, "x", "x", "bill", attacker.accountID, owner.categoryID, money.FromInt(1))
			txn.UserId = a
			return r.transaction.Update(ctx, attacker.transactionID, txn)
		}, ownership.ErrReferenceNotOwned},
		{"transaction: point own row at another user's budget", func() error {
			txn := transaction.NewTransaction(attacker.transactionID, "x", "x", "bill", attacker.accountID, attacker.categoryID, money.FromInt(1))
			txn.UserId = a
			txn.BudgetId = owner.budgetID
			return r.transaction.Update(ctx, attacker.transactionID, txn)
		}, ownership.ErrReferenceNotOwned},
		{"transaction: create in another user's account", func() error {
			txn := transaction.NewTransaction(newID(), "x", "x", "bill", owner.accountID, attacker.categoryID, money.FromInt(1))
			txn.UserId = a
			return r.transaction.Save(ctx, txn)
		}, ownership.ErrReferenceNotOwned},
		{"transaction: currency lookup on another user's account", func() error {
			_, err := r.transaction.ResolveAndValidateCurrencyForAccount(ctx, a, owner.accountID, "")
			return err
		}, ownership.ErrReferenceNotOwned},

		// investments
		{"investment: find", func() error { _, err := r.investment.FindByID(ctx, owner.investmentID, a); return err }, ownership.ErrNotFound},
		{"investment: update", func() error {
			inv := investment.NewInvestment(owner.investmentID, a, investment.Stock, "x", "X", money.FromInt(1), money.FromInt(1), money.FromInt(1))
			return r.investment.Update(ctx, inv)
		}, ownership.ErrNotFound},
		{"investment: delete", func() error { return r.investment.Delete(ctx, owner.investmentID, a) }, ownership.ErrNotFound},
		{"investment: reference another user's account", func() error {
			inv := investment.NewInvestment(attacker.investmentID, a, investment.Stock, "x", "X", money.FromInt(1), money.FromInt(1), money.FromInt(1))
			inv.SourceAccountID = owner.accountID
			return r.investment.Update(ctx, inv)
		}, ownership.ErrReferenceNotOwned},

		// certificates
		{"certificate: find", func() error { _, err := r.certificate.FindById(ctx, owner.certificateID, a); return err }, ownership.ErrNotFound},
		{"certificate: update", func() error {
			cert := certificate.NewCertificate(owner.certificateID, a, "x", money.FromInt(1), certificate.InterestTypeSimple, money.FromInt(1), money.FromInt(1), 1)
			return r.certificate.Update(ctx, cert)
		}, ownership.ErrNotFound},
		{"certificate: update status", func() error {
			return r.certificate.UpdateStatus(ctx, owner.certificateID, a, certificate.StatusMatured)
		}, ownership.ErrNotFound},
		{"certificate: delete", func() error { return r.certificate.Delete(ctx, owner.certificateID, a) }, ownership.ErrNotFound},
		{"certificate: find payment", func() error {
			_, err := r.certificate.FindPaymentById(ctx, owner.certPaymentID, a)
			return err
		}, ownership.ErrNotFound},
		{"certificate: last payment", func() error {
			_, err := r.certificate.FindLastPayment(ctx, owner.certificateID, a)
			return ownership.NotFoundIfNoRows(err)
		}, ownership.ErrNotFound},
		{"certificate: link payment to transaction", func() error {
			return r.certificate.UpdatePaymentTransaction(ctx, owner.certPaymentID, a, attacker.transactionID)
		}, ownership.ErrNotFound},
		{"certificate: payout to another user's account", func() error {
			cert := certificate.NewCertificate(attacker.certificateID, a, "x", money.FromInt(1), certificate.InterestTypeSimple, money.FromInt(1), money.FromInt(1), 1)
			cert.PayoutAccountId = &owner.accountID
			return r.certificate.Update(ctx, cert)
		}, ownership.ErrReferenceNotOwned},

		// credit cards
		{"credit card: find", func() error { _, err := r.creditCard.FindCardById(ctx, owner.cardID, a); return err }, ownership.ErrNotFound},
		{"credit card: update", func() error {
			return r.creditCard.UpdateCard(ctx, creditcard.NewCreditCard(owner.cardID, "x", "0000", 1, 2), a)
		}, ownership.ErrNotFound},
		{"credit card: delete", func() error { return r.creditCard.DeleteCard(ctx, owner.cardID, a) }, ownership.ErrNotFound},
		{"credit card: find balance", func() error {
			_, err := r.creditCard.FindBalanceById(ctx, owner.cardBalanceID, a)
			return err
		}, ownership.ErrNotFound},
		{"credit card: find balance by currency", func() error {
			_, err := r.creditCard.FindBalanceByCardAndCurrency(ctx, owner.cardID, a, "DOP")
			return err
		}, ownership.ErrNotFound},
		{"credit card: update credit limit", func() error {
			_, err := r.creditCard.UpdateCreditLimit(ctx, owner.cardBalanceID, a, money.FromInt(1))
			return err
		}, ownership.ErrNotFound},
		{"credit card: adjust balance", func() error {
			_, err := r.creditCard.AdjustBalance(ctx, owner.cardBalanceID, a, money.FromInt(999))
			return err
		}, ownership.ErrNotFound},
		{"credit card: reset balance", func() error {
			_, err := r.creditCard.ResetBalance(ctx, owner.cardBalanceID, a)
			return err
		}, ownership.ErrNotFound},
		{"credit card: update balance by amount", func() error {
			return r.creditCard.UpdateBalanceByAmount(ctx, owner.cardID, a, "DOP", money.FromInt(999))
		}, ownership.ErrNotFound},
		{"credit card: delete balance", func() error { return r.creditCard.DeleteBalance(ctx, owner.cardBalanceID, a) }, ownership.ErrNotFound},
		{"credit card: find payment", func() error {
			_, err := r.creditCard.FindPaymentById(ctx, owner.cardPaymentID, a)
			return err
		}, ownership.ErrNotFound},
		{"credit card: delete payment", func() error { return r.creditCard.DeletePayment(ctx, owner.cardPaymentID, a) }, ownership.ErrNotFound},
		{"credit card: pay another user's card", func() error {
			return r.creditCard.SavePayment(ctx, creditcard.NewCardPayment(newID(), owner.cardID, attacker.accountID, "DOP", money.FromInt(1)), a)
		}, ownership.ErrReferenceNotOwned},
		{"credit card: pay from another user's account", func() error {
			return r.creditCard.SavePayment(ctx, creditcard.NewCardPayment(newID(), attacker.cardID, owner.accountID, "DOP", money.FromInt(1)), a)
		}, ownership.ErrReferenceNotOwned},

		// loans
		{"loan: find", func() error { _, err := r.loan.FindById(ctx, owner.loanID, a); return err }, ownership.ErrNotFound},
		{"loan: update status", func() error {
			return r.loan.UpdateLoanStatus(ctx, owner.loanID, a, loan.LoanStatusCancelled)
		}, ownership.ErrNotFound},
		{"loan: update totals", func() error {
			return r.loan.UpdateLoanTotals(ctx, &loan.Loan{Id: owner.loanID, UserId: a, Status: loan.LoanStatusPaid, UpdatedAt: time.Now()})
		}, ownership.ErrNotFound},
		{"loan: register payment", func() error {
			return r.loan.SavePayment(ctx, &loan.Payment{Id: newID(), LoanId: owner.loanID, DestinationAccountId: attacker.accountID, Amount: money.FromInt(1), PaymentDate: time.Now(), CreatedAt: time.Now()}, a)
		}, ownership.ErrNotFound},
		{"loan: payment into another user's account", func() error {
			return r.loan.SavePayment(ctx, &loan.Payment{Id: newID(), LoanId: attacker.loanID, DestinationAccountId: owner.accountID, Amount: money.FromInt(1), PaymentDate: time.Now(), CreatedAt: time.Now()}, a)
		}, ownership.ErrReferenceNotOwned},
		{"loan: create from another user's account", func() error {
			now := time.Now()
			return r.loan.SaveLoanWithInstallments(ctx, &loan.Loan{
				Id: newID(), UserId: a, BorrowerName: "x", PrincipalAmount: money.FromInt(1), Currency: "DOP", InterestMode: loan.InterestModeNone,
				TermMonths: 1, StartDate: now, SourceAccountId: owner.accountID, TotalAmount: money.FromInt(1), Status: loan.LoanStatusActive, CreatedAt: now, UpdatedAt: now,
			}, nil)
		}, ownership.ErrReferenceNotOwned},

		// monthly plan
		{"monthly plan: reference another user's category", func() error {
			item := utils.GetNewRandomMonthlyPlanItem()
			item.UserID = a
			item.CategoryID = &owner.categoryID
			return r.monthlyPlan.Save(ctx, item)
		}, ownership.ErrReferenceNotOwned},
		{"monthly plan: reference another user's account", func() error {
			item := utils.GetNewRandomMonthlyPlanItem()
			item.ID = attacker.monthlyPlanID
			item.UserID = a
			item.AccountID = &owner.accountID
			_, err := r.monthlyPlan.Update(ctx, item)
			return err
		}, ownership.ErrReferenceNotOwned},

		// notifications
		{"notification: mark as read", func() error { return r.notification.MarkAsRead(ctx, owner.notificationID, a) }, ownership.ErrNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.attack()
			require.Error(t, err)
			assert.ErrorIs(t, err, tt.wantErr)
		})
	}

	t.Run("not-owned and not-found are indistinguishable", func(t *testing.T) {
		_, foreignErr := r.investment.FindByID(ctx, owner.investmentID, a)
		_, missingErr := r.investment.FindByID(ctx, newID(), a)
		assert.Equal(t, missingErr, foreignErr)
		assert.ErrorIs(t, foreignErr, errorhttp.ErrNotFound)
	})

	t.Run("scoped lists never include another user's rows", func(t *testing.T) {
		filter := transactionDto.NewTransactionFilter()
		filter.AccountId = owner.accountID
		rows, err := r.transaction.FindAllWithFilters(ctx, a, filter)
		require.NoError(t, err)
		assert.Empty(t, rows)

		count, err := r.transaction.CountWithFilters(ctx, a, filter)
		require.NoError(t, err)
		assert.Zero(t, count)

		_, err = r.transaction.FindAllWithFilters(ctx, "", filter)
		assert.Error(t, err, "an unscoped transaction query must be refused")

		date1 := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
		date2 := time.Now().AddDate(0, 0, 1).Format("2006-01-02")
		byAccount, err := r.transaction.FindAll(ctx, date1, date2, owner.accountID, a)
		require.NoError(t, err)
		assert.Empty(t, byAccount)

		balances, err := r.creditCard.FindBalancesByCard(ctx, owner.cardID, a)
		require.NoError(t, err)
		assert.Empty(t, balances)

		payments, err := r.creditCard.FindPaymentsByCard(ctx, owner.cardID, a)
		require.NoError(t, err)
		assert.Empty(t, payments)

		resets, err := r.creditCard.FindBalanceResetsByCard(ctx, owner.cardID, a)
		require.NoError(t, err)
		assert.Empty(t, resets)

		installments, err := r.loan.FindInstallmentsByLoan(ctx, owner.loanID, a)
		require.NoError(t, err)
		assert.Empty(t, installments)

		loanPayments, err := r.loan.FindPaymentsByLoan(ctx, owner.loanID, a)
		require.NoError(t, err)
		assert.Empty(t, loanPayments)

		certPayments, err := r.certificate.FindPaymentsByCertificate(ctx, owner.certificateID, a)
		require.NoError(t, err)
		assert.Empty(t, certPayments)

		balance, err := r.account.Balance(ctx, owner.accountID, a)
		require.NoError(t, err)
		assert.True(t, balance.IsZero())

		foreignBudget, err := r.budget.FindByCategory(ctx, owner.categoryID, a)
		require.NoError(t, err)
		assert.Nil(t, foreignBudget)
	})

	t.Run("bulk installment update skips another user's loan", func(t *testing.T) {
		now := time.Now()
		err := r.loan.BulkUpdateInstallments(ctx, []*loan.Installment{{
			Id: owner.installmentID, PaidAmount: money.FromInt(1000), Status: loan.InstallmentStatusPaid, PaidAt: &now, UpdatedAt: now,
		}}, a)
		require.NoError(t, err)

		installments, err := r.loan.FindInstallmentsByLoan(ctx, owner.loanID, owner.userID)
		require.NoError(t, err)
		require.Len(t, installments, 1)
		assert.Equal(t, loan.InstallmentStatusPending, installments[0].Status)
	})

	t.Run("owner rows are untouched", func(t *testing.T) {
		_, err := r.account.FindByIdAndUserId(ctx, owner.accountID, owner.userID)
		assert.NoError(t, err)
		_, err = r.category.FindOne(ctx, owner.categoryID, owner.userID)
		assert.NoError(t, err)
		_, err = r.budget.FindOne(ctx, owner.budgetID, owner.userID)
		assert.NoError(t, err)
		inv, err := r.investment.FindByID(ctx, owner.investmentID, owner.userID)
		require.NoError(t, err)
		assert.Equal(t, "Apple", inv.Name)
		cert, err := r.certificate.FindById(ctx, owner.certificateID, owner.userID)
		require.NoError(t, err)
		assert.Equal(t, certificate.StatusActive, cert.Status)
		bal, err := r.creditCard.FindBalanceById(ctx, owner.cardBalanceID, owner.userID)
		require.NoError(t, err)
		moneytest.Equal(t, 10000.0, bal.CreditLimit)
		_, err = r.creditCard.FindPaymentById(ctx, owner.cardPaymentID, owner.userID)
		assert.NoError(t, err)
		ln, err := r.loan.FindById(ctx, owner.loanID, owner.userID)
		require.NoError(t, err)
		assert.Equal(t, loan.LoanStatusActive, ln.Status)
		item, err := r.monthlyPlan.FindOne(ctx, owner.monthlyPlanID, owner.userID)
		require.NoError(t, err)
		require.NotNil(t, item)

		ownerTxns, err := r.transaction.FindAllOfAllAccounts(ctx, owner.userID)
		require.NoError(t, err)
		require.Len(t, ownerTxns, 1)
		assert.Equal(t, owner.accountID, ownerTxns[0].AccountId)
		assert.Equal(t, "Groceries", ownerTxns[0].Name)
	})
}

// TestTransactionRepository_SortWhitelist proves that the repository never
// interpolates an unknown sort column, even when the DTO layer is bypassed.
func TestTransactionRepository_SortWhitelist(t *testing.T) {
	r := newRepos()
	owner := seedTenant(t, r)
	ctx := context.Background()

	tests := []struct {
		name      string
		sortBy    string
		sortOrder string
	}{
		{name: "public name alias", sortBy: "name", sortOrder: "asc"},
		{name: "amount", sortBy: "amount", sortOrder: "desc"},
		{name: "unknown column falls back", sortBy: "does_not_exist", sortOrder: "asc"},
		{name: "injection attempt in column", sortBy: "created_at; DROP TABLE transactions; --", sortOrder: "asc"},
		{name: "injection attempt in order", sortBy: "amount", sortOrder: "asc; DROP TABLE transactions; --"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filter := transactionDto.NewTransactionFilter()
			filter.SortBy = tt.sortBy
			filter.SortOrder = tt.sortOrder
			rows, err := r.transaction.FindAllOfAllAccountsWithFilters(ctx, owner.userID, filter)
			require.NoError(t, err)
			assert.Len(t, rows, 1)
		})
	}

	var exists bool
	require.NoError(t, SetUpTest().QueryRow("SELECT to_regclass('public.transactions') IS NOT NULL").Scan(&exists))
	assert.True(t, exists)
}
