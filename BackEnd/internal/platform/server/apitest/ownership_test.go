package apitest

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/segmentio/ksuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	investmentRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/investment"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
)

// ownedFixture is the set of rows one user owns in these tests.
type ownedFixture struct {
	user          testUser
	accountID     string
	categoryID    string
	transactionID string
	investmentID  string
}

// seedOwnedFixture creates a user (through the API, so it can log in) and an
// account, category, transaction and investment owned by that user.
func seedOwnedFixture(t *testing.T) ownedFixture {
	t.Helper()
	ctx := context.Background()
	user := createAndLoginUser(t)

	acc := account.NewAccount(money.Zero, ksuid.New().String(), "Checking", "Bank")
	acc.UserId = user.ID
	acc.Currency = "DOP"
	require.NoError(t, accountRepo.NewAccountRepository(testDB).Save(ctx, acc))

	cat := category.NewCategory(ksuid.New().String(), "Food", "tag", "#123456")
	cat.UserId = user.ID
	require.NoError(t, categoryRepo.NewCategoryRepository(testDB).Save(ctx, cat))

	txn := transaction.NewTransaction(ksuid.New().String(), "Groceries", "weekly", "bill", acc.Id, cat.Id, money.FromInt(42))
	txn.UserId = user.ID
	txn.Currency = "DOP"
	txn.CreatedAt = time.Now()
	require.NoError(t, transactionRepo.NewTransactionRepository(testDB).Save(ctx, txn))

	inv := investment.NewInvestment(ksuid.New().String(), user.ID, investment.Stock, "Apple", "AAPL", money.FromInt(1), money.FromInt(100), money.FromInt(100))
	require.NoError(t, investmentRepo.NewInvestmentRepository(testDB).Save(ctx, inv))

	return ownedFixture{
		user:          user,
		accountID:     acc.Id,
		categoryID:    cat.Id,
		transactionID: txn.Id,
		investmentID:  inv.ID,
	}
}

func doRequest(t *testing.T, method, path, token, body string) *httptest.ResponseRecorder {
	t.Helper()
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	w := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, reader)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Authorization", bearerToken(token))
	testEngine.ServeHTTP(w, req)
	return w
}

func transactionBody(accountID, categoryID string) string {
	return fmt.Sprintf(`{"name":"Hijacked","description":"x","amount":1,"type_transation":"bill","account_id":"%s","category_id":"%s","currency":"DOP"}`, accountID, categoryID)
}

// TestCrossUserAccess_IsRejected proves that user B cannot read, change or
// delete user A's rows, nor point its own rows at A's account/category.
func TestCrossUserAccess_IsRejected(t *testing.T) {
	owner := seedOwnedFixture(t)
	attacker := seedOwnedFixture(t)

	tests := []struct {
		name       string
		method     string
		path       string
		body       string
		wantStatus int
	}{
		{
			name:       "update another user's transaction",
			method:     http.MethodPut,
			path:       "/transaction/" + owner.transactionID,
			body:       transactionBody(attacker.accountID, attacker.categoryID),
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "delete another user's transaction",
			method:     http.MethodDelete,
			path:       "/transaction/" + owner.transactionID,
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "move own transaction into another user's account",
			method:     http.MethodPut,
			path:       "/transaction/" + attacker.transactionID,
			body:       transactionBody(owner.accountID, attacker.categoryID),
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "move own transaction into another user's category",
			method:     http.MethodPut,
			path:       "/transaction/" + attacker.transactionID,
			body:       transactionBody(attacker.accountID, owner.categoryID),
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "create transaction in another user's account",
			method:     http.MethodPost,
			path:       "/transaction",
			body:       transactionBody(owner.accountID, attacker.categoryID),
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "update another user's investment by path id",
			method:     http.MethodPut,
			path:       "/investments/" + owner.investmentID,
			body:       `{"name":"Hijacked","user_id":"` + attacker.user.ID + `"}`,
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "update another user's investment through the legacy body id",
			method:     http.MethodPut,
			path:       "/investments",
			body:       `{"id":"` + owner.investmentID + `","name":"Hijacked"}`,
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "delete another user's investment",
			method:     http.MethodDelete,
			path:       "/investments/" + owner.investmentID,
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "read another user's account",
			method:     http.MethodGet,
			path:       "/account/" + owner.accountID,
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "delete another user's account",
			method:     http.MethodDelete,
			path:       "/account/" + owner.accountID,
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := doRequest(t, tt.method, tt.path, attacker.user.Token, tt.body)
			assert.Equal(t, tt.wantStatus, w.Code, "body: %s", w.Body.String())
			assert.NotContains(t, strings.ToLower(w.Body.String()), "sql", "response must not leak database errors")
		})
	}

	// The owner's rows are untouched.
	var name string
	var accountID string
	require.NoError(t, testDB.QueryRow("SELECT transaction_name, account_id FROM transactions WHERE id = $1", owner.transactionID).Scan(&name, &accountID))
	assert.Equal(t, "Groceries", name)
	assert.Equal(t, owner.accountID, accountID)

	var invName, invUser string
	require.NoError(t, testDB.QueryRow("SELECT name, user_id FROM investments WHERE id = $1", owner.investmentID).Scan(&invName, &invUser))
	assert.Equal(t, "Apple", invName)
	assert.Equal(t, owner.user.ID, invUser)

	var attackerTxAccount string
	require.NoError(t, testDB.QueryRow("SELECT account_id FROM transactions WHERE id = $1", attacker.transactionID).Scan(&attackerTxAccount))
	assert.Equal(t, attacker.accountID, attackerTxAccount)
}

