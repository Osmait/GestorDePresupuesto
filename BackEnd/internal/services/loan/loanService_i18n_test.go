package loan

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	accountDomain "github.com/osmait/gestorDePresupuesto/internal/domain/account"
	categoryDomain "github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/loan"
	"github.com/osmait/gestorDePresupuesto/internal/platform/i18n"
	loanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/loan"
)

type stubLoanRepo struct {
	loanRepo.LoanRepositoryInterface
}

func (stubLoanRepo) SaveLoanWithInstallments(context.Context, *loan.Loan, []*loan.Installment) error {
	return nil
}

type stubAccounts struct{}

func (stubAccounts) FindByIdAndUserId(_ context.Context, id string, userId string) (*accountDomain.Account, error) {
	acc := accountDomain.NewAccount(money.FromInt(1000), id, "Checking", "BHD")
	acc.UserId = userId
	return acc, nil
}

func (s stubAccounts) FindByIdAndUserIdForUpdate(ctx context.Context, id string, userId string) (*accountDomain.Account, error) {
	return s.FindByIdAndUserId(ctx, id, userId)
}

// Balance reports no transactions: the 1000 initial balance is available.
func (stubAccounts) Balance(context.Context, string, string) (money.Amount, error) {
	return money.Zero, nil
}

type memoryCategories struct{ rows []*categoryDomain.Category }

func (m *memoryCategories) FindAll(_ context.Context, userId string) ([]*categoryDomain.Category, error) {
	var out []*categoryDomain.Category
	for _, c := range m.rows {
		if c.UserId == userId {
			out = append(out, c)
		}
	}
	return out, nil
}

func (m *memoryCategories) Save(_ context.Context, c *categoryDomain.Category) error {
	m.rows = append(m.rows, c)
	return nil
}

type recordedTx struct{ name, description, categoryID string }

type recordingTransactions struct{ calls []recordedTx }

func (r *recordingTransactions) CreateTransaction(_ context.Context, name, description string, _ money.Amount, _ string, _ string, _ string, categoryId string, _ string, _ string, _ time.Time) error {
	r.calls = append(r.calls, recordedTx{name, description, categoryId})
	return nil
}

func createLoan(t *testing.T, svc *LoanService, ctx context.Context) {
	t.Helper()
	_, err := svc.CreateLoan(ctx, &dto.CreateLoanRequest{
		BorrowerName: "Ana", PrincipalAmount: money.FromInt(1000), InterestMode: "none",
		TermMonths: 2, SourceAccountId: "acc-1",
	}, "user-1")
	require.NoError(t, err)
}

func TestCreateLoan_LocalizedNamesAndStableCategory(t *testing.T) {
	categories := &memoryCategories{}
	txs := &recordingTransactions{}
	svc := NewLoanService(stubLoanRepo{}, txs, stubAccounts{}, categories)

	createLoan(t, svc, context.Background())                           // default: es
	createLoan(t, svc, i18n.WithLocale(context.Background(), i18n.EN)) // en
	createLoan(t, svc, i18n.WithLocale(context.Background(), i18n.ES)) // es

	require.Len(t, txs.calls, 3)
	assert.Equal(t, recordedTx{"Préstamo a Ana", "Desembolso de préstamo", txs.calls[0].categoryID}, txs.calls[0])
	assert.Equal(t, recordedTx{"Loan to Ana", "Loan disbursement", txs.calls[0].categoryID}, txs.calls[1])
	assert.Equal(t, recordedTx{"Préstamo a Ana", "Desembolso de préstamo", txs.calls[0].categoryID}, txs.calls[2])

	// One category, found by its deterministic id whatever the language.
	require.Len(t, categories.rows, 1)
	assert.Equal(t, categoryDomain.SystemLoansGranted.ID("user-1"), categories.rows[0].Id)
	assert.Equal(t, "Préstamos otorgados", categories.rows[0].Name)
}

func TestCreateLoan_EnglishCreatesEnglishCategoryName(t *testing.T) {
	categories := &memoryCategories{}
	svc := NewLoanService(stubLoanRepo{}, &recordingTransactions{}, stubAccounts{}, categories)

	createLoan(t, svc, i18n.WithLocale(context.Background(), i18n.EN))

	require.Len(t, categories.rows, 1)
	assert.Equal(t, "Loans granted", categories.rows[0].Name)
}

func TestCreateLoan_AdoptsLegacyUnaccentedCategory(t *testing.T) {
	legacy := categoryDomain.NewCategory("legacy-ksuid", "Prestamos otorgados", "💸", "#0ea5e9")
	legacy.UserId = "user-1"
	categories := &memoryCategories{rows: []*categoryDomain.Category{legacy}}
	txs := &recordingTransactions{}
	svc := NewLoanService(stubLoanRepo{}, txs, stubAccounts{}, categories)

	createLoan(t, svc, i18n.WithLocale(context.Background(), i18n.EN))

	assert.Len(t, categories.rows, 1, "no duplicate category")
	assert.Equal(t, "legacy-ksuid", txs.calls[0].categoryID)
}
