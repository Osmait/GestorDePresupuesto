//go:build e2e
// +build e2e

package e2e

import (
	"encoding/json"
	"net/http"
	"strings"
)

// TestDemoAccountCardPaymentAndAccountRules reproduces the verification
// session: the demo account has a 36-char UUID id, and paying a card from it
// used to fail with a 500 ("value too long for type character varying(32)").
// It also checks the Accept-Language driven names and that credit cards are
// rejected as broker funding source and certificate payout account.
func (suite *E2ETestSuite) TestDemoAccountCardPaymentAndAccountRules() {
	// cleanDatabase truncates feature_flags; restore the module flags (000024).
	suite.helpers.ExecuteSQL(`INSERT INTO feature_flags (key, name, default_enabled, scope) VALUES
		('module_investments', 'Investments Module', true, 'both'),
		('module_credit_cards', 'Credit Cards Module', true, 'both'),
		('module_certificates', 'Certificates Module', true, 'both')
		ON CONFLICT (key) DO NOTHING`)

	resp := suite.helpers.MakeRequest("POST", "/auth/demo", nil, "")
	suite.Require().Equal(http.StatusOK, resp.StatusCode, resp.AsString())
	var token string
	suite.Require().NoError(resp.AsJSON(&token))

	accounts, resp := suite.helpers.ListAccounts(token)
	suite.Require().Equal(http.StatusOK, resp.StatusCode, resp.AsString())
	suite.Require().Len(accounts, 1)
	demoAccountID := accounts[0].AccountInfo.ID
	suite.Require().Len(demoAccountID, 36, "demo account id is a UUID")

	en := map[string]string{"Accept-Language": "en-US,en;q=0.9"}
	resp = suite.helpers.MakeRequestWithHeaders("POST", "/credit-cards", map[string]interface{}{
		"name": "Visa", "bank": "BHD", "cut_day": 10, "due_day": 25,
		"balances": []map[string]interface{}{{"currency": "DOP", "credit_limit": "50000", "initial_debt": "1000"}},
	}, token, en)
	suite.Require().Equal(http.StatusCreated, resp.StatusCode, resp.AsString())
	var card struct {
		ID string `json:"id"`
	}
	suite.Require().NoError(resp.AsJSON(&card))

	for _, headers := range []map[string]string{en, {"Accept-Language": "es"}} {
		resp = suite.helpers.MakeRequestWithHeaders("POST", "/credit-cards/"+card.ID+"/payments", map[string]interface{}{
			"from_account_id": demoAccountID, "currency": "DOP", "amount": "100",
		}, token, headers)
		suite.Require().Equal(http.StatusCreated, resp.StatusCode, resp.AsString())
	}

	rows := suite.helpers.QuerySQL(`SELECT transaction_name, transaction_description FROM transactions
		WHERE account_id = $1 AND type_transation = 'card_payment' ORDER BY transaction_name`, demoAccountID)
	var names []string
	for rows.Next() {
		var name, description string
		suite.Require().NoError(rows.Scan(&name, &description))
		names = append(names, name+" | "+description)
	}
	suite.Require().NoError(rows.Err())
	suite.Require().NoError(rows.Close())
	suite.Equal([]string{"Card payment | Payment to BHD card", "Pago de tarjeta | Pago a tarjeta BHD"}, names)

	var categories int
	suite.Require().NoError(suite.db.QueryRow(`SELECT COUNT(*) FROM categorys c JOIN account a ON a.user_id = c.user_id
		WHERE a.id = $1 AND c.id LIKE 'cpcat\_%'`, demoAccountID).Scan(&categories))
	suite.Equal(1, categories, "one card payment category whatever the language")

	// A credit card cannot fund the broker...
	resp = suite.helpers.MakeRequest("POST", "/investments/funding", map[string]interface{}{
		"source_account_id": card.ID, "source_amount": "100",
	}, token)
	suite.Equal(http.StatusBadRequest, resp.StatusCode, resp.AsString())
	suite.True(strings.Contains(resp.AsString(), "credit card"), resp.AsString())

	// ...nor be the payout account of a certificate.
	resp = suite.helpers.MakeRequest("POST", "/certificate", map[string]interface{}{
		"bank": "BHD", "base_capital": "100000", "interest_type": "simple",
		"current_interest_rate": "5", "current_tax_rate": "10", "cut_day": 15,
		"payout_account_id": card.ID,
	}, token)
	suite.Equal(http.StatusBadRequest, resp.StatusCode, resp.AsString())
	var body struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	suite.Require().NoError(json.Unmarshal(resp.Body, &body))
	suite.Contains(body.Error.Message, "credit card")
}
