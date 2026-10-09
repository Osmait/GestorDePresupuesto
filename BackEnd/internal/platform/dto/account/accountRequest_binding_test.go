package dto

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func bindAccountRequest(t *testing.T, body string) (AccountRequest, error) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/account", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	var req AccountRequest
	err := c.ShouldBindJSON(&req)
	return req, err
}

// Regression: `binding:"required"` on InitialBalance made validator treat a
// zero balance as missing, so accounts opened with 0 were rejected with 400.
func TestAccountRequestBinding(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		body         string
		wantBindErr  bool
		wantValidErr bool
	}{
		{name: "zero balance is accepted", body: `{"name":"Cash","bank":"Wallet","initial_balance":0}`},
		{name: "zero balance as string is accepted", body: `{"name":"Cash","bank":"Wallet","initial_balance":"0.00"}`},
		{name: "positive balance is accepted", body: `{"name":"Cash","bank":"Wallet","initial_balance":1000.5}`},
		{name: "negative balance is rejected", body: `{"name":"Cash","bank":"Wallet","initial_balance":-1}`, wantValidErr: true},
		{name: "missing name is rejected", body: `{"bank":"Wallet","initial_balance":10}`, wantBindErr: true},
		{name: "missing bank is rejected", body: `{"name":"Cash","initial_balance":10}`, wantBindErr: true},
		// Regression: names longer than the VARCHAR(255) column reached the
		// database and failed with a 500.
		{name: "255 character name is accepted", body: fmt.Sprintf(`{"name":%q,"bank":"Wallet","initial_balance":1}`, strings.Repeat("é", 255))},
		{name: "256 character name is rejected", body: fmt.Sprintf(`{"name":%q,"bank":"Wallet","initial_balance":1}`, strings.Repeat("A", 256)), wantBindErr: true},
		{name: "256 character bank is rejected", body: fmt.Sprintf(`{"name":"Cash","bank":%q,"initial_balance":1}`, strings.Repeat("A", 256)), wantBindErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			req, err := bindAccountRequest(t, tc.body)
			if tc.wantBindErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			if tc.wantValidErr {
				require.Error(t, req.Validate())
				return
			}
			require.NoError(t, req.Validate())
		})
	}
}

func TestAccountUpdateRequestBinding_MaxLength(t *testing.T) {
	t.Parallel()

	bind := func(body string) error {
		gin.SetMode(gin.TestMode)
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPut, "/account/a1", strings.NewReader(body))
		c.Request.Header.Set("Content-Type", "application/json")
		var req AccountUpdateRequest
		return c.ShouldBindJSON(&req)
	}

	require.NoError(t, bind(fmt.Sprintf(`{"name":%q,"bank":"Wallet"}`, strings.Repeat("A", 255))))
	require.Error(t, bind(fmt.Sprintf(`{"name":%q,"bank":"Wallet"}`, strings.Repeat("A", 256))))
	require.Error(t, bind(fmt.Sprintf(`{"name":"Cash","bank":%q}`, strings.Repeat("A", 256))))
}
