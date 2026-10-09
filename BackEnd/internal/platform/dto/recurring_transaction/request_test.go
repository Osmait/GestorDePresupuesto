package recurring_transaction

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

// recurring_transactions.amount is NUMERIC(15,2).
func TestRecurringTransactionRequest_RejectsSubCentAmount(t *testing.T) {
	assert.True(t, errors.Is((&RecurringTransactionRequest{Amount: money.MustParse("9.999")}).Validate(), money.ErrTooManyDecimals))
	assert.NoError(t, (&RecurringTransactionRequest{Amount: money.MustParse("9.99")}).Validate())
}
