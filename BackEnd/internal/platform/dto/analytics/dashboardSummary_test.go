package analyticsdto

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/analytics"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

// The dashboard's net worth subtracts the credit card debt: the response must
// carry it (the DTO copies the summary field by field).
func TestDashboardSummaryResponse_CarriesCreditCardDebt(t *testing.T) {
	t.Parallel()
	body, err := json.Marshal(NewDashboardSummaryResponse(&analytics.DashboardSummary{
		AccountsTotal:    money.FromInt(1000),
		CreditCardDebt:   money.MustParse("8300.50"),
		CreditCardsCount: 2,
	}))
	require.NoError(t, err)

	var got map[string]any
	require.NoError(t, json.Unmarshal(body, &got))
	assert.EqualValues(t, 8300.5, got["credit_card_debt"])
	assert.EqualValues(t, 2, got["credit_cards_count"])
}
