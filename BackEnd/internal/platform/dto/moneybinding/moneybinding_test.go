package moneybinding

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type request struct {
	Amount   money.Amount  `json:"amount" binding:"required,gt=0"`
	Rate     money.Amount  `json:"rate" binding:"gte=0,lte=100"`
	Optional *money.Amount `json:"optional" binding:"omitempty,gt=0"`
}

func bind(t *testing.T, body string) (request, error) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	var req request
	err := c.ShouldBindJSON(&req)
	return req, err
}

func TestBindingTagsOnAmounts(t *testing.T) {
	tests := []struct {
		name    string
		body    string
		wantErr bool
	}{
		{"valid number", `{"amount":125.50,"rate":10}`, false},
		{"valid numeric string", `{"amount":"0.01","rate":"100"}`, false},
		{"valid optional", `{"amount":1,"optional":2.5}`, false},
		{"missing required", `{"rate":10}`, true},
		{"zero fails gt", `{"amount":0}`, true},
		{"negative fails gt", `{"amount":-5}`, true},
		{"rate above lte", `{"amount":1,"rate":100.01}`, true},
		{"negative optional", `{"amount":1,"optional":-1}`, true},
		{"not a number", `{"amount":"abc"}`, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := bind(t, tt.body)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestBindingKeepsExactValue(t *testing.T) {
	req, err := bind(t, `{"amount":12345678901234567.89,"rate":0}`)
	require.NoError(t, err)
	assert.Equal(t, "12345678901234567.89", req.Amount.String())
}
