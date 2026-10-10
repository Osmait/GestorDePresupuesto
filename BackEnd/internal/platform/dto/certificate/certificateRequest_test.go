package dto

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

func TestCertificateRequests_RejectSubCentMoney(t *testing.T) {
	payout := "acc-1"
	tooPrecise := money.MustParse("10.001")
	cents := money.MustParse("10.01")

	create := &CreateCertificateRequest{InterestType: "simple", PayoutAccountId: &payout, BaseCapital: tooPrecise}
	assert.True(t, errors.Is(create.Validate(), money.ErrTooManyDecimals))
	create.BaseCapital = cents
	assert.NoError(t, create.Validate())

	assert.True(t, errors.Is((&UpdateCertificateRequest{BaseCapital: &tooPrecise}).Validate(), money.ErrTooManyDecimals))
	assert.NoError(t, (&UpdateCertificateRequest{BaseCapital: &cents}).Validate())

	err := (&UpdateCertificatePaymentRequest{GrossInterest: &cents, NetInterest: &tooPrecise}).Validate()
	assert.True(t, errors.Is(err, money.ErrTooManyDecimals))
	assert.Contains(t, err.Error(), "net_interest")
	assert.NoError(t, (&UpdateCertificatePaymentRequest{}).Validate())
}