// TestListTransactionsOfForeignAccount_ReturnsNothing proves that
// GET /transaction/:accountId is scoped to the caller.
func TestListTransactionsOfForeignAccount_ReturnsNothing(t *testing.T) {
	owner := seedOwnedFixture(t)
	attacker := seedOwnedFixture(t)

	tests := []struct {
		name      string
		token     string
		accountID string
		wantCount int64
	}{
		{name: "owner sees own account transactions", token: owner.user.Token, accountID: owner.accountID, wantCount: 1},
		{name: "attacker sees nothing for the owner's account", token: attacker.user.Token, accountID: owner.accountID, wantCount: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := doRequest(t, http.MethodGet, "/transaction/"+tt.accountID+"?include_summary=true", tt.token, "")
			require.Equal(t, http.StatusOK, w.Code, w.Body.String())

			var resp struct {
				Data       []map[string]interface{} `json:"data"`
				Pagination struct {
					TotalRecords int64 `json:"total_records"`
				} `json:"pagination"`
			}
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
			assert.Equal(t, tt.wantCount, resp.Pagination.TotalRecords)
			assert.Len(t, resp.Data, int(tt.wantCount))
		})
	}
}

// TestOwnInvestmentUpdate_IgnoresOwnershipFields checks the DTO-based update:
// editable fields change, while id/user_id in the body are ignored.
func TestOwnInvestmentUpdate_IgnoresOwnershipFields(t *testing.T) {
	owner := seedOwnedFixture(t)
	other := seedOwnedFixture(t)

	body := `{"id":"` + other.investmentID + `","user_id":"` + other.user.ID + `","name":"Apple Inc","quantity":3}`
	w := doRequest(t, http.MethodPut, "/investments/"+owner.investmentID, owner.user.Token, body)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var name, userID string
	var quantity money.Amount
	require.NoError(t, testDB.QueryRow("SELECT name, user_id, quantity FROM investments WHERE id = $1", owner.investmentID).Scan(&name, &userID, &quantity))
	assert.Equal(t, "Apple Inc", name)
	assert.Equal(t, owner.user.ID, userID)
	moneytest.Equal(t, 3.0, quantity)

	var otherName string
	require.NoError(t, testDB.QueryRow("SELECT name FROM investments WHERE id = $1", other.investmentID).Scan(&otherName))
	assert.Equal(t, "Apple", otherName, "the investment named in the body must not be touched")
}

// TestTransactionSortBy covers every public sort_by value, including "name",
// which used to produce an invalid ORDER BY (500).
func TestTransactionSortBy(t *testing.T) {
	owner := seedOwnedFixture(t)

	tests := []struct {
		sortBy string
	}{
		{sortBy: "name"},
		{sortBy: "amount"},
		{sortBy: "created_at"},
		{sortBy: "type_transation"},
		{sortBy: "id;DROP TABLE transactions"},
	}

	for _, tt := range tests {
		t.Run(tt.sortBy, func(t *testing.T) {
			for _, path := range []string{"/transaction", "/transaction/" + owner.accountID} {
				w := doRequest(t, http.MethodGet, path+"?sort_by="+strings.ReplaceAll(tt.sortBy, " ", "%20")+"&sort_order=asc", owner.user.Token, "")
				assert.Equal(t, http.StatusOK, w.Code, "%s: %s", path, w.Body.String())
			}
		})
	}
}
