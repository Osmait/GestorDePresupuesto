package apitest

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createAccountForReconcile(t *testing.T, token string) string {
	t.Helper()
	w := doRequest(t, http.MethodPost, "/account", token, `{"name":"Principal","bank":"Ban Reservas","initial_balance":1000}`)
	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())

	w = doRequest(t, http.MethodGet, "/account", token, "")
	require.Equal(t, http.StatusOK, w.Code)
	var accounts []struct {
		AccountInfo struct {
			Id string `json:"id"`
		} `json:"account_info"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &accounts))
	require.Len(t, accounts, 1)
	return accounts[0].AccountInfo.Id
}

// POST /account/:id/reconcile and GET /account/:id/reconciliations

func TestReconcileAccount_AdjustsToBankBalance(t *testing.T) {
	user := createAndLoginUser(t)
	accountID := createAccountForReconcile(t, user.Token)

	w := doRequest(t, http.MethodPost, "/account/"+accountID+"/reconcile", user.Token, `{"bank_balance":"1250.40","notes":"estado de octubre"}`)
	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())
	var result struct {
		Adjusted       bool    `json:"adjusted"`
		Difference     float64 `json:"difference"`
		Reconciliation struct {
			AppBalance    float64 `json:"app_balance"`
			BankBalance   float64 `json:"bank_balance"`
			TransactionId string  `json:"transaction_id"`
			Notes         string  `json:"notes"`
		} `json:"reconciliation"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
	assert.True(t, result.Adjusted)
	assert.InDelta(t, 250.40, result.Difference, 1e-9)
	assert.InDelta(t, 1000, result.Reconciliation.AppBalance, 1e-9)
	assert.InDelta(t, 1250.40, result.Reconciliation.BankBalance, 1e-9)
	assert.NotEmpty(t, result.Reconciliation.TransactionId)
	assert.Equal(t, "estado de octubre", result.Reconciliation.Notes)

	w = doRequest(t, http.MethodGet, "/account/"+accountID, user.Token, "")
	require.Equal(t, http.StatusOK, w.Code)
	var acc map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &acc))
	assert.EqualValues(t, 1250.4, acc["current_balance"])
	assert.NotEmpty(t, acc["last_reconciled_at"])

	w = doRequest(t, http.MethodGet, "/account/"+accountID+"/reconciliations", user.Token, "")
	require.Equal(t, http.StatusOK, w.Code)
	var history []map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &history))
	assert.Len(t, history, 1)
}

func TestReconcileAccount_Validation(t *testing.T) {
	user := createAndLoginUser(t)
	accountID := createAccountForReconcile(t, user.Token)

	for name, body := range map[string]string{
		"missing balance":  `{"notes":"x"}`,
		"invalid json":     `{"bank_balance":`,
		"unknown currency": `{"bank_balance":10,"currency":"EUR"}`,
		"too large":        `{"bank_balance":"1000000000000"}`,
	} {
		t.Run(name, func(t *testing.T) {
			w := doRequest(t, http.MethodPost, "/account/"+accountID+"/reconcile", user.Token, body)
			assert.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
		})
	}
}

func TestReconcileAccount_ForeignAccountIsNotFound(t *testing.T) {
	owner := createAndLoginUser(t)
	accountID := createAccountForReconcile(t, owner.Token)
	intruder := createAndLoginUser(t)

	w := doRequest(t, http.MethodPost, "/account/"+accountID+"/reconcile", intruder.Token, `{"bank_balance":1}`)
	assert.Equal(t, http.StatusNotFound, w.Code, w.Body.String())
	w = doRequest(t, http.MethodGet, "/account/"+accountID+"/reconciliations", intruder.Token, "")
	assert.Equal(t, http.StatusNotFound, w.Code, w.Body.String())

	w = doRequest(t, http.MethodGet, "/account/"+accountID, owner.Token, "")
	require.Equal(t, http.StatusOK, w.Code)
	var acc map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &acc))
	assert.EqualValues(t, 1000, acc["current_balance"])
	assert.Nil(t, acc["last_reconciled_at"])
}

func TestReconcileAccount_Unauthorized(t *testing.T) {
	w := doRequest(t, http.MethodPost, "/account/any/reconcile", "", `{"bank_balance":1}`)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}
