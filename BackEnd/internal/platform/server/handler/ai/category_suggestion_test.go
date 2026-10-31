package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/ai"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/ai/tasks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// historyRepo counts history loads; any other repository method panics
// (nil embedded interface), so a full-ledger load would fail the test.
type historyRepo struct {
	transactionRepo.TransactionRepositoryInterface
	history    []*transaction.Transaction
	loads      atomic.Int32
	gotSince   time.Time
	gotLimit   int
	fullLedger atomic.Int32
}

func (r *historyRepo) FindCategorizedHistory(_ context.Context, _ string, since time.Time, limit int) ([]*transaction.Transaction, error) {
	r.loads.Add(1)
	r.gotSince, r.gotLimit = since, limit
	return r.history, nil
}

func (r *historyRepo) FindAllOfAllAccounts(context.Context, string) ([]*transaction.Transaction, error) {
	r.fullLedger.Add(1)
	return r.history, nil
}

type staticCategories struct {
	categoryRepo.CategoryRepoInterface
	categories []*category.Category
}

func (c staticCategories) FindAll(context.Context, string) ([]*category.Category, error) {
	return c.categories, nil
}

func TestSuggestCategoriesBatch_LoadsBoundedHistoryOncePerRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &historyRepo{history: []*transaction.Transaction{
		{Id: "h1", Name: "Supermercado Nacional", Amount: money.FromInt(50), TypeTransation: "bill", AccountId: "a1", CategoryId: "food"},
		{Id: "h2", Name: "Supermercado Nacional", Amount: money.FromInt(52), TypeTransation: "bill", AccountId: "a1", CategoryId: "food"},
		{Id: "h3", Name: "Shell gasolina", Amount: money.FromInt(30), TypeTransation: "bill", AccountId: "a1", CategoryId: "fuel"},
	}}
	h := NewHandler(nil, staticCategories{categories: []*category.Category{
		{Id: "food", Name: "Comida"}, {Id: "fuel", Name: "Combustible"},
	}}, repo, nil, nil, nil, nil)

	r := gin.New()
	r.POST("/ai/suggest-categories/batch", func(c *gin.Context) { c.Set("X-User-Id", "u1"); c.Next() }, h.SuggestCategoriesBatch)

	items := make([]string, 0, 100)
	for i := 0; i < 100; i++ {
		items = append(items, fmt.Sprintf(`{"name":"Supermercado Nacional","amount":"%d","type_transation":"bill","account_id":"a1"}`, 49+i%3))
	}
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/ai/suggest-categories/batch",
		strings.NewReader(`{"transactions":[`+strings.Join(items, ",")+`]}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	assert.Equal(t, int32(1), repo.loads.Load(), "history must be loaded once per request, not once per item")
	assert.Equal(t, int32(0), repo.fullLedger.Load(), "the unbounded ledger must not be loaded")
	assert.Equal(t, suggestionHistoryLimit, repo.gotLimit)
	assert.WithinDuration(t, time.Now().AddDate(0, -suggestionHistoryMonths, 0), repo.gotSince, time.Minute)

	var resp dto.SuggestCategoryResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.Len(t, resp.Items, 100)
	for _, item := range resp.Items {
		require.NotNil(t, item.Suggestion)
		assert.Equal(t, "food", item.Suggestion.CategoryID)
	}
}

func TestSuggestCategoriesForTransactions_OneHistoryLoadForAllExtracted(t *testing.T) {
	repo := &historyRepo{history: []*transaction.Transaction{
		{Id: "h1", Name: "Shell gasolina", Amount: money.FromInt(30), TypeTransation: "bill", CategoryId: "fuel"},
	}}
	h := NewHandler(nil, nil, repo, nil, nil, nil, nil)
	extracted := make([]*transaction.Transaction, 20)
	for i := range extracted {
		extracted[i] = &transaction.Transaction{Id: fmt.Sprint(i), Name: "Shell gasolina", Amount: money.FromInt(30), TypeTransation: "bill"}
	}
	got := h.suggestCategoriesForTransactions(context.Background(), "u1", extracted, []tasks.CategoryData{{ID: "fuel", Name: "Combustible"}})
	assert.Len(t, got, 20)
	assert.Equal(t, int32(1), repo.loads.Load())
}
