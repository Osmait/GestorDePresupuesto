package transaction

// Handler-level benchmarks with an in-memory fake repository (no DB): they
// measure what the Go side costs per request on the hottest read and write
// endpoints — query parsing, service logic, decimal money handling, JSON.
//
//	go test ./internal/platform/server/handler/transaction -run '^$' -bench . -benchmem
//
// An identical benchmark (float64 signatures) was run against `main` to
// compare the exact-money branch with the float64 baseline; see
// perf/backend/README.md.

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	domain "github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/transaction"
)

type fakeTxRepo struct{ page []*domain.Transaction }

func (f *fakeTxRepo) Save(context.Context, *domain.Transaction) error { return nil }
func (f *fakeTxRepo) ResolveAndValidateCurrencyForAccount(_ context.Context, _, _, c string) (string, error) {
	return c, nil
}
func (f *fakeTxRepo) FindAll(context.Context, string, string, string, string) ([]*domain.Transaction, error) {
	return f.page, nil
}
func (f *fakeTxRepo) FindCurrentCategorySpent(context.Context, string, string, money.Amount) (money.Amount, error) {
	return money.Zero, nil
}
func (f *fakeTxRepo) FindCurrentSpentByCategory(context.Context, string, money.Amount) (map[string]money.Amount, error) {
	return nil, nil
}
func (f *fakeTxRepo) FindAllOfAllAccounts(context.Context, string) ([]*domain.Transaction, error) {
	return f.page, nil
}
func (f *fakeTxRepo) BalanceByAccountAndCurrency(context.Context, string, string, string) (money.Amount, error) {
	return money.Zero, nil
}
func (f *fakeTxRepo) Delete(context.Context, string, string) error              { return nil }
func (f *fakeTxRepo) TypeOf(context.Context, string, string) (string, error)    { return "bill", nil }
func (f *fakeTxRepo) Update(context.Context, string, *domain.Transaction) error { return nil }
func (f *fakeTxRepo) FindAllOfAllAccountsWithFilters(_ context.Context, _ string, fl *dto.TransactionFilter) ([]*domain.Transaction, error) {
	if fl.Limit > 0 && fl.Limit < len(f.page) {
		return f.page[:fl.Limit], nil
	}
	return f.page, nil
}
func (f *fakeTxRepo) FindAllWithFilters(context.Context, string, *dto.TransactionFilter) ([]*domain.Transaction, error) {
	return f.page, nil
}
func (f *fakeTxRepo) CountWithFilters(context.Context, string, *dto.TransactionFilter) (int64, error) {
	return 50000, nil
}
func (f *fakeTxRepo) FindByUserAndDateRange(context.Context, string, time.Time, time.Time) ([]*domain.Transaction, error) {
	return f.page, nil
}

type fakeBudgetRepo struct{}

func (fakeBudgetRepo) Save(context.Context, *budget.Budget) error                { return nil }
func (fakeBudgetRepo) FindAll(context.Context, string) ([]*budget.Budget, error) { return nil, nil }
func (fakeBudgetRepo) Delete(context.Context, string, string) error              { return nil }
func (fakeBudgetRepo) FindOne(context.Context, string, string) (*budget.Budget, error) {
	return nil, nil
}
func (fakeBudgetRepo) FindByCategory(context.Context, string, string) (*budget.Budget, error) {
	return nil, nil
}
func (fakeBudgetRepo) Update(context.Context, *budget.Budget) error { return nil }
func (fakeBudgetRepo) Search(context.Context, string, string) ([]*budget.Budget, error) {
	return nil, nil
}

// noCache never hits, so every request does the full conversion + encoding.
type noCache struct{}

func (noCache) Get(string) (interface{}, bool)         { return nil, false }
func (noCache) Set(string, interface{}, time.Duration) {}
func (noCache) Delete(string)                          {}
func (noCache) DeleteByPrefix(string)                  {}
func (noCache) Flush()                                 {}

func benchService(n int) *transaction.TransactionService {
	page := make([]*domain.Transaction, n)
	ts := time.Date(2026, 10, 9, 12, 0, 0, 0, time.UTC)
	for i := range page {
		t := domain.NewTransaction(fmt.Sprintf("pt%025d", i), "Supermercado Nacional", "seed tx", "bill",
			"pa0000000000000000000000001", "pc0000000000000000000000004",
			money.MustParse(fmt.Sprintf("%d.%02d", 50+(i*7919)%8000, (i*31)%100)))
		t.CreatedAt = ts
		page[i] = t
	}
	return transaction.NewTransactionService(&fakeTxRepo{page: page}, fakeBudgetRepo{}, nil, noCache{}, nil, nil)
}

func withUser(c *gin.Context) { c.Set("X-User-Id", "pu0000000000000000000000000"); c.Next() }

func BenchmarkListTransactionsHandler(b *testing.B) {
	gin.SetMode(gin.ReleaseMode)
	for _, n := range []int{20, 100} {
		b.Run(fmt.Sprintf("rows=%d", n), func(b *testing.B) {
			r := gin.New()
			r.Use(withUser)
			r.GET("/transaction", FindAllTransactionOfAllAccount(benchService(n)))
			url := fmt.Sprintf("/transaction?page=1&limit=%d&sort_by=created_at&sort_order=desc&date_from=2026-10-01&date_to=2026-10-31", n)
			req := httptest.NewRequest(http.MethodGet, url, nil)
			b.ReportAllocs()
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				w := httptest.NewRecorder()
				r.ServeHTTP(w, req)
				if w.Code != http.StatusOK {
					b.Fatalf("status %d: %s", w.Code, w.Body.String())
				}
			}
		})
	}
}

func BenchmarkCreateTransactionHandler(b *testing.B) {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(withUser)
	r.POST("/transaction", CreateTransaction(benchService(1)))
	body := `{"name":"k6 tx","description":"perf","amount":12.34,"type_transation":"bill",` +
		`"account_id":"pa0000000000000000000000001","category_id":"pc0000000000000000000000004","currency":"DOP"}`
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest(http.MethodPost, "/transaction", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != http.StatusCreated && w.Code != http.StatusOK {
			b.Fatalf("status %d: %s", w.Code, w.Body.String())
		}
	}
}
