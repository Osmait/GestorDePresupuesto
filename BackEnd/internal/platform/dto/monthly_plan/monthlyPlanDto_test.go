package monthly_plan

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/monthly_plan"
)

// newTestItem builds a minimal domain item for the response mapping tests.
func newTestItem(currency string, amount float64) *monthly_plan.MonthlyPlanItem {
	return monthly_plan.NewMonthlyPlanItem(
		"item-1", "user-1", "Test", "", amount,
		currency, monthly_plan.TypeBill, nil, nil, nil, true,
	)
}

// bindRequest runs a payload through gin's real binding so the tests exercise the
// same validation the handlers rely on.
func bindRequest[T any](t *testing.T, payload string) (*T, error) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	var target T
	err := ctx.ShouldBindJSON(&target)
	return &target, err
}

func TestMonthlyPlanItemRequestBinding(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		payload string
		wantErr bool
		reason  string
	}{
		{
			name:    "a minimal valid expense",
			payload: `{"name":"Alquiler","amount":25000,"type":"bill"}`,
		},
		{
			name:    "every optional field set",
			payload: `{"name":"Netflix","description":"stream","amount":15,"currency":"USD","type":"bill","category_id":"cat-1","account_id":"acc-1","day_of_month":8,"is_active":false}`,
		},
		{
			name:    "missing name is rejected",
			payload: `{"amount":25000,"type":"bill"}`,
			wantErr: true,
			reason:  "an unnamed item is useless in a visual plan",
		},
		{
			name:    "a negative amount is rejected",
			payload: `{"name":"Alquiler","amount":-50,"type":"bill"}`,
			wantErr: true,
			reason:  "a negative commitment would silently inflate the available balance",
		},
		{
			name:    "a zero amount is rejected",
			payload: `{"name":"Alquiler","amount":0,"type":"bill"}`,
			wantErr: true,
		},
		{
			name:    "an unknown type is rejected",
			payload: `{"name":"Alquiler","amount":100,"type":"expense"}`,
			wantErr: true,
			reason:  "the codebase vocabulary is 'bill', not 'expense'",
		},
		{
			name:    "an unsupported currency is rejected",
			payload: `{"name":"Alquiler","amount":100,"type":"bill","currency":"EUR"}`,
			wantErr: true,
		},
		{
			name:    "an omitted currency is accepted and defaulted later",
			payload: `{"name":"Alquiler","amount":100,"type":"bill"}`,
		},
		{
			name:    "day 0 is rejected",
			payload: `{"name":"Alquiler","amount":100,"type":"bill","day_of_month":0}`,
			wantErr: true,
		},
		{
			name:    "day 32 is rejected",
			payload: `{"name":"Alquiler","amount":100,"type":"bill","day_of_month":32}`,
			wantErr: true,
		},
		{
			name:    "day 31 is accepted",
			payload: `{"name":"Alquiler","amount":100,"type":"bill","day_of_month":31}`,
		},
		{
			name:    "an omitted day is accepted",
			payload: `{"name":"Imprevistos","amount":100,"type":"bill"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, err := bindRequest[MonthlyPlanItemRequest](t, tt.payload)

			if tt.wantErr {
				assert.Error(t, err, tt.reason)
				return
			}
			assert.NoError(t, err, tt.reason)
		})
	}
}

func TestActiveOrDefault(t *testing.T) {
	t.Parallel()

	t.Run("omitted is_active defaults to active", func(t *testing.T) {
		t.Parallel()
		req, err := bindRequest[MonthlyPlanItemRequest](t, `{"name":"Alquiler","amount":100,"type":"bill"}`)
		require.NoError(t, err)
		assert.True(t, req.ActiveOrDefault())
	})

	t.Run("explicit false is respected", func(t *testing.T) {
		t.Parallel()
		req, err := bindRequest[MonthlyPlanItemRequest](t, `{"name":"Alquiler","amount":100,"type":"bill","is_active":false}`)
		require.NoError(t, err)
		assert.False(t, req.ActiveOrDefault(), "an edit must not silently resume a paused item")
	})

	t.Run("explicit true is respected", func(t *testing.T) {
		t.Parallel()
		req, err := bindRequest[MonthlyPlanItemRequest](t, `{"name":"Alquiler","amount":100,"type":"bill","is_active":true}`)
		require.NoError(t, err)
		assert.True(t, req.ActiveOrDefault())
	})
}

func TestMonthlyPlanToggleRequestBinding(t *testing.T) {
	t.Parallel()

	// The pause action sends exactly this. `required` on a *bool checks the
	// pointer is non-nil, so `false` must survive binding — otherwise pausing an
	// item would be impossible.
	t.Run("is_active false is accepted", func(t *testing.T) {
		t.Parallel()
		req, err := bindRequest[MonthlyPlanToggleRequest](t, `{"is_active":false}`)
		require.NoError(t, err, "pausing an item must not be rejected by the binding")
		require.NotNil(t, req.IsActive)
		assert.False(t, *req.IsActive)
	})

	t.Run("is_active true is accepted", func(t *testing.T) {
		t.Parallel()
		req, err := bindRequest[MonthlyPlanToggleRequest](t, `{"is_active":true}`)
		require.NoError(t, err)
		require.NotNil(t, req.IsActive)
		assert.True(t, *req.IsActive)
	})

	// The handler dereferences the pointer, so a missing field must be rejected
	// before it reaches that code rather than read as a silent false.
	t.Run("a missing is_active is rejected", func(t *testing.T) {
		t.Parallel()
		_, err := bindRequest[MonthlyPlanToggleRequest](t, `{}`)
		assert.Error(t, err, "an absent flag must not be read as false")
	})
}

func TestNewMonthlyPlanItemResponseConvertsCurrency(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		currency      string
		amount        float64
		rate          float64
		wantAmountDop float64
	}{
		{name: "DOP is left untouched", currency: "DOP", amount: 25000, rate: 62.5, wantAmountDop: 25000},
		{name: "USD is converted", currency: "USD", amount: 15, rate: 62.5, wantAmountDop: 937.5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			response := NewMonthlyPlanItemResponse(newTestItem(tt.currency, tt.amount), tt.rate)

			assert.Equal(t, tt.amount, response.Amount, "the original amount is always preserved")
			assert.Equal(t, tt.wantAmountDop, response.AmountDop)
		})
	}
}
