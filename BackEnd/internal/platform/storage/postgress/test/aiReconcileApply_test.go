package postgress

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/cache"
	aiHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/ai"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	notificationRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/notification"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	notificationService "github.com/osmait/gestorDePresupuesto/internal/services/notification"
	transactionService "github.com/osmait/gestorDePresupuesto/internal/services/transaction"
)

// Applying a reconciliation creates each extracted transaction once: a
// repeated id in the request, a replayed request or a double click must not
// create duplicates.
func TestAIReconcileApply_IsIdempotent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := SetUpTest()
	fx := seedCard(t, db, money.Zero) // a user with a bank account and a category

	txRepo := transactionRepo.NewTransactionRepository(db)
	txService := transactionService.NewTransactionService(txRepo, budgetRepo.NewBudgetRepository(db),
		notificationService.NewNotificationService(notificationRepo.NewNotificationRepository(db)),
		cache.NewInMemoryCache(time.Minute, time.Minute), nil, nil)
	h := aiHandler.NewHandler(nil, categoryRepo.NewCategoryRepository(db), txRepo, txService, db, nil, nil)

	sessionID := newID()
	extracted := transaction.NewTransaction("ext1", "Colmado", "", "bill", fx.accountID, fx.categoryID, money.FromInt(450))
	extracted.Currency = "DOP"
	extracted.CreatedAt = time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	extractedJSON, err := json.Marshal(extracted)
	require.NoError(t, err)
	_, err = db.Exec(`INSERT INTO reconciliation_sessions (id, user_id, account_id, document_type, extracted_count) VALUES ($1, $2, $3, 'statement', 1)`,
		sessionID, fx.userID, fx.accountID)
	require.NoError(t, err)
	_, err = db.Exec(`INSERT INTO reconciliation_items (id, session_id, extracted_transaction_id, extracted_data, candidate_data, match_status)
		VALUES ($1, $2, 'ext1', $3, '[]', 'unmatched')`, newID(), sessionID, string(extractedJSON))
	require.NoError(t, err)

	apply := func(body string) map[string]any {
		t.Helper()
		w := httptest.NewRecorder()
		require.NoError(t, inRequestTx(context.Background(), db, func(ctx context.Context) error {
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(http.MethodPost, "/ai/reconcile/"+sessionID+"/apply", strings.NewReader(body)).WithContext(ctx)
			c.Request.Header.Set("Content-Type", "application/json")
			c.Params = gin.Params{{Key: "session_id", Value: sessionID}}
			c.Set("X-User-Id", fx.userID)
			h.ApplyReconciliationSession(c)
			return nil
		}))
		require.Equal(t, http.StatusOK, w.Code, w.Body.String())
		var resp struct {
			Data map[string]any `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		return resp.Data
	}
	count := func() int {
		t.Helper()
		var n int
		require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM transactions WHERE account_id = $1 AND transaction_name = 'Colmado'`, fx.accountID).Scan(&n))
		return n
	}

	twice := `{"actions":[{"extracted_transaction_id":"ext1","action":"create"},{"extracted_transaction_id":"ext1","action":"create"}]}`
	first := apply(twice)
	assert.EqualValues(t, 1, first["created"])
	assert.EqualValues(t, 1, first["skipped"])
	assert.Equal(t, 1, count())

	again := apply(`{"actions":[{"extracted_transaction_id":"ext1","action":"create"}]}`)
	assert.EqualValues(t, 0, again["created"])
	assert.EqualValues(t, 1, again["skipped"])
	assert.Equal(t, 1, count(), "replaying the apply must not create the transaction again")
}
