package dto

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

// card_balances and card_payments money columns are DECIMAL(15,2): input
// with sub-cent digits is rejected instead of silently rounded.
func TestCreditCardRequests_RejectSubCentAmounts(t *testing.T) {
	limit := money.MustParse("1000.001")
	cases := map[string]interface{ Validate() error }{
		"payment amount":   &CreatePaymentRequest{FromAccountId: "a", Currency: "DOP", Amount: money.MustParse("0.001")},
		"payment interest": &CreatePaymentRequest{FromAccountId: "a", Currency: "DOP", Amount: money.FromInt(1), IncludesInterest: true, InterestAmount: money.MustParse("1.234")},
		"credit limit": &CreateCreditCardRequest{CutDay: 1, DueDay: 2, Balances: []CreateBalanceRequest{
			{Currency: "DOP", CreditLimit: money.MustParse("100.555")},
		}},
		"initial debt": &CreateCreditCardRequest{CutDay: 1, DueDay: 2, Balances: []CreateBalanceRequest{
			{Currency: "DOP", CreditLimit: money.FromInt(100), InitialDebt: money.MustParse("0.009")},
		}},
		"update limit": &UpdateBalanceRequest{CreditLimit: &limit},
	}
	for name, req := range cases {
		err := req.Validate()
		assert.True(t, errors.Is(err, money.ErrTooManyDecimals), "%s: got %v", name, err)
	}

	ok := map[string]interface{ Validate() error }{
		"payment":      &CreatePaymentRequest{FromAccountId: "a", Currency: "DOP", Amount: money.MustParse("0.01"), InterestAmount: money.MustParse("1.50")},
		"card":         &CreateCreditCardRequest{CutDay: 1, DueDay: 2, Balances: []CreateBalanceRequest{{Currency: "DOP", CreditLimit: money.MustParse("100.50"), InitialDebt: money.MustParse("10.1")}}},
		"update empty": &UpdateBalanceRequest{},
	}
	for name, req := range ok {
		assert.NoError(t, req.Validate(), name)
	}
}
