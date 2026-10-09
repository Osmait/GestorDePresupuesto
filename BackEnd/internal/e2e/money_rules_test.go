//go:build e2e
// +build e2e

package e2e

import (
	"net/http"
	"strings"

	"github.com/osmait/gestorDePresupuesto/internal/e2e/helpers"
)

// TestCardPaymentMoneyRules checks, through the HTTP API, that a credit-card
// payment (card_payments.amount is DECIMAL(15,2)) rejects sub-cent amounts
// instead of silently rounding them, and that it cannot overdraw the paying
// account (INSUFFICIENT_FUNDS), while a payment of the exact balance passes.
func (suite *E2ETestSuite) TestCardPaymentMoneyRules() {
	// cleanDatabase truncates feature_flags; restore the module flag (000024).
	suite.helpers.ExecuteSQL(`INSERT INTO feature_flags (key, name, default_enabled, scope) VALUES
		('module_credit_cards', 'Credit Cards Module', true, 'both')
		ON CONFLICT (key) DO NOTHING`)

	user := suite.helpers.CreateUserFlow("money-rules") // account with 1000.00

	resp := suite.helpers.MakeRequest("POST", "/credit-cards", map[string]interface{}{
		"name": "Visa", "bank": "BHD", "cut_day": 10, "due_day": 25,
		"balances": []map[string]interface{}{{"currency": "DOP", "credit_limit": "50000", "initial_debt": "5000"}},
	}, user.Token)
	suite.Require().Equal(http.StatusCreated, resp.StatusCode, resp.AsString())
	var card struct {
		ID string `json:"id"`
	}
	suite.Require().NoError(resp.AsJSON(&card))

	pay := func(amount string) *helpers.HTTPResponse {
		return suite.helpers.MakeRequest("POST", "/credit-cards/"+card.ID+"/payments", map[string]interface{}{
			"from_account_id": user.AccountID, "currency": "DOP", "amount": amount,
		}, user.Token)
	}

	resp = pay("0.001")
	suite.Equal(http.StatusBadRequest, resp.StatusCode, resp.AsString())
	suite.True(strings.Contains(resp.AsString(), "at most 2 decimal places"), resp.AsString())

	resp = pay("1000.01")
	suite.Equal(http.StatusBadRequest, resp.StatusCode, resp.AsString())
	suite.Equal("INSUFFICIENT_FUNDS", resp.ErrorCode(), resp.AsString())

	resp = pay("1000")
	suite.Equal(http.StatusCreated, resp.StatusCode, resp.AsString())

	// The account is now empty: even one cent more is an overdraft.
	resp = pay("0.01")
	suite.Equal(http.StatusBadRequest, resp.StatusCode, resp.AsString())
	suite.Equal("INSUFFICIENT_FUNDS", resp.ErrorCode(), resp.AsString())

	suite.Equal(1, suite.helpers.CountRecords("card_payments"), "rejected payments leave no row")
}
