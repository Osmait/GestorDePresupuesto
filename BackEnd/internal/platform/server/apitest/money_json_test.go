package apitest

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/segmentio/ksuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	investmentRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/investment"
)

// TestMoneyJSON_WireFormatIsUnchanged drives the real HTTP API and checks
// that every monetary field is still a bare JSON number (never a string),
// decodable as float64 (TypeScript number / Swift Double) and exact.
func TestMoneyJSON_WireFormatIsUnchanged(t *testing.T) {
	user := createAndLoginUser(t)
	ctx := context.Background()

	cat := category.NewCategory(ksuid.New().String(), "Salary", "tag", "#123456")
	cat.UserId = user.ID
	require.NoError(t, categoryRepo.NewCategoryRepository(testDB).Save(ctx, cat))

	w := doRequest(t, http.MethodPost, "/account", user.Token, `{"name":"Checking","bank":"Bank","initial_balance":1000.50}`)
	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())

	w = doRequest(t, http.MethodGet, "/account", user.Token, "")
	require.Equal(t, http.StatusOK, w.Code)
	var accounts []struct {
		AccountInfo struct {
			ID string `json:"id"`
		} `json:"account_info"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &accounts))
	require.Len(t, accounts, 1)
	accountID := accounts[0].AccountInfo.ID

	// Ten incomes of 0.1 (one sent as a numeric string, which is also
	// accepted): a float64 backend would accumulate 0.9999999999999999.
	for i := 0; i < 10; i++ {
		amount := `0.1`
		if i == 0 {
			amount = `"0.1"`
		}
		body := fmt.Sprintf(`{"name":"Tenth","amount":%s,"type_transation":"income","account_id":"%s","category_id":"%s","currency":"DOP"}`, amount, accountID, cat.Id)
		w = doRequest(t, http.MethodPost, "/transaction", user.Token, body)
		require.Equal(t, http.StatusCreated, w.Code, w.Body.String())
	}

	w = doRequest(t, http.MethodGet, "/account", user.Token, "")
	require.Equal(t, http.StatusOK, w.Code)
	t.Logf("GET /account -> %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"initial_balance":1000.5`)
	assert.Contains(t, w.Body.String(), `"current_balance":1001.5`)

	// Exact as a JSON number token...
	dec := json.NewDecoder(bytes.NewReader(w.Body.Bytes()))
	dec.UseNumber()
	var exact []map[string]any
	require.NoError(t, dec.Decode(&exact))
	assert.Equal(t, json.Number("1001.5"), exact[0]["current_balance"])
	// ...and decodable by a float64 client.
	var asFloat []struct {
		CurrentBalance float64 `json:"current_balance"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &asFloat))
	assert.Equal(t, 1001.5, asFloat[0].CurrentBalance)

	w = doRequest(t, http.MethodGet, "/transaction/"+accountID, user.Token, "")
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"amount":0.1,`)
	assert.NotContains(t, w.Body.String(), `"amount":"`)

	// Investment quantities and sub-cent prices keep their full precision
	// (migration 000050) and are still plain numbers.
	inv := investment.NewInvestment(ksuid.New().String(), user.ID, investment.Crypto, "Shiba", "SHIB",
		money.MustParse("1234567.12345678"), money.MustParse("0.0000123456"), money.MustParse("0.0000234567"))
	require.NoError(t, investmentRepo.NewInvestmentRepository(testDB).Save(ctx, inv))
	w = doRequest(t, http.MethodGet, "/investments", user.Token, "")
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	t.Logf("GET /investments -> %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"quantity":1234567.12345678,`)
	assert.Contains(t, w.Body.String(), `"purchase_price":0.0000123456,`)
	var invs []struct {
		Quantity      float64 `json:"quantity"`
		PurchasePrice float64 `json:"purchase_price"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &invs))
	assert.Equal(t, 1234567.12345678, invs[0].Quantity)
}
